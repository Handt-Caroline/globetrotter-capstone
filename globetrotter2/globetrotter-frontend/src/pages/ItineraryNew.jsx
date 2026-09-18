// =============================================================================
// ItineraryNew.jsx  -  THE TRIP BUILDER
//
// This is the form that used to sit on top of the trips list, taking over the
// whole /itinerary page. It now has a screen of its own, which means the list
// stays a list and this stays a form. When you save, you land on the new
// trip's detail page - the thing you were building - instead of being dropped
// back at an empty form with your work scrolled off the bottom.
//
// The "other locations" strip near the bottom (places you haven't added yet)
// used to be a row of small dashed pills that could only do one thing: add a
// stop. They are proper cards now - big enough to read, showing the
// neighbourhood and rating - and they do the two different things people
// actually want separately: TAP THE CARD to open that place's own page
// (/site/:id, the one that already exists), or press Add to drop it into the
// trip without leaving this screen.
// =============================================================================

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Calendar, Clock, MapPin, Plus, Route, Search, Star, X, ChevronRight,
} from "lucide-react";
// Distance / duration / FCFA fare maths lives in its own file so it can be
// reused (and understood) on its own - see src/lib/travel.js
import { summariseTrip, formatFcfa, formatDuration } from "../lib/travel";
import { api } from "../api/client";
import { useTheme } from "../theme";

const CATEGORY_COLORS = ["#f97316", "#8b5cf6", "#22c55e", "#6366f1", "#ec4899", "#0ea5e9", "#eab308", "#a855f7", "#a16207", "#ef4444"];
function colorForCategory(category) {
  let hash = 0;
  for (const char of category || "") hash = (hash + char.charCodeAt(0)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[hash];
}

export default function ItineraryNewScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();

  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(240); // total available time, in minutes
  const [stops, setStops] = useState([]);      // stops added to this trip, each a real destination
  const [allDestinations, setAllDestinations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    api.getDestinations().then(setAllDestinations).catch(() => {});
  }, []);

  const removeStop = (id) => setStops(stops.filter((s) => s.id !== id));

  // How far apart the stops are, how long the day takes and what it costs.
  // `minutes` is the total time the user says they have; we split it evenly
  // between stops to estimate how long they'd linger at each one.
  const perStopMinutes = stops.length ? Math.max(20, Math.round(minutes / stops.length)) : 45;
  const trip = summariseTrip(stops, perStopMinutes);
  const overBudgetByMinutes = trip.totalMinutes - minutes;

  const addStop = (destination) => {
    if (stops.find((s) => s.id === destination.id)) return;
    setStops([
      ...stops,
      {
        id: destination.id,
        name: destination.name,
        color: colorForCategory(destination.category),
        // Coordinates are what make the distance and fare maths possible.
        latitude: destination.latitude,
        longitude: destination.longitude,
        neighbourhood: destination.neighbourhood,
      },
    ]);
  };

  const today = new Date().toISOString().split("T")[0];

  const searchResults = searchQuery
    ? allDestinations.filter(
        (d) => !stops.find((s) => s.id === d.id) && d.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // The "other locations" you could still add. Six, not four, because they
  // are laid out in a responsive grid now rather than squeezed onto one line.
  const otherLocations = allDestinations.filter((d) => !stops.find((s) => s.id === d.id)).slice(0, 6);

  const handleCreateItinerary = async () => {
    setErrorMessage("");
    if (!title.trim()) {
      setErrorMessage("Please give your itinerary a title.");
      return;
    }
    if (stops.length === 0) {
      setErrorMessage("Add at least one destination.");
      return;
    }

    setSaving(true);
    try {
      const stopsPayload = stops.map((s, i) => ({
        destination_id: s.id,
        order: i,
        duration_minutes: Math.max(15, Math.round(minutes / stops.length)),
      }));
      const created = await api.createItinerary(title, date, stopsPayload);
      // Straight to the trip you just made, not back to a blank form.
      navigate(`/itinerary/${created.id}`);
    } catch (err) {
      setErrorMessage(err.message || "Couldn't save this itinerary. Please try again.");
      setSaving(false);
    }
  };

  const label = (text) => (
    <label style={{ fontSize: 12, fontWeight: 700, color: theme.subtext, letterSpacing: "0.03em" }}>{text}</label>
  );

  const fieldStyle = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: 14,
    outline: "none",
  };

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: ${dark ? "invert(1)" : "none"}; }
        .gt-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
        .gt-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer; }
        .gt-slider::-moz-range-thumb { width: 20px; height: 20px; border: none; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer; }
        /* Two columns of form on a wide screen, one on a phone. */
        .gt-builder { display: grid; gap: 18px; grid-template-columns: 1fr; align-items: start; }
        @media (min-width: 1000px) { .gt-builder { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); } }
      `}</style>

      <div className="gt-glow" style={{ width: 300, height: 300, top: -70, right: -90, background: theme.accent, opacity: dark ? 0.12 : 0.22 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40 }}>
        <Link
          to="/itinerary"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to your trips
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Route size={17} color="#6366f1" />
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: 0 }}>
            Plan a new itinerary
          </h1>
        </div>

        <div className="gt-builder">
          {/* ================= LEFT: what the trip is ================= */}
          <div
            className="gt-fadeup"
            style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "22px 20px", boxShadow: theme.shadow }}
          >
            {label("ITINERARY TITLE")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Saturday city highlights"
              style={{ ...fieldStyle, marginTop: 6, marginBottom: 18 }}
            />

            {label("DESTINATIONS")}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 8, padding: "12px 14px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.inputBg }}>
              <Search size={16} color={theme.subtext} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destinations to add..."
                style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 14, flex: 1, minWidth: 0 }}
              />
              {searchQuery && <X size={15} color={theme.subtext} className="gt-icon-btn" onClick={() => setSearchQuery("")} />}
            </div>

            {searchResults.length > 0 && (
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {searchResults.slice(0, 5).map((d) => (
                  <div
                    key={d.id}
                    onClick={() => { addStop(d); setSearchQuery(""); }}
                    className="gt-btn"
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}` }}
                  >
                    <Plus size={14} color={theme.accent} />
                    <span style={{ fontSize: 13.5, color: theme.text, flex: 1, minWidth: 0 }}>{d.name}</span>
                    <span style={{ fontSize: 11.5, color: theme.subtext }}>{d.neighbourhood || "Yaoundé"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* The stops, in visiting order */}
            {stops.length === 0 ? (
              <p style={{ fontSize: 13, color: theme.subtext, margin: "4px 0 14px", lineHeight: 1.55 }}>
                No stops yet. Search above, or pick one of the locations on the right.
              </p>
            ) : (
              <div style={{ marginBottom: 14 }}>
                {stops.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
                      {i < stops.length - 1 && <div style={{ width: 2, height: 26, background: theme.border, marginTop: 2 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 12px" }}>
                      <Link
                        to={`/site/${s.id}`}
                        style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, textDecoration: "none", color: theme.text }}
                      >
                        <MapPin size={14} color={s.color} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>
                      </Link>
                      <X size={15} color={theme.subtext} className="gt-icon-btn" onClick={() => removeStop(s.id)} style={{ flexShrink: 0 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Leg-by-leg breakdown */}
            {trip.legs.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.subtext, letterSpacing: "0.03em", marginBottom: 8 }}>
                  GETTING BETWEEN STOPS
                </div>
                {trip.legs.map((leg, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", marginBottom: 6, borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}`, flexWrap: "wrap" }}
                  >
                    <span style={{ fontSize: 11.5, color: theme.subtext, flex: 1, minWidth: 130 }}>
                      {stops[i].name.split(" ").slice(0, 3).join(" ")} → {stops[i + 1].name.split(" ").slice(0, 3).join(" ")}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: theme.text }}>{leg.kmLabel}</span>
                    <span style={{ fontSize: 11.5, color: theme.subtext }}>
                      {leg.walkable ? `${leg.walkMinutes} min walk` : `${leg.driveMinutes} min by taxi`}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: theme.accent }}>
                      {leg.walkable ? "Free on foot" : formatFcfa(leg.fares.shared)}
                    </span>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {[
                    { label: "Distance", value: `${trip.totalKm.toFixed(1)} km` },
                    { label: "Travel time", value: formatDuration(trip.travelMinutes) },
                    { label: "Whole day", value: formatDuration(trip.totalMinutes) },
                  ].map((stat) => (
                    <div key={stat.label} style={{ flex: 1, minWidth: 92, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>{stat.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 150, background: dark ? "rgba(94,234,212,0.10)" : "rgba(13,148,136,0.10)", border: `1px solid ${theme.accent}55`, borderRadius: 14, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>Shared taxi + walking</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: theme.accent }}>{formatFcfa(trip.cheapFare)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 150, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>Private taxi all day</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{formatFcfa(trip.comfortableFare)}</div>
                  </div>
                </div>

                {overBudgetByMinutes > 0 && (
                  <p style={{ fontSize: 11.5, color: "#fbbf24", margin: "10px 0 0", lineHeight: 1.5 }}>
                    This plan needs about {formatDuration(overBudgetByMinutes)} more than the time you set.
                    Drop a stop, or give yourself a longer day.
                  </p>
                )}

                <p style={{ fontSize: 10.5, color: theme.subtext, margin: "10px 0 0", lineHeight: 1.5 }}>
                  These are quick straight-line estimates. Once you save the trip, its own page draws the real
                  street route from OpenRouteService.
                </p>
              </div>
            )}
          </div>

          {/* ================= RIGHT: when, how long, and other locations ================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              className="gt-fadeup"
              style={{ animationDelay: "0.06s", background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "22px 20px", boxShadow: theme.shadow }}
            >
              {label("TRIP DATE")}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 8, padding: "12px 14px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.inputBg }}>
                <Calendar size={16} color="#22c55e" />
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 14, flex: 1, minWidth: 0, colorScheme: dark ? "dark" : "light" }}
                />
              </div>
              <p style={{ fontSize: 11, color: theme.subtext, margin: "0 0 14px" }}>You can only plan from today onward.</p>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "12px 14px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.inputBg }}>
                <Clock size={16} color="#ec4899" />
                <span style={{ fontSize: 14, color: theme.text, flex: 1 }}>Start time: 9:00 AM</span>
              </div>

              {(() => {
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                const readable = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m}min`;
                const progress = ((minutes - 30) / (720 - 30)) * 100;
                return (
                  <>
                    {label(`AVAILABLE TIME: ${readable}`)}
                    <input
                      type="range"
                      min="30"
                      max="720"
                      step="15"
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      className="gt-slider"
                      style={{ width: "100%", marginTop: 10, marginBottom: 8, background: `linear-gradient(to right, ${theme.accent} ${progress}%, ${theme.border} ${progress}%)` }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: theme.subtext, marginBottom: 18 }}>
                      <span>30min</span>
                      <span>12h</span>
                    </div>
                  </>
                );
              })()}

              {errorMessage && (
                <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, margin: "-4px 0 12px" }}>{errorMessage}</p>
              )}

              <button
                onClick={handleCreateItinerary}
                disabled={saving}
                className="gt-btn"
                style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 15, boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.25)" : "rgba(13,148,136,0.3)"}`, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving..." : "Create Itinerary"}
              </button>
            </div>

            {/* ---------------- OTHER LOCATIONS ----------------
                Real cards instead of the old dashed pills. Tapping the card
                opens the place's existing detail page; Add puts it in the
                trip without leaving this screen. */}
            {otherLocations.length > 0 && (
              <div className="gt-fadeup" style={{ animationDelay: "0.12s" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18, color: theme.text, margin: 0 }}>
                    Other locations
                  </h2>
                  <Link to="/destinations" style={{ fontSize: 12.5, fontWeight: 700, color: theme.accent, textDecoration: "none" }}>
                    Browse all →
                  </Link>
                </div>

                <div className="gt-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 12 }}>
                  {otherLocations.map((d) => {
                    const color = colorForCategory(d.category);
                    return (
                      <div
                        key={d.id}
                        className="gt-card"
                        style={{ background: theme.card, backdropFilter: "blur(18px)", border: `1px solid ${theme.border}`, borderRadius: 18, padding: 14, boxShadow: theme.shadowSoft, display: "flex", flexDirection: "column", gap: 10 }}
                      >
                        <Link
                          to={`/site/${d.id}`}
                          style={{ display: "flex", gap: 11, textDecoration: "none", minWidth: 0 }}
                        >
                          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: `radial-gradient(circle at 30% 20%, ${color}cc, ${color}55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MapPin size={20} color="#fff" />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text, lineHeight: 1.3, marginBottom: 4 }}>{d.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11.5, color: theme.subtext }}>{d.neighbourhood || "Yaoundé"}</span>
                              <Star size={11} fill="#fbbf24" color="#fbbf24" style={{ marginLeft: 2 }} />
                              <span style={{ fontSize: 11.5, color: theme.subtext }}>{d.rating}</span>
                            </div>
                          </div>
                          <ChevronRight size={16} color={theme.subtext} style={{ flexShrink: 0, alignSelf: "center" }} />
                        </Link>

                        <button
                          onClick={() => addStop(d)}
                          className="gt-btn"
                          style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1px solid ${theme.accent}66`, background: dark ? "rgba(94,234,212,0.10)" : "rgba(13,148,136,0.10)", color: theme.accent, fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        >
                          <Plus size={14} /> Add to this trip
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
