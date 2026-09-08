// =============================================================================
// Map.jsx  -  THE REAL MAP, WITH REAL DIRECTIONS
//
// THE MAP: OPENSTREETMAP, NO KEY, EVER
// ------------------------------------
// The tiles are plain OpenStreetMap, drawn by Leaflet. We used to pull the
// dark basemap from CARTO; CARTO has since started requiring an API key for
// it, which is why the map briefly showed "API key required" watermarks
// across every tile - not a bug in our code, a policy change on their end,
// discovered the hard way. OpenStreetMap's own tiles have never required a
// key and are run specifically to stay free for projects like this, so both
// light and dark mode use them, and "dark mode" is a CSS filter over the
// same tiles rather than a second tile set that could start demanding a key.
//
// THE DIRECTIONS: OPENROUTESERVICE
// --------------------------------
// WHAT CHANGED AND WHY. The Directions button used to be a dead end: it
// opened Google Maps in a new tab and handed the user off to another app.
// You left GlobeTrotter to find out how to get anywhere.
//
// Now the route is calculated by OpenRouteService - a free routing engine
// built on the same OpenStreetMap data these tiles come from - and drawn
// directly on this map, following the actual streets, with the distance,
// the travel time and turn-by-turn instructions in the card at the bottom.
//
// The browser doesn't call OpenRouteService itself. It calls OUR backend,
// which adds the API key server-side, because a key in frontend code is a
// public key. See backend/app/routers/routing.py - including what happens
// when no key is configured (an honest straight-line estimate, labelled
// as one, rather than a broken screen).
//
// THE PIECES
// ----------
//   leaflet           - the mapping engine (draws tiles, handles drag/zoom)
//   react-leaflet     - lets us write that map as React components
//   OpenStreetMap     - free map data and tile images
//   OpenRouteService  - free routing over that same data (via our backend)
//   Overpass API      - free OpenStreetMap query service, which answers
//                       "where is the nearest pharmacy?"
// =============================================================================

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LocateFixed, MapPin, Navigation, X, Layers, Plus, Minus, Star, Search, Cross,
  Pill, Fuel, BedDouble, Banknote, Shield, Copy, Check, SlidersHorizontal,
  Loader2, Car, Footprints, ExternalLink, Info,
} from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { formatDuration } from "../lib/travel";

// Yaoundé city centre. The map opens here before any pins load.
const YAOUNDE_CENTER = [3.8667, 11.5167];
const DEFAULT_ZOOM = 13;

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// One colour per destination category, so a glance tells you what a pin is.
const CATEGORY_STYLE = {
  landmarks: { color: "#f97316", label: "Landmarks" },
  museums: { color: "#ec4899", label: "Museums" },
  religious: { color: "#8b5cf6", label: "Religious" },
  traditions: { color: "#d97706", label: "Craft" },
  streetfood: { color: "#ea580c", label: "Street food" },
  restaurant: { color: "#ef4444", label: "Restaurants" },
  cafe: { color: "#a16207", label: "Cafés" },
  shopping: { color: "#eab308", label: "Markets" },
  nightlife: { color: "#db2777", label: "Nightlife" },
  arts: { color: "#7c3aed", label: "Arts" },
  festivals: { color: "#f43f5e", label: "Festivals" },
  sports: { color: "#0284c7", label: "Sport" },
  viewpoints: { color: "#0d9488", label: "Viewpoints" },
  nature: { color: "#22c55e", label: "Nature" },
  outdoor: { color: "#16a34a", label: "Outdoor" },
  hidden: { color: "#a855f7", label: "Hidden gems" },
  library: { color: "#6366f1", label: "Libraries" },
  wellness: { color: "#f472b6", label: "Wellness" },
  family: { color: "#0ea5e9", label: "Family" },
  budget: { color: "#10b981", label: "Free" },
  coworking: { color: "#64748b", label: "Coworking" },
};
const styleFor = (category) => CATEGORY_STYLE[category] || { color: "#5eead4", label: category };

// The practical layers from the original design. `osmTag` is how each one is
// labelled inside OpenStreetMap's database, which is what lets us fetch real
// ones instead of drawing fake dots.
const AMENITIES = [
  { id: "hospitals", label: "Hospitals", color: "#ef4444", icon: Cross, osmTag: "amenity=hospital" },
  { id: "pharmacies", label: "Pharmacies", color: "#ec4899", icon: Pill, osmTag: "amenity=pharmacy" },
  { id: "fuel", label: "Fuel stations", color: "#a855f7", icon: Fuel, osmTag: "amenity=fuel" },
  { id: "hotels", label: "Hotels", color: "#3b82f6", icon: BedDouble, osmTag: "tourism=hotel" },
  { id: "banks", label: "Banks & ATMs", color: "#92400e", icon: Banknote, osmTag: "amenity=bank" },
  { id: "police", label: "Police stations", color: "#64748b", icon: Shield, osmTag: "amenity=police" },
];

const TRAVEL_MODES = [
  { id: "driving-car", label: "Taxi", icon: Car },
  { id: "foot-walking", label: "Walk", icon: Footprints },
];

// ---------------------------------------------------------------------------
// CUSTOM MARKERS
//
// Leaflet ships default blue markers as image files, but those images break
// in a production build (their paths are resolved relative to Leaflet's own
// CSS). Rather than patch that, we draw our own pins from a little HTML,
// which also lets us colour them per category.
// ---------------------------------------------------------------------------
function destinationPin(category, isSelected) {
  const { color } = styleFor(category);
  const size = isSelected ? 40 : 30;
  return L.divIcon({
    className: "gt-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],   // the pin's tip, not its middle, marks the spot
    popupAnchor: [0, -size + 6],
    html: `
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        <div style="
          width:${size * 0.7}px;height:${size * 0.7}px;
          background:${color};border:2.5px solid #fff;
          border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          box-shadow:0 3px 10px rgba(0,0,0,.5);
          ${isSelected ? "animation:gtPinPulse 1.4s ease-in-out infinite;" : ""}
        "></div>
      </div>`,
  });
}

// Service markers are small and round so they never compete visually with
// the destinations you actually came to look at.
function dotPin(color) {
  return L.divIcon({
    className: "gt-pin",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);"></div>`,
  });
}

// ---------------------------------------------------------------------------
// BRIDGE COMPONENT
//
// react-leaflet only exposes the live map object through the useMap() hook,
// and that hook only works INSIDE <MapContainer>. This tiny component sits
// inside the map and turns our React state into map commands.
// ---------------------------------------------------------------------------
function MapController({ flyTarget, zoomNudge, fitBounds, onMoveEnd }) {
  const map = useMap();

  // Glide to a coordinate whenever flyTarget changes.
  useEffect(() => {
    if (flyTarget) map.flyTo(flyTarget, Math.max(map.getZoom(), 16), { duration: 0.9 });
  }, [flyTarget, map]);

  // When a route arrives, zoom out far enough to see all of it.
  useEffect(() => {
    if (fitBounds?.length > 1) map.fitBounds(L.latLngBounds(fitBounds), { padding: [60, 60] });
  }, [fitBounds, map]);

  // Our +/- buttons bump a counter; we react by zooming in or out.
  useEffect(() => {
    if (zoomNudge === 0) return;
    if (zoomNudge > 0) map.zoomIn();
    else map.zoomOut();
  }, [zoomNudge, map]);

  // Report the new centre after each pan, so a service search looks around
  // the area you're actually viewing rather than always the city centre.
  useMapEvents({
    moveend: () => {
      const centre = map.getCenter();
      onMoveEnd([centre.lat, centre.lng]);
    },
  });

  return null;
}

export default function MapScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();

  // ---- screen state ----
  const [destinations, setDestinations] = useState([]);
  const [status, setStatus] = useState("");           // small message bar
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  // ---- map control state ----
  const [flyTarget, setFlyTarget] = useState(null);
  const [zoomNudge, setZoomNudge] = useState(0);
  const [userPosition, setUserPosition] = useState(null);
  const [mapCentre, setMapCentre] = useState(YAOUNDE_CENTER);

  // ---- routing state ----
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [travelMode, setTravelMode] = useState("driving-car");
  const [showSteps, setShowSteps] = useState(false);

  // ---- nearby-services state ----
  const [showServices, setShowServices] = useState(false);
  const [serviceOn, setServiceOn] = useState(Object.fromEntries(AMENITIES.map((a) => [a.id, false])));
  const [servicePlaces, setServicePlaces] = useState({});   // id -> array of places
  const [serviceLoading, setServiceLoading] = useState(null);

  // Load our own destinations once, when the screen first appears.
  useEffect(() => {
    api
      .getDestinations()
      .then(setDestinations)
      .catch(() => setStatus("Couldn't load map pins. Is the backend running?"));
  }, []);

  // Only offer a filter chip for categories that actually have places.
  const categories = useMemo(
    () => ["all", ...[...new Set(destinations.map((d) => d.category))].sort()],
    [destinations]
  );

  const visible = useMemo(
    () =>
      destinations.filter((d) => {
        const categoryMatches = activeCategory === "all" || d.category === activeCategory;
        const searchMatches =
          !search ||
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          (d.neighbourhood || "").toLowerCase().includes(search.toLowerCase());
        return categoryMatches && searchMatches;
      }),
    [destinations, activeCategory, search]
  );

  // -------------------------------------------------------------------
  // DIRECTIONS
  //
  // Asks our backend, which asks OpenRouteService. Starts from the user's
  // GPS position when we have one, and from the middle of the current view
  // when we don't - so the button still does something useful before anyone
  // grants location permission.
  // -------------------------------------------------------------------
  const routeTo = useCallback(
    async (destination, mode) => {
      const origin = userPosition || mapCentre;
      setRouteLoading(true);
      setShowSteps(false);
      setStatus("");
      try {
        const result = await api.getRoute(
          // GeoJSON order: longitude first.
          [[origin[1], origin[0]], [destination.longitude, destination.latitude]],
          mode
        );
        setRoute(result);
        if (result.source !== "openrouteservice") setStatus(result.note);
      } catch {
        setRoute(null);
        setStatus("Couldn't work out a route just now. Please try again.");
      } finally {
        setRouteLoading(false);
      }
    },
    [userPosition, mapCentre]
  );

  // Changing the travel mode while a route is on screen recalculates it.
  const changeTravelMode = (mode) => {
    setTravelMode(mode);
    if (route && selected) routeTo(selected, mode);
  };

  // Picking a different place clears the old route, so a line never dangles
  // between two places you aren't looking at any more.
  const selectDestination = (destination) => {
    setSelected(destination);
    setRoute(null);
    setShowSteps(false);
  };

  const clearSelection = () => {
    setSelected(null);
    setRoute(null);
    setShowSteps(false);
  };

  // -------------------------------------------------------------------
  // LIVE NEARBY SERVICES
  //
  // Overpass is a free public API for querying OpenStreetMap data. The
  // query below reads as: "find everything tagged as (say) a pharmacy
  // within 6 km of this point, and return it as JSON".
  //
  // It's a shared community service, so we only call it when the user
  // actually switches a layer on, we cache the answer, and we fail
  // politely if it's busy or the phone is offline.
  // -------------------------------------------------------------------
  const fetchService = useCallback(async (amenity, centre) => {
    setServiceLoading(amenity.id);
    const [key, value] = amenity.osmTag.split("=");
    const [lat, lng] = centre;
    const query = `
      [out:json][timeout:20];
      (
        node["${key}"="${value}"](around:6000,${lat},${lng});
        way["${key}"="${value}"](around:6000,${lat},${lng});
      );
      out center 40;`;

    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });
      const data = await response.json();
      const places = (data.elements || [])
        .map((element) => ({
          id: `${amenity.id}_${element.id}`,
          name: element.tags?.name || amenity.label.replace(/s$/, ""),
          // A "node" has lat/lon directly; a "way" (a building outline) has
          // its centre point under .center, hence the two fallbacks.
          lat: element.lat ?? element.center?.lat,
          lng: element.lon ?? element.center?.lon,
        }))
        .filter((p) => p.lat && p.lng);

      setServicePlaces((current) => ({ ...current, [amenity.id]: places }));
      setStatus(
        places.length
          ? `${places.length} ${amenity.label.toLowerCase()} found nearby.`
          : `No ${amenity.label.toLowerCase()} mapped in this area.`
      );
    } catch {
      setStatus("Couldn't reach OpenStreetMap for nearby places. Check your connection.");
      setServiceOn((current) => ({ ...current, [amenity.id]: false }));
    } finally {
      setServiceLoading(null);
    }
  }, []);

  const toggleService = (amenity) => {
    const turningOn = !serviceOn[amenity.id];
    setServiceOn((current) => ({ ...current, [amenity.id]: turningOn }));
    setStatus("");
    // Fetch only the first time; after that the results are already in state.
    if (turningOn && !servicePlaces[amenity.id]) fetchService(amenity, mapCentre);
  };

  // -------------------------------------------------------------------
  // DEVICE GPS
  // navigator.geolocation is built into every browser. It asks the user for
  // permission the first time, and browsers only allow it on https:// or on
  // localhost - so this works in development and in production, but not
  // over a plain http:// address on a phone.
  // -------------------------------------------------------------------
  const locateMe = () => {
    if (!navigator.geolocation) {
      setStatus("This browser can't share your location.");
      return;
    }
    setStatus("Finding your position...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = [position.coords.latitude, position.coords.longitude];
        setUserPosition(here);
        setFlyTarget(here);
        setStatus("");
      },
      () => setStatus("Location permission denied — showing the city centre instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // A secondary escape hatch: hand the destination to whatever maps app the
  // user already has, for actual turn-by-turn voice navigation on the road.
  // It's an ordinary web link, so no API key is involved.
  const openInMapsApp = (destination) => {
    const target = `${destination.latitude},${destination.longitude}`;
    const origin = userPosition ? `&origin=${userPosition[0]},${userPosition[1]}` : "";
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${target}${origin}`, "_blank", "noopener");
  };

  // Copy exact coordinates - handy for sending a spot over WhatsApp.
  const copyCoordinates = (destination) => {
    const text = `${destination.latitude.toFixed(5)}, ${destination.longitude.toFixed(5)}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isRealRoute = route?.source === "openrouteservice";
  const panel = {
    background: theme.cardSolid,
    border: `1px solid ${theme.border}`,
    backdropFilter: "blur(16px)",
  };

  return (
    <div className="gt-page gt-page--fill" style={{ background: theme.solidBg, position: "relative" }}>
      <style>{`
        @keyframes gtPinPulse { 0%,100% { transform: rotate(-45deg) scale(1); } 50% { transform: rotate(-45deg) scale(1.18); } }
        .gt-pin { background: transparent !important; border: none !important; }
        /* Leaflet paints its own background; match it to the theme so the
           edges don't flash white while tiles are still downloading. */
        .leaflet-container { background: ${dark ? "#0a1628" : "#eaf6f8"}; font-family: inherit; }
        /* "Dark mode" for a plain OpenStreetMap layer, no special dark tile
           set needed: invert lightness, then rotate the hue back so roads and
           water read naturally instead of looking like a photo negative. */
        .gt-dark-tiles { filter: invert(1) hue-rotate(200deg) brightness(0.92) contrast(0.88); }
        .leaflet-control-attribution { font-size: 9px !important; opacity: .75; }
        .leaflet-popup-content-wrapper { border-radius: 12px; }
        /* Keep OpenStreetMap's attribution visible above the nav row rather
           than hidden behind it - it's a licence requirement, not decoration. */
        .leaflet-bottom { bottom: var(--gt-nav-h); }
        /* The map itself is deliberately full-bleed: it runs underneath the
           translucent app header and nav row, which is what makes it feel
           like a map rather than a picture in a box. Everything laid ON TOP
           of it, though, has to clear those two bars - hence every offset
           below being measured from --gt-header-h / --gt-nav-h rather than
           from the edge of the screen. */
        .gt-map-overlay { top: calc(var(--gt-header-h) + 12px); }
        .gt-map-controls { top: calc(var(--gt-header-h) + 34vh); }

        /* The place card is a floating panel on a phone and a proper side
           panel on a wide screen, where there is room for one. */
        .gt-place-card {
          position: absolute; z-index: 1000;
          left: 14px; right: 14px;
          bottom: calc(var(--gt-nav-h) + 16px);
          max-height: 58%; overflow-y: auto;
        }
        @media (min-width: 900px) {
          .gt-place-card {
            left: 20px; right: auto; width: 380px; max-height: none;
            top: calc(var(--gt-header-h) + 150px);
            bottom: 20px;
          }
        }
      `}</style>

      {/* ===================== THE MAP ITSELF ===================== */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MapContainer
          center={YAOUNDE_CENTER}
          zoom={DEFAULT_ZOOM}
          zoomControl={false}          /* we draw our own +/- buttons */
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            className={dark ? "gt-dark-tiles" : ""}
            url={OSM_TILE_URL}
            attribution={OSM_ATTRIBUTION}
            maxZoom={19}
          />

          <MapController
            flyTarget={flyTarget}
            zoomNudge={zoomNudge}
            fitBounds={route?.geometry}
            onMoveEnd={(centre) => setMapCentre(centre)}
          />

          {/* The calculated route. Dashed when it's only an estimate, so the
              picture matches what the card says about where it came from. */}
          {route?.geometry?.length > 1 && (
            <Polyline
              positions={route.geometry}
              pathOptions={{
                color: theme.accent,
                weight: 6,
                opacity: 0.9,
                dashArray: isRealRoute ? undefined : "8 10",
              }}
            />
          )}

          {/* Where the user is standing */}
          {userPosition && (
            <>
              <Circle center={userPosition} radius={120} pathOptions={{ color: theme.accent, fillColor: theme.accent, fillOpacity: 0.22, weight: 2 }} />
              <Marker position={userPosition} icon={dotPin(theme.accent)}>
                <Popup>You are here</Popup>
              </Marker>
            </>
          )}

          {/* Service layers the user switched on */}
          {AMENITIES.filter((a) => serviceOn[a.id]).map((amenity) =>
            (servicePlaces[amenity.id] || []).map((place) => (
              <Marker key={place.id} position={[place.lat, place.lng]} icon={dotPin(amenity.color)}>
                <Popup>
                  <strong>{place.name}</strong>
                  <br />
                  {amenity.label.replace(/s$/, "")}
                </Popup>
              </Marker>
            ))
          )}

          {/* Our destinations */}
          {visible.map((d) => (
            <Marker
              key={d.id}
              position={[d.latitude, d.longitude]}
              icon={destinationPin(d.category, selected?.id === d.id)}
              eventHandlers={{ click: () => selectDestination(d) }}
            >
              <Popup>
                <strong>{d.name}</strong>
                <br />
                {d.neighbourhood || "Yaoundé"}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ===================== SEARCH + FILTERS ===================== */}
      <div className="gt-map-overlay" style={{ position: "absolute", left: 0, right: 0, padding: "0 var(--gt-gutter)", zIndex: 1000, pointerEvents: "none" }}>
        <div style={{ maxWidth: 620, pointerEvents: "auto" }}>
          <div style={{ ...panel, display: "flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "11px 15px", boxShadow: "0 6px 22px rgba(0,0,0,0.22)" }}>
            <Search size={15} color={theme.subtext} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search places in Yaoundé"
              style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 14, flex: 1, minWidth: 0 }}
            />
            {search && <X size={14} color={theme.subtext} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
          </div>
        </div>

        {/* Category chips */}
        <div className="gt-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 10, paddingBottom: 4, pointerEvents: "auto" }}>
          {categories.map((c) => {
            const isActive = activeCategory === c;
            const { color, label } = c === "all" ? { color: theme.accent, label: "All" } : styleFor(c);
            return (
              <div
                key={c}
                className="gt-chip"
                onClick={() => { setActiveCategory(c); clearSelection(); }}
                style={{
                  ...panel,
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 999,
                  fontSize: 12.5, fontWeight: 700, flexShrink: 0,
                  background: isActive ? color : theme.cardSolid,
                  color: isActive ? "#fff" : theme.text,
                  border: `1px solid ${isActive ? color : theme.border}`,
                }}
              >
                {c !== "all" && !isActive && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
                {label}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 8, fontSize: 11.5, color: theme.subtext, textShadow: dark ? "0 1px 4px rgba(0,0,0,.8)" : "none" }}>
          {visible.length} place{visible.length === 1 ? "" : "s"} on the map
        </div>
      </div>

      {/* ===================== RIGHT-HAND CONTROLS ===================== */}
      <div className="gt-map-controls" style={{ position: "absolute", right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 1000 }}>
        {[
          { icon: Plus, label: "Zoom in", onClick: () => setZoomNudge((n) => (n > 0 ? n + 1 : 1)) },
          { icon: Minus, label: "Zoom out", onClick: () => setZoomNudge((n) => (n < 0 ? n - 1 : -1)) },
          { icon: LocateFixed, label: "My location", onClick: locateMe },
          { icon: SlidersHorizontal, label: "Nearby services", onClick: () => setShowServices((v) => !v) },
          { icon: Layers, label: "Recentre on Yaoundé", onClick: () => setFlyTarget([...YAOUNDE_CENTER]) },
        ].map(({ icon: Icon, label, onClick }, i) => (
          <div
            key={i}
            className="gt-icon-btn"
            title={label}
            onClick={onClick}
            style={{ ...panel, width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.22)" }}
          >
            <Icon size={17} color={theme.text} />
          </div>
        ))}
      </div>

      {/* ===================== NEARBY SERVICES PANEL ===================== */}
      {showServices && (
        <div
          className="gt-fadeup gt-map-controls"
          style={{ ...panel, position: "absolute", right: 16, width: 218, borderRadius: 20, padding: "15px 16px", boxShadow: "0 14px 36px rgba(0,0,0,0.34)", zIndex: 1001 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: theme.text }}>Nearby services</span>
            <X size={15} color={theme.subtext} style={{ cursor: "pointer" }} onClick={() => setShowServices(false)} />
          </div>
          <p style={{ fontSize: 10.5, color: theme.subtext, margin: "0 0 12px", lineHeight: 1.45 }}>
            Live from OpenStreetMap, within 6 km of the map centre.
          </p>

          {AMENITIES.map((amenity) => {
            const Icon = amenity.icon;
            const isOn = serviceOn[amenity.id];
            const count = servicePlaces[amenity.id]?.length;
            return (
              <div
                key={amenity.id}
                className="gt-chip"
                onClick={() => toggleService(amenity)}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 3px", borderBottom: `1px solid ${theme.border}` }}
              >
                <div style={{ width: 26, height: 26, borderRadius: 8, background: `${amenity.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={13} color={amenity.color} />
                </div>
                <span style={{ flex: 1, fontSize: 12, color: theme.text, fontWeight: isOn ? 700 : 500 }}>
                  {amenity.label}
                  {isOn && count !== undefined && <span style={{ color: theme.subtext, fontWeight: 500 }}> · {count}</span>}
                </span>
                {serviceLoading === amenity.id ? (
                  <Loader2 className="gt-spin" size={14} color={theme.subtext} />
                ) : (
                  <div style={{ width: 30, height: 17, borderRadius: 999, background: isOn ? amenity.color : theme.border, position: "relative", transition: "background .2s ease", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2.5, left: isOn ? 15 : 2.5, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .2s ease" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== STATUS MESSAGE ===================== */}
      {status && !selected && (
        <div style={{ ...panel, position: "absolute", bottom: "calc(var(--gt-nav-h) + 20px)", left: 16, right: 16, maxWidth: 560, borderRadius: 14, padding: "11px 14px", fontSize: 12.5, color: theme.text, zIndex: 1000 }}>
          {status}
        </div>
      )}

      {/* ===================== SELECTED PLACE + ROUTE ===================== */}
      {selected && (
        <div
          className="gt-place-card gt-fadeup gt-scroll-y"
          style={{ ...panel, borderRadius: 24, padding: "17px 19px", boxShadow: "0 16px 40px rgba(0,0,0,0.36)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: styleFor(selected.category).color }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {styleFor(selected.category).label}
                </span>
              </div>

              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, color: theme.text, marginBottom: 5, lineHeight: 1.25 }}>
                {selected.name}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                <MapPin size={12} color={theme.subtext} />
                <span style={{ fontSize: 12, color: theme.subtext }}>{selected.neighbourhood || "Yaoundé"}</span>
                <Star size={12} fill="#fbbf24" color="#fbbf24" style={{ marginLeft: 3 }} />
                <span style={{ fontSize: 12, color: theme.subtext }}>{selected.rating}</span>
              </div>

              <div style={{ fontSize: 11.5, fontWeight: 700, color: theme.accent, marginBottom: 8 }}>
                {selected.price_range}
              </div>

              {/* The exact coordinates - tap to copy */}
              <div
                className="gt-chip"
                onClick={() => copyCoordinates(selected)}
                title="Copy coordinates"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: dark ? "rgba(255,255,255,0.06)" : "rgba(10,42,46,0.05)", border: `1px solid ${theme.border}`, borderRadius: 10, padding: "5px 9px", marginBottom: 9 }}
              >
                {copied ? <Check size={11} color="#22c55e" /> : <Copy size={11} color={theme.subtext} />}
                <span style={{ fontSize: 11, fontFamily: "monospace", color: theme.subtext }}>
                  {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                </span>
              </div>

              <p style={{ fontSize: 12.5, color: theme.subtext, lineHeight: 1.55, margin: 0 }}>{selected.description}</p>
            </div>
            <X size={17} color={theme.subtext} style={{ cursor: "pointer", flexShrink: 0 }} onClick={clearSelection} />
          </div>

          {/* ---------------- THE ROUTE ---------------- */}
          {route && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: theme.text }}>
                  {(route.distance_m / 1000).toFixed(1)} km
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, color: theme.accent }}>
                  {formatDuration(Math.max(1, Math.round(route.duration_s / 60)))}
                </span>

                {/* Switch between taxi and walking, recalculating as you go */}
                <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                  {TRAVEL_MODES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => changeTravelMode(id)}
                      className="gt-chip"
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                        border: `1px solid ${travelMode === id ? theme.accent : theme.border}`,
                        background: travelMode === id ? theme.accent : "transparent",
                        color: travelMode === id ? theme.accentText : theme.text,
                      }}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: route.steps?.length ? 10 : 0 }}>
                <Info size={12} color={theme.subtext} style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 10.5, color: theme.subtext, lineHeight: 1.5, margin: 0 }}>
                  {isRealRoute
                    ? `Following real streets, from OpenRouteService${userPosition ? "" : " — starting from the centre of the map, since we don't have your location yet"}.`
                    : route.note}
                </p>
              </div>

              {route.steps?.length > 0 && (
                <>
                  <button
                    onClick={() => setShowSteps((v) => !v)}
                    className="gt-btn"
                    style={{ padding: "8px 14px", borderRadius: 11, border: `1px solid ${theme.border}`, background: "transparent", color: theme.accent, fontWeight: 700, fontSize: 12 }}
                  >
                    {showSteps ? "Hide directions" : `Step-by-step (${route.steps.length})`}
                  </button>

                  {showSteps && (
                    <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                      {route.steps.map((step, i) => (
                        <li key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < route.steps.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: theme.subtext, minWidth: 16, flexShrink: 0 }}>{i + 1}.</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: theme.text, lineHeight: 1.5 }}>
                            {step.instruction}
                            {step.name && step.name !== "-" && <span style={{ color: theme.subtext }}> on {step.name}</span>}
                          </span>
                          <span style={{ fontSize: 10.5, color: theme.subtext, whiteSpace: "nowrap", flexShrink: 0 }}>
                            {step.distance_m >= 1000 ? `${(step.distance_m / 1000).toFixed(1)} km` : `${step.distance_m} m`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---------------- ACTIONS ---------------- */}
          <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => routeTo(selected, travelMode)}
              disabled={routeLoading}
              className="gt-btn"
              style={{ flex: 1, minWidth: 130, padding: "12px", borderRadius: 14, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {routeLoading ? <Loader2 size={14} className="gt-spin" /> : <Navigation size={14} />}
              {routeLoading ? "Routing..." : route ? "Recalculate" : "Directions"}
            </button>
            <button
              onClick={() => navigate(`/site/${selected.id}`)}
              className="gt-btn"
              style={{ flex: 1.25, minWidth: 130, padding: "12px", borderRadius: 14, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13 }}
            >
              Read the story
            </button>
          </div>

          {route && (
            <button
              onClick={() => openInMapsApp(selected)}
              className="gt-btn"
              style={{ width: "100%", marginTop: 9, padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: theme.subtext, fontWeight: 600, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <ExternalLink size={12} /> Open in your phone's maps app for voice navigation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
