# =============================================================================
# routers/routing.py
#
# REAL ROUTES, FROM OPENROUTESERVICE
#
# The app draws its map with OpenStreetMap tiles (Leaflet), which tells you
# where things ARE. It could not tell you how to GET there: the Directions
# button handed the problem to Google Maps in another tab, and the itinerary
# screen estimated distance as a straight line plus 35% for Yaounde's hills.
#
# OpenRouteService (openrouteservice.org) solves that properly. It is a free
# routing engine built on the same OpenStreetMap data as our tiles, so the
# line it returns follows the actual streets that are drawn on the map. It
# gives us:
#   - the road geometry, which we draw on the map as a line
#   - the real road distance and travel time
#   - turn-by-turn instructions
#
# WHY THIS IS A BACKEND ROUTE AND NOT A DIRECT CALL FROM THE BROWSER
# ------------------------------------------------------------------
# OpenRouteService needs an API key. A key put in frontend code is public -
# anyone can open devtools, copy it and spend your quota. So the browser calls
# US, and we add the key from an environment variable that never leaves the
# server:
#
#     export ORS_API_KEY=...        (Windows:  set ORS_API_KEY=...)
#
# Get a free key at https://openrouteservice.org/dev/#/signup
#
# IF THERE IS NO KEY
# ------------------
# The app must not break for someone who clones this repo without one. When
# ORS_API_KEY is unset - or ORS is down, or the phone is offline - we fall
# back to the straight-line estimate the itinerary screen already used, and
# say so in the response ("source": "estimate"). The screens show that
# honestly rather than passing a guess off as a measured route.
# =============================================================================

import json
import math
import os
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/routing", tags=["routing"])

ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions"

# Which travel modes we let the frontend ask for. Anything else is rejected
# rather than forwarded, so a typo can't turn into a strange upstream error.
PROFILES = {
    "driving-car": "driving-car",
    "foot-walking": "foot-walking",
    "cycling-regular": "cycling-regular",
}

# Same constants the frontend's estimate uses (see frontend/src/lib/travel.js),
# so a fallback answer matches what the itinerary screen would have said on
# its own instead of contradicting it.
ROAD_DETOUR_FACTOR = 1.35
CITY_DRIVING_KMH = 18
WALKING_KMH = 4.5


class RouteRequest(BaseModel):
    # [[longitude, latitude], ...] - GeoJSON order, which is what ORS expects.
    # At least two points: where you are and where you're going.
    coordinates: list[list[float]] = Field(min_length=2)
    profile: str = "driving-car"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance between two points on the globe, in km."""
    earth_radius_km = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return earth_radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _estimated_route(coordinates: list[list[float]], profile: str, note: str) -> dict:
    """The answer we give when we can't ask OpenRouteService.

    The 'geometry' is just the stops joined by straight lines, so the map
    still draws something meaningful, and the numbers are the same estimate
    the app has always used.
    """
    total_km = 0.0
    for i in range(len(coordinates) - 1):
        lon1, lat1 = coordinates[i][0], coordinates[i][1]
        lon2, lat2 = coordinates[i + 1][0], coordinates[i + 1][1]
        total_km += _haversine_km(lat1, lon1, lat2, lon2) * ROAD_DETOUR_FACTOR

    speed_kmh = WALKING_KMH if profile == "foot-walking" else CITY_DRIVING_KMH

    return {
        "source": "estimate",
        "note": note,
        "profile": profile,
        "distance_m": round(total_km * 1000),
        "duration_s": round((total_km / speed_kmh) * 3600),
        # [[lat, lng], ...] - Leaflet's order, ready to hand straight to a
        # <Polyline/>. The conversion happens here so no screen has to
        # remember which library wants which order.
        "geometry": [[point[1], point[0]] for point in coordinates],
        "steps": [],
    }


def _call_ors(payload: dict, profile: str, api_key: str) -> dict:
    """POSTs to OpenRouteService and reshapes its GeoJSON into the small,
    flat structure the frontend actually needs."""
    request = urllib.request.Request(
        f"{ORS_BASE_URL}/{profile}/geojson",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/geo+json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))

    features = data.get("features") or []
    if not features:
        raise ValueError("OpenRouteService returned no route")

    feature = features[0]
    summary = feature.get("properties", {}).get("summary", {})
    segments = feature.get("properties", {}).get("segments", []) or []

    steps = []
    for segment in segments:
        for step in segment.get("steps", []) or []:
            steps.append(
                {
                    "instruction": step.get("instruction", ""),
                    "name": step.get("name") or "",
                    "distance_m": round(step.get("distance", 0)),
                    "duration_s": round(step.get("duration", 0)),
                }
            )

    # ORS geometry is [lon, lat]; Leaflet wants [lat, lng].
    geometry = [[point[1], point[0]] for point in feature["geometry"]["coordinates"]]

    return {
        "source": "openrouteservice",
        "note": "",
        "profile": profile,
        "distance_m": round(summary.get("distance", 0)),
        "duration_s": round(summary.get("duration", 0)),
        "geometry": geometry,
        "steps": steps,
    }


@router.get("/status")
def routing_status():
    """Lets the app tell the user WHY it is showing estimates instead of real
    routes, rather than silently degrading."""
    return {
        "provider": "OpenRouteService",
        "configured": bool(os.environ.get("ORS_API_KEY", "").strip()),
        "help": "Set the ORS_API_KEY environment variable. Free key: https://openrouteservice.org/dev/#/signup",
    }


@router.post("/directions")
def directions(payload: RouteRequest):
    """Real road route between two or more points.

    Always returns a usable answer: a measured route when we have a key and
    OpenRouteService replies, an honest estimate otherwise.
    """
    profile = PROFILES.get(payload.profile)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown profile. Use one of: {', '.join(PROFILES)}",
        )

    for point in payload.coordinates:
        if len(point) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each coordinate must be [longitude, latitude]",
            )
        lon, lat = point
        if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coordinates out of range - expected [longitude, latitude]",
            )

    api_key = os.environ.get("ORS_API_KEY", "").strip()
    if not api_key:
        return _estimated_route(
            payload.coordinates,
            profile,
            "No OpenRouteService key configured on the server, so this is a straight-line estimate.",
        )

    try:
        return _call_ors(
            {"coordinates": payload.coordinates, "instructions": True},
            profile,
            api_key,
        )
    except urllib.error.HTTPError as error:
        # 404 from ORS usually means "no road connects these points" (a stop
        # dropped in the middle of nowhere), which is worth saying plainly.
        reason = "No road route found between these points." if error.code == 404 else f"OpenRouteService error {error.code}."
        return _estimated_route(payload.coordinates, profile, f"{reason} Showing a straight-line estimate.")
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError):
        return _estimated_route(
            payload.coordinates,
            profile,
            "Couldn't reach OpenRouteService. Showing a straight-line estimate.",
        )
