// =============================================================================
// Itinerary.jsx  -  YOUR TRIPS (OVERVIEW ONLY)
//
// WHAT CHANGED AND WHY
// --------------------
// This screen used to be everything at once: the whole builder form (title,
// search, stops, leg-by-leg distances, fares, date, time slider, save button)
// AND the list of every trip you had ever saved, stacked underneath it. The
// page grew without limit, and there was no way to look at one trip on its
// own - a trip's details only existed while you were building it.
//
// It is now an overview and nothing else: one card per trip, each a link to
// that trip's own page. Building a new trip is its own screen too
// (/itinerary/new), so this list stays short and scannable however many
// trips you have.
//
//   /itinerary        <- you are here: the list
//   /itinerary/new    <- the builder
//   /itinerary/:id    <- one trip, in full
// =============================================================================

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Calendar, ChevronRight, MapPin, Plus, Route, Sparkles, Map, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { summariseTrip, formatDuration } from "../lib/travel";

export default function ItineraryScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();

  const [itineraries, setItineraries] = useState([]);
  const [destinationsById, setDestinationsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Both are needed together: the list endpoint stores stops as ids, and a
    // card that says "3 stops" is far less useful than one that names them.
    Promise.all([
      api.getItineraries(),
      api.getDestinations().catch(() => []),
    ])
      .then(([trips, destinations]) => {
        setItineraries(trips);
        setDestinationsById(Object.fromEntries(destinations.map((d) => [d.id, d])));
      })
      .catch(() => setErrorMessage("Couldn't load your trips. Try logging in again."))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    const previous = itineraries;
    setItineraries((list) => list.filter((it) => it.id !== id));
    try {
      await api.deleteItinerary(id);
    } catch {
      setItineraries(previous); // put it back rather than lie about it being gone
      setErrorMessage("Couldn't delete that trip. Please try again.");
    }
  };

  // A one-line summary per card, worked out from the stops we can resolve.
  const summarise = (itinerary) => {
    const stops = [...itinerary.stops]
      .sort((a, b) => a.order - b.order)
      .map((s) => destinationsById[s.destination_id])
      .filter(Boolean);
    const trip = summariseTrip(stops, 45);
    return { stops, names: stops.map((s) => s.name), trip };
  };

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div className="gt-glow" style={{ width: 320, height: 320, top: -80, right: -90, background: theme.accent, opacity: dark ? 0.12 : 0.22 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40 }}>
        {/* Page heading + the one action this screen offers */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(24px, 3vw, 30px)", color: theme.text, margin: "0 0 4px" }}>
              Your trips
            </h1>
            <p style={{ color: theme.subtext, fontSize: 14, margin: 0 }}>
              {loading
                ? "Loading..."
                : `${itineraries.length} itinerar${itineraries.length === 1 ? "y" : "ies"} saved. Open one to see its route, timings and fares.`}
            </p>
          </div>

          <button
            onClick={() => navigate("/itinerary/new")}
            className="gt-btn"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "13px 22px", borderRadius: 16, border: "none",
              background: theme.accent, color: theme.accentText,
              fontWeight: 700, fontSize: 14.5,
              boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.25)" : "rgba(13,148,136,0.3)"}`,
            }}
          >
            <Plus size={17} /> Plan a new trip
          </button>
        </div>

        {errorMessage && (
          <p style={{ color: "#ef4444", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{errorMessage}</p>
        )}

        {/* ---------------------------- THE LIST ---------------------------- */}
        {!loading && itineraries.length > 0 && (
          <div className="gt-grid gt-grid--wide">
            {itineraries.map((it, i) => {
              const { stops, names, trip } = summarise(it);
              return (
                <Link
                  key={it.id}
                  to={`/itinerary/${it.id}`}
                  className="gt-card gt-fadeup"
                  style={{
                    animationDelay: `${0.04 + i * 0.05}s`,
                    display: "flex", flexDirection: "column",
                    textDecoration: "none",
                    background: theme.card,
                    backdropFilter: "blur(20px)",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 22,
                    padding: "18px 20px",
                    boxShadow: theme.shadowSoft,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 11, background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Route size={17} color="#6366f1" />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 16.5, color: theme.text, lineHeight: 1.3 }}>{it.title}</span>
                    </div>
                    <ChevronRight size={18} color={theme.subtext} style={{ flexShrink: 0, marginTop: 9 }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "12px 0 10px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: theme.subtext }}>
                      <Calendar size={13} color="#22c55e" /> {it.date}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: theme.subtext }}>
                      <MapPin size={13} color="#f97316" /> {it.stops.length} stop{it.stops.length === 1 ? "" : "s"}
                    </span>
                    {stops.length > 1 && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.accent }}>
                        {trip.totalKm.toFixed(1)} km · {formatDuration(trip.travelMinutes)} travelling
                      </span>
                    )}
                  </div>

                  {/* The stop names, so the card says what the trip actually is */}
                  {names.length > 0 && (
                    <p style={{ fontSize: 12.5, color: theme.subtext, lineHeight: 1.5, margin: "0 0 14px" }}>
                      {names.slice(0, 3).join(" → ")}
                      {names.length > 3 ? ` → +${names.length - 3} more` : ""}
                    </p>
                  )}

                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.accent }}>View full itinerary</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Delete ${it.title}`}
                      className="gt-icon-btn"
                      onClick={(e) => handleDelete(e, it.id)}
                      onKeyDown={(e) => e.key === "Enter" && handleDelete(e, it.id)}
                      style={{ display: "flex", alignItems: "center", color: theme.subtext }}
                    >
                      <Trash2 size={15} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ---------------------------- EMPTY STATE ---------------------------- */}
        {!loading && itineraries.length === 0 && (
          <div
            className="gt-fadeup"
            style={{
              background: theme.card, backdropFilter: "blur(20px)",
              border: `1px solid ${theme.border}`, borderRadius: 24,
              padding: "48px 24px", textAlign: "center", boxShadow: theme.shadow,
            }}
          >
            <div style={{ width: 62, height: 62, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <Map size={28} color="#fff" />
            </div>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 19, color: theme.text, margin: "0 0 10px" }}>
              Your next adventure begins here. <Sparkles size={16} color="#fbbf24" style={{ display: "inline", verticalAlign: "-2px" }} />
            </h3>
            <p style={{ fontSize: 14, color: theme.subtext, lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 420 }}>
              Pick the places you've always dreamed of visiting, create your perfect journey, and turn every
              destination into a story worth telling.
            </p>
            <button
              onClick={() => navigate("/itinerary/new")}
              className="gt-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 24px", borderRadius: 16, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 14.5 }}
            >
              <Plus size={17} /> Plan your first trip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
