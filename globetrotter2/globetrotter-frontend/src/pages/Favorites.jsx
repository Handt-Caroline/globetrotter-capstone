import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MapPin, Star, Route } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

const CATEGORY_COLORS = ["#f97316", "#8b5cf6", "#22c55e", "#6366f1", "#ec4899", "#0ea5e9", "#eab308", "#a855f7", "#a16207", "#ef4444"];
const CATEGORY_EMOJI = { "Cafés": "☕", "Nature & Parks": "🌳", "Art & Culture": "🎨", "Religious Sites": "⛪", "Historical Landmarks": "🏛️", "Food & Restaurants": "🍽️" };
function colorForCategory(category) {
  let hash = 0;
  for (const char of category || "") hash = (hash + char.charCodeAt(0)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[hash];
}

// Backend -> UI shape bridge, same pattern as other screens
function toFavoriteShape(destination) {
  return {
    id: destination.id,
    name: destination.name,
    area: destination.neighbourhood || "Yaoundé",
    rating: destination.rating,
    price: destination.price_range || "",
    tag: destination.category,
    color: colorForCategory(destination.category),
    emoji: CATEGORY_EMOJI[destination.category] || "📍",
  };
}

export default function FavoritesScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();
  const [favorites, setFavorites] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .getFavorites()
      .then((data) => setFavorites(data.map(toFavoriteShape)))
      .catch(() => setLoadError("Couldn't load favorites. Try logging in again."));
  }, []);

  const remove = (id) => {
    // Update the UI immediately (optimistic), then confirm with the
    // backend. If the delete call fails, put the card back so the
    // screen never lies about what's actually saved.
    const removedItem = favorites.find((f) => f.id === id);
    setFavorites((f) => f.filter((x) => x.id !== id));
    api.removeFavorite(id).catch(() => {
      if (removedItem) setFavorites((f) => [...f, removedItem]);
    });
  };

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes heartbeat { 0%,100% { transform: scale(1);} 50% { transform: scale(1.15);} }`}</style>

      <div className="gt-glow" style={{ width: 280, height: 280, top: -70, right: -80, background: "#ec4899", opacity: dark ? 0.13 : 0.2 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40 }}>
        <div className="gt-fadeup" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg,#ec4899,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Heart size={22} color="#fff" fill="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(21px, 2.6vw, 27px)", color: theme.text, margin: 0 }}>Your favorites \u2728</h1>
            <p style={{ fontSize: 12.5, color: theme.subtext, margin: 0 }}>
              {favorites.length} destination{favorites.length === 1 ? "" : "s"} saved for later
            </p>
          </div>
        </div>

        {/* This error was being collected and then never shown to anyone. */}
        {loadError && (
          <p style={{ color: "#ef4444", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{loadError}</p>
        )}

        {favorites.length === 0 ? (
          <div className="gt-fadeup" style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>\uD83D\uDC9B</div>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, color: theme.text, margin: "0 0 8px" }}>No favorites yet</h3>
            <p style={{ fontSize: 13, color: theme.subtext, margin: 0 }}>Tap the heart on any destination to save it here \uD83D\uDCCD</p>
          </div>
        ) : (
          <>
            {/* Quick action to turn favorites into a trip. It used to look
                like a button and do nothing; it opens the trip builder now. */}
            <div
              onClick={() => navigate("/itinerary/new")}
              className="gt-fadeup gt-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "linear-gradient(135deg,#0f766e,#0d9488)",
                borderRadius: 20,
                padding: "16px 18px",
                marginBottom: 18,
                boxShadow: "0 12px 30px rgba(13,148,136,0.3)",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Route size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Turn these into a trip \uD83D\uDDFA\uFE0F</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>Build one itinerary from all your favorites</div>
              </div>
            </div>

            <div className="gt-grid">
              {favorites.map((f, i) => (
                <div
                  key={f.id}
                  onClick={() => navigate(`/site/${f.id}`)}
                  className="gt-card gt-fadeup"
                  style={{
                    animationDelay: `${0.06 + i * 0.06}s`,
                    display: "flex",
                    gap: 12,
                    background: theme.card,
                    backdropFilter: "blur(20px)",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 20,
                    padding: 14,
                    boxShadow: dark ? "0 12px 32px rgba(0,0,0,0.25)" : "0 12px 28px rgba(20,80,90,0.1)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ width: 60, height: 60, borderRadius: 14, flexShrink: 0, background: `radial-gradient(circle at 30% 20%, ${f.color}cc, ${f.color}55)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: `0 6px 16px ${f.color}44` }}>
                    <MapPin size={22} color="#fff" />
                    <span style={{ position: "absolute", bottom: -6, right: -6, fontSize: 20, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}>{f.emoji}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: theme.text, lineHeight: 1.3 }}>{f.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "4px 0 6px" }}>
                      <MapPin size={11} color={theme.subtext} />
                      <span style={{ fontSize: 11.5, color: theme.subtext }}>{f.area}</span>
                      <Star size={11} fill="#fbbf24" color="#fbbf24" style={{ marginLeft: 4 }} />
                      <span style={{ fontSize: 11.5, color: theme.subtext }}>{f.rating}</span>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: f.color, background: `${f.color}18`, padding: "3px 9px", borderRadius: 999 }}>{f.tag}</span>
                  </div>
                  <div className="gt-icon-btn" onClick={(e) => { e.stopPropagation(); remove(f.id); }} style={{ alignSelf: "flex-start", color: theme.subtext }}>
                    <Heart size={18} fill="#ec4899" color="#ec4899" style={{ animation: "heartbeat 1.4s ease-in-out infinite" }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
