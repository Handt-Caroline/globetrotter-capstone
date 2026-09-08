import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Heart, MapPin, Star, TrendingUp, Flame, RefreshCw, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

// Simple, deterministic color per category so cards look visually
// distinct without needing to import/maintain 18 separate icons here
// (that full icon+color list already lives in Destinations.jsx).
const CATEGORY_COLORS = ["#f97316", "#8b5cf6", "#22c55e", "#6366f1", "#ec4899", "#0ea5e9", "#eab308", "#a855f7"];
function colorForCategory(category) {
  let hash = 0;
  for (const char of category || "") hash = (hash + char.charCodeAt(0)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[hash];
}

// Backend -> UI shape bridge, same pattern used in Destinations.jsx
function toPickedShape(rec) {
  return {
    id: rec.id,
    name: rec.name,
    area: rec.neighbourhood || "Yaoundé",
    rating: rec.rating,
    match: rec.match_score,
    because: rec.reason,
    color: colorForCategory(rec.category),
  };
}

export default function ForYouScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();
  const [saved, setSaved] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [user, setUser] = useState(null);
  const [interests, setInterests] = useState([]);
  const [loadError, setLoadError] = useState("");

  const loadRecommendations = () => {
    setLoadError("");
    return api
      .getRecommendations()
      .then((data) => setRecommendations(data))
      .catch(() => setLoadError("Couldn't load your recommendations. Try logging in again."));
  };

  useEffect(() => {
    loadRecommendations();
    // Pre-fill the hearts with what the user has already saved.
    api.getFavorites().then((favs) => setSaved(favs.map((f) => f.id))).catch(() => setSaved([]));
    // The greeting used to be hard-coded to "Curated for Daniel" with an
    // invented list of interests. Both come from the account now.
    api.getMe().then(setUser).catch(() => {});
    api.getPreferences().then((prefs) => setInterests(prefs.interests || [])).catch(() => {});
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRecommendations().finally(() => setRefreshing(false));
  };

  // Highest-match-first (already sorted by the backend) for the main
  // "For You" picks; highest-rated for the "other locations" row below.
  const PICKED = recommendations.slice(0, 3).map(toPickedShape);
  const OTHER_LOCATIONS = [...recommendations]
    .sort((a, b) => b.rating - a.rating)
    .filter((r) => !PICKED.some((p) => p.id === r.id))
    .slice(0, 6);

  // Saving used to be local-only (a list of names in memory that vanished
  // on refresh). It now writes to POST/DELETE /favorites, so a place you
  // like here shows up on the Favourites screen.
  const toggleSave = async (destinationId) => {
    const wasSaved = saved.includes(destinationId);
    setSaved((s) => (wasSaved ? s.filter((i) => i !== destinationId) : [...s, destinationId]));
    try {
      if (wasSaved) await api.removeFavorite(destinationId);
      else await api.addFavorite(destinationId);
    } catch {
      setSaved((s) => (wasSaved ? [...s, destinationId] : s.filter((i) => i !== destinationId)));
      setLoadError("Couldn't save that — try logging in again.");
    }
  };

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`.gt-ring { transition: stroke-dashoffset .6s ease; }`}</style>

      <div className="gt-glow" style={{ width: 300, height: 300, top: -80, right: -80, background: theme.accent, opacity: dark ? 0.13 : 0.22 }} />
      <div className="gt-glow" style={{ width: 220, height: 220, top: 500, left: -90, background: "#ec4899", opacity: dark ? 0.08 : 0.14 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40 }}>
        {/* Intro */}
        <div className="gt-fadeup" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={23} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(21px, 2.6vw, 27px)", color: theme.text, margin: 0 }}>
              {firstName ? `Curated for ${firstName}` : "Curated for you"}
            </h1>
            <p style={{ fontSize: 13, color: theme.subtext, margin: 0 }}>
              {interests.length ? `Based on ${interests.slice(0, 3).join(", ")}` : "Pick your interests in Profile to sharpen these"}
            </p>
          </div>
        </div>

        {loadError && <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{loadError}</p>}

        {/* ---------------------- PICKED FOR YOU ---------------------- */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, color: theme.text, margin: 0 }}>Picked for you</h2>
          <button
            onClick={handleRefresh}
            className="gt-btn"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: theme.accent, fontSize: 12.5, fontWeight: 700 }}
          >
            <RefreshCw size={13} className={refreshing ? "gt-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="gt-grid gt-grid--wide" style={{ marginBottom: 34 }}>
          {PICKED.map((d, i) => {
            const isSaved = saved.includes(d.id);
            const circumference = 2 * Math.PI * 16;
            const offset = circumference - (d.match / 100) * circumference;
            return (
              <div
                key={d.id}
                onClick={() => navigate(`/site/${d.id}`)}
                className="gt-card gt-fadeup"
                style={{
                  animationDelay: `${0.05 + i * 0.07}s`,
                  display: "flex", gap: 12,
                  background: theme.card, backdropFilter: "blur(20px)",
                  border: `1px solid ${theme.border}`, borderRadius: 22,
                  padding: 15, boxShadow: theme.shadowSoft, cursor: "pointer",
                }}
              >
                <div style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, background: `radial-gradient(circle at 30% 20%, ${d.color}cc, ${d.color}55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={26} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: theme.text, lineHeight: 1.3 }}>{d.name}</span>
                    <Heart
                      size={17}
                      color={isSaved ? "#ec4899" : theme.subtext}
                      fill={isSaved ? "#ec4899" : "none"}
                      className="gt-icon-btn"
                      onClick={(e) => { e.stopPropagation(); toggleSave(d.id); }}
                      style={{ flexShrink: 0 }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "4px 0 7px", flexWrap: "wrap" }}>
                    <MapPin size={11} color={theme.subtext} />
                    <span style={{ fontSize: 11.5, color: theme.subtext }}>{d.area}</span>
                    <Star size={11} fill="#fbbf24" color="#fbbf24" style={{ marginLeft: 4 }} />
                    <span style={{ fontSize: 11.5, color: theme.subtext }}>{d.rating}</span>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: d.color, background: `${d.color}18`, padding: "3px 9px", borderRadius: 999 }}>
                    {d.because}
                  </span>
                </div>
                {/* Match score ring */}
                <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke={theme.border} strokeWidth="3" />
                    <circle
                      className="gt-ring"
                      cx="20" cy="20" r="16" fill="none"
                      stroke={theme.accent} strokeWidth="3"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      transform="rotate(-90 20 20)"
                    />
                  </svg>
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: theme.text }}>
                    {d.match}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------------------- OTHER LOCATIONS ----------------------

            WHAT CHANGED AND WHY
            This row used to be three 150px-wide cards in a horizontal
            scroller, showing a name and a rating - and nothing happened when
            you tapped one. They looked like places you could open, and they
            weren't links at all.

            They are now full-size cards in a responsive grid, each one a
            link to that place's existing page (/site/:id). No new screen was
            invented for them: they go to the same detail page every other
            list in the app already uses. */}
        {OTHER_LOCATIONS.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Flame size={17} color="#fb923c" />
                <h2 style={{ fontWeight: 700, fontSize: 16, color: theme.text, margin: 0 }}>Other locations in Yaoundé</h2>
              </div>
              <Link to="/destinations" style={{ fontSize: 12.5, fontWeight: 700, color: theme.accent, textDecoration: "none" }}>
                Browse all →
              </Link>
            </div>

            <div className="gt-grid">
              {OTHER_LOCATIONS.map((location, i) => {
                const color = colorForCategory(location.category);
                const isSaved = saved.includes(location.id);
                return (
                  <Link
                    key={location.id}
                    to={`/site/${location.id}`}
                    className="gt-card gt-fadeup"
                    style={{
                      animationDelay: `${0.25 + i * 0.05}s`,
                      display: "flex", flexDirection: "column",
                      textDecoration: "none",
                      background: theme.card, backdropFilter: "blur(20px)",
                      border: `1px solid ${theme.border}`, borderRadius: 20,
                      overflow: "hidden", boxShadow: theme.shadowSoft,
                    }}
                  >
                    {/* A proper header band, so each card reads as a place
                        rather than a chip with a number on it. */}
                    <div
                      style={{
                        height: 96,
                        background: `radial-gradient(circle at 30% 20%, ${color}dd, ${color}66)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <MapPin size={30} color="rgba(255,255,255,0.92)" />
                      <span
                        style={{
                          position: "absolute", top: 10, left: 10,
                          display: "flex", alignItems: "center", gap: 4,
                          background: "rgba(0,0,0,0.4)", padding: "4px 9px", borderRadius: 999,
                        }}
                      >
                        <TrendingUp size={10} color="#22c55e" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>
                          {location.rating.toFixed(1)}★ rated
                        </span>
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={isSaved ? "Remove from favourites" : "Save to favourites"}
                        className="gt-icon-btn"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(location.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); toggleSave(location.id); } }}
                        style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Heart size={14} color={isSaved ? "#ec4899" : "#fff"} fill={isSaved ? "#ec4899" : "none"} />
                      </span>
                    </div>

                    <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: theme.text, lineHeight: 1.3, marginBottom: 6 }}>
                        {location.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                        <MapPin size={11} color={theme.subtext} />
                        <span style={{ fontSize: 11.5, color: theme.subtext }}>{location.neighbourhood || "Yaoundé"}</span>
                        <span style={{ color: theme.subtext, opacity: 0.5 }}>·</span>
                        <span style={{ fontSize: 11.5, color: theme.subtext }}>{location.category}</span>
                      </div>
                      {location.description && (
                        <p style={{ fontSize: 12.5, color: theme.subtext, lineHeight: 1.5, margin: "0 0 12px" }}>
                          {location.description.length > 110 ? `${location.description.slice(0, 110)}…` : location.description}
                        </p>
                      )}
                      <span style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: theme.accent }}>
                        Open this place <ChevronRight size={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
