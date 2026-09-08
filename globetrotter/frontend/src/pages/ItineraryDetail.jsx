// =============================================================================
// ItineraryDetail.jsx  -  ONE TRIP, IN FULL
//
// Every itinerary now has its own page. This is it.
//
// The old screen could only ever describe a trip in numbers, and only while
// you were still building it. This page shows the trip on an OpenStreetMap
// map with the ACTUAL ROUTE drawn along the streets you would take, because
// it asks OpenRouteService for it (through our own backend, which holds the
// API key - see backend/app/routers/routing.py).
//
// If the server has no OpenRouteService key configured, the reply comes back
// marked "estimate": the line is drawn straight between stops and the numbers
// are the app's own approximation. The page says so out loud rather than
// presenting a guess as a measurement.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft, Calendar, Clock, Footprints, Car, Info, Loader2, MapPin, Navigation,
  Route as RouteIcon, Star, Trash2, ChevronRight,
} from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { summariseTrip, formatFcfa, formatDuration } from "../lib/travel";

const YAOUNDE_CENTER = [3.8667, 11.5167];
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// A numbered pin, so the map shows the ORDER of the trip and not just a
// scattering of identical dots.
function numberedPin(index, color) {
  return L.divIcon({
    className: "gt-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -26],
    html: `
      <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
        <div style="
          width:26px;height:26px;background:${color};border:2.5px solid #fff;
          border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 3px 10px rgba(0,0,0,.5);">
          <span style="transform:rotate(45deg);color:#fff;font-size:12px;font-weight:800;font-family:system-ui,sans-serif;">${index}</span>
        </div>
      </div>`,
  });
}

// Zoom the map so the whole route is on screen. Has to live inside
// <MapContainer> because that's the only place useMap() works.
function FitToRoute({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [points, map]);
  return null;
}

const PROFILES = [
  { id: "driving-car", label: "By taxi", icon: Car },
  { id: "foot-walking", label: "On foot", icon: Footprints },
];

export default function ItineraryDetailScreen() {
  const { itineraryId } = useParams();
  const navigate = useNavigate();
  const { dark, theme } = useTheme();

  const [itinerary, setItinerary] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState("driving-car");
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);

  useEffect(() => {
    api
      .getItinerary(itineraryId)
      .then(setItinerary)
      .catch(() => setLoadError("Couldn't load this trip. It may have been deleted, or you may need to log in again."));
  }, [itineraryId]);

  // Stops that actually have coordinates - the only ones we can route through.
  const stops = useMemo(
    () =>
      (itinerary?.stops || [])
        .map((stop) => stop.destination)
        .filter((d) => d && typeof d.latitude === "number" && typeof d.longitude === "number"),
    [itinerary]
  );

  const stopPoints = useMemo(() => stops.map((s) => [s.latitude, s.longitude]), [stops]);

  // Ask the backend (and through it, OpenRouteService) for the real route.
  const loadRoute = useCallback(async () => {
    if (stops.length < 2) {
      setRoute(null);
      return;
    }
    setRouteLoading(true);
    try {
      // ORS speaks GeoJSON order: longitude first.
      const coordinates = stops.map((s) => [s.longitude, s.latitude]);
      setRoute(await api.getRoute(coordinates, profile));
    } catch {
      setRoute(null);
    } finally {
      setRouteLoading(false);
    }
  }, [stops, profile]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  const handleDelete = async () => {
    try {
      await api.deleteItinerary(itineraryId);
      navigate("/itinerary");
    } catch {
      setLoadError("Couldn't delete this trip. Please try again.");
    }
  };

  // The app's own fare maths still applies - OpenRouteService tells us how
  // far and how long, not what a Yaounde taxi charges.
  const perStopMinutes = 45;
  const localEstimate = summariseTrip(stops, perStopMinutes);

  const isRealRoute = route?.source === "openrouteservice";
  const routeGeometry = route?.geometry?.length ? route.geometry : stopPoints;

  const routeKm = route ? route.distance_m / 1000 : localEstimate.totalKm;
  const routeMinutes = route ? Math.round(route.duration_s / 60) : localEstimate.travelMinutes;

  const steps = route?.steps || [];
  const visibleSteps = showAllSteps ? steps : steps.slice(0, 6);

  if (loadError) {
    return (
      <div className="gt-page" style={{ background: theme.bg }}>
        <div className="gt-container" style={{ paddingTop: 30 }}>
          <Link to="/itinerary" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 18 }}>
            <ArrowLeft size={16} /> Back to your trips
          </Link>
          <p style={{ color: "#ef4444", fontSize: 14, fontWeight: 600 }}>{loadError}</p>
        </div>
      </div>
    );
  }

  const card = {
    background: theme.card,
    backdropFilter: "blur(20px)",
    border: `1px solid ${theme.border}`,
    borderRadius: 22,
    padding: "18px 20px",
    boxShadow: theme.shadowSoft,
  };

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        .gt-pin { background: transparent !important; border: none !important; }
        .leaflet-container { background: ${dark ? "#0a1628" : "#eaf6f8"}; font-family: inherit; }
        .gt-dark-tiles { filter: invert(1) hue-rotate(200deg) brightness(0.92) contrast(0.88); }
        .leaflet-control-attribution { font-size: 9px !important; opacity: .75; }
        .gt-detail { display: grid; gap: 18px; grid-template-columns: 1fr; align-items: start; }
        @media (min-width: 1000px) { .gt-detail { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); } }
      `}</style>

      <div className="gt-glow" style={{ width: 300, height: 300, top: -80, right: -90, background: theme.accent, opacity: dark ? 0.1 : 0.2 }} />

      <div className="gt-container gt-container--wide" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40 }}>
        <Link to="/itinerary" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back to your trips
        </Link>

        {/* -------------------- HEADING -------------------- */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(24px, 3vw, 32px)", color: theme.text, margin: "0 0 8px", lineHeight: 1.2 }}>
              {itinerary?.title || "Loading..."}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: theme.subtext }}>
                <Calendar size={14} color="#22c55e" /> {itinerary?.date || "—"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: theme.subtext }}>
                <MapPin size={14} color="#f97316" /> {stops.length} stop{stops.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="gt-btn"
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 14, border: `1px solid ${theme.border}`, background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 13.5 }}
          >
            <Trash2 size={15} /> Delete trip
          </button>
        </div>

        <div className="gt-detail">
          {/* ==================== LEFT: THE MAP + THE ROUTE ==================== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ height: "clamp(300px, 46vh, 520px)", width: "100%" }}>
                <MapContainer
                  center={stopPoints[0] || YAOUNDE_CENTER}
                  zoom={13}
                  scrollWheelZoom
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    className={dark ? "gt-dark-tiles" : ""}
                    url={OSM_TILE_URL}
                    attribution={OSM_ATTRIBUTION}
                    maxZoom={19}
                  />
                  <FitToRoute points={routeGeometry} />

                  {/* The route itself. Dashed when it's only an estimate, so
                      you can tell at a glance which kind of line you're
                      looking at without reading the caption. */}
                  {routeGeometry.length > 1 && (
                    <Polyline
                      positions={routeGeometry}
                      pathOptions={{
                        color: theme.accent,
                        weight: 5,
                        opacity: 0.9,
                        dashArray: isRealRoute ? undefined : "8 10",
                      }}
                    />
                  )}

                  {stops.map((stop, i) => (
                    <Marker
                      key={stop.id}
                      position={[stop.latitude, stop.longitude]}
                      // A fixed teal rather than theme.accent: the light
                      // theme's accent is nearly white, which disappears
                      // against the map tiles.
                      icon={numberedPin(i + 1, "#0d9488")}
                    >
                      <Popup>
                        <strong>{stop.name}</strong>
                        <br />
                        {stop.neighbourhood || "Yaoundé"}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* Route summary bar under the map */}
              <div style={{ padding: "14px 18px", borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {PROFILES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setProfile(id)}
                      className="gt-chip"
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                        border: `1px solid ${profile === id ? theme.accent : theme.border}`,
                        background: profile === id ? theme.accent : "transparent",
                        color: profile === id ? theme.accentText : theme.text,
                      }}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", gap: 14 }}>
                  {routeLoading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: theme.subtext }}>
                      <Loader2 size={14} className="gt-spin" /> Calculating route...
                    </span>
                  ) : stops.length < 2 ? (
                    <span style={{ fontSize: 12.5, color: theme.subtext }}>Add a second stop to get a route.</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{routeKm.toFixed(1)} km</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: theme.accent }}>{formatDuration(routeMinutes)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Where these numbers came from - stated, not implied. */}
              {route && (
                <div style={{ padding: "0 18px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Info size={13} color={theme.subtext} style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: theme.subtext, lineHeight: 1.5, margin: 0 }}>
                    {isRealRoute
                      ? "Route, distance and time from OpenRouteService, following real streets on OpenStreetMap data."
                      : `${route.note} The dashed line joins your stops directly.`}
                  </p>
                </div>
              )}
            </div>

            {/* -------------------- TURN BY TURN -------------------- */}
            {steps.length > 0 && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Navigation size={15} color={theme.accent} />
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, margin: 0 }}>Directions</h2>
                </div>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {visibleSteps.map((step, i) => (
                    <li
                      key={i}
                      style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < visibleSteps.length - 1 ? `1px solid ${theme.border}` : "none" }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: theme.inputBg, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, color: theme.subtext, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: theme.text, lineHeight: 1.5 }}>
                        {step.instruction}
                        {step.name && step.name !== "-" && (
                          <span style={{ color: theme.subtext }}> on {step.name}</span>
                        )}
                      </span>
                      <span style={{ fontSize: 11.5, color: theme.subtext, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {step.distance_m >= 1000 ? `${(step.distance_m / 1000).toFixed(1)} km` : `${step.distance_m} m`}
                      </span>
                    </li>
                  ))}
                </ol>
                {steps.length > 6 && (
                  <button
                    onClick={() => setShowAllSteps((v) => !v)}
                    className="gt-btn"
                    style={{ marginTop: 12, padding: "9px 16px", borderRadius: 12, border: `1px solid ${theme.border}`, background: "transparent", color: theme.accent, fontWeight: 700, fontSize: 12.5 }}
                  >
                    {showAllSteps ? "Show fewer steps" : `Show all ${steps.length} steps`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ==================== RIGHT: THE STOPS AND THE COST ==================== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <RouteIcon size={15} color="#6366f1" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, margin: 0 }}>The stops, in order</h2>
              </div>

              {stops.length === 0 ? (
                <p style={{ fontSize: 13, color: theme.subtext, margin: 0 }}>This trip has no stops with map coordinates.</p>
              ) : (
                stops.map((stop, i) => (
                  <div key={stop.id} style={{ display: "flex", gap: 12 }}>
                    {/* The connecting line down the left, so it reads as a route */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: theme.accent, color: theme.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                        {i + 1}
                      </span>
                      {i < stops.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 34, background: theme.border, marginTop: 4 }} />}
                    </div>

                    <Link
                      to={`/site/${stop.id}`}
                      className="gt-btn"
                      style={{
                        flex: 1, minWidth: 0, marginBottom: 12, textDecoration: "none",
                        display: "flex", alignItems: "center", gap: 10,
                        background: theme.inputBg, border: `1px solid ${theme.border}`,
                        borderRadius: 14, padding: "11px 13px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text, lineHeight: 1.3, marginBottom: 3 }}>{stop.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <MapPin size={11} color={theme.subtext} />
                          <span style={{ fontSize: 11.5, color: theme.subtext }}>{stop.neighbourhood || "Yaoundé"}</span>
                          <Star size={11} fill="#fbbf24" color="#fbbf24" style={{ marginLeft: 3 }} />
                          <span style={{ fontSize: 11.5, color: theme.subtext }}>{stop.rating}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} color={theme.subtext} style={{ flexShrink: 0 }} />
                    </Link>
                  </div>
                ))
              )}
            </div>

            {/* Day totals */}
            {stops.length > 0 && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Clock size={15} color="#ec4899" />
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, margin: 0 }}>How the day adds up</h2>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { label: "Distance", value: `${routeKm.toFixed(1)} km` },
                    { label: "Travel time", value: formatDuration(routeMinutes) },
                    { label: "Whole day", value: formatDuration(routeMinutes + stops.length * perStopMinutes) },
                  ].map((stat) => (
                    <div key={stat.label} style={{ flex: 1, minWidth: 100, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "11px 13px" }}>
                      <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>{stat.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 150, background: dark ? "rgba(94,234,212,0.10)" : "rgba(13,148,136,0.10)", border: `1px solid ${theme.accent}55`, borderRadius: 14, padding: "11px 13px" }}>
                    <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>Shared taxi + walking</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: theme.accent }}>{formatFcfa(localEstimate.cheapFare)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 150, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "11px 13px" }}>
                    <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>Private taxi all day</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{formatFcfa(localEstimate.comfortableFare)}</div>
                  </div>
                </div>

                <p style={{ fontSize: 10.5, color: theme.subtext, margin: "12px 0 0", lineHeight: 1.5 }}>
                  Fares are typical 2026 Yaoundé prices — a shared taxi is a flat fare per hop, a private
                  "dépôt" taxi is negotiated. Allowing {perStopMinutes} minutes at each stop.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
