import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { CATEGORIES } from "../lib/categories";
import { Search, Heart, MapPin, Star, Bot, TrendingUp, Compass, X } from "lucide-react";

// Backend fields don't map 1:1 to what this screen was designed to
// show (e.g. there's no "trending" field in the API yet), so this helper
// bridges backend shape -> the UI shape the mockup was built around.
function toCardShape(destination) {
  // Money is shown in FCFA (XAF), the currency actually used in Cameroon.
  // Each destination carries a human-readable `price_range`; the short
  // fallback below is only used if that field is missing.
  const shortPrice = {
    free: "Free",
    budget: "≤ 3 000 FCFA",
    mid: "3 000 – 15 000 FCFA",
    premium: "15 000+ FCFA",
  };
  const firstPhoto = (destination.media || []).find((m) => m.type === "photo");
  return {
    id: destination.id,
    name: destination.name,
    area: destination.neighbourhood || "Yaoundé",
    tag: destination.category,
    rating: destination.rating,
    price: destination.price_range || shortPrice[destination.price_level] || destination.price_level,
    trending: destination.rating >= 4.4,
    desc: destination.description,
    // Uploaded photo, if the place has one - shown as the card image
    // instead of the gradient placeholder.
    photo: firstPhoto ? api.mediaUrl(firstPhoto.url) : null,
  };
}

export default function DestinationsScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [loadError, setLoadError] = useState("");
  // Ids the logged-in user has already hearted, so the icon can render
  // filled instead of always looking un-liked.
  const [favoriteIds, setFavoriteIds] = useState([]);

  useEffect(() => {
    api.getFavorites().then((favs) => setFavoriteIds(favs.map((f) => f.id))).catch(() => setFavoriteIds([]));
  }, []);

  // One tap likes, another unlikes. We update the UI first so it feels
  // instant, then roll back if the request fails.
  const toggleFavorite = async (destinationId) => {
    const wasFavorite = favoriteIds.includes(destinationId);
    setFavoriteIds((ids) => (wasFavorite ? ids.filter((i) => i !== destinationId) : [...ids, destinationId]));
    try {
      if (wasFavorite) await api.removeFavorite(destinationId);
      else await api.addFavorite(destinationId);
    } catch {
      setFavoriteIds((ids) => (wasFavorite ? [...ids, destinationId] : ids.filter((i) => i !== destinationId)));
      setLoadError("Log in to save favourites.");
    }
  };

  // Fetch places from the backend once, on first load.
  useEffect(() => {
    api
      .getDestinations()
      .then((data) => setDestinations(data.map(toCardShape)))
      .catch(() => setLoadError("Couldn't load places. Is the backend running?"));
  }, []);

  // The category chips used to set state that nothing read, and the search
  // box wasn't wired to anything at all - you could type in it and filter by
  // category all day and the same cards stayed on screen. Both work now.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return destinations.filter((d) => {
      const categoryMatches = active === "all" || d.tag === active;
      const searchMatches =
        !needle ||
        d.name.toLowerCase().includes(needle) ||
        d.area.toLowerCase().includes(needle) ||
        (d.desc || "").toLowerCase().includes(needle);
      return categoryMatches && searchMatches;
    });
  }, [destinations, active, query]);

  // The featured card used to be a hard-coded place with a "View details"
  // button that did nothing. It's the top-rated real destination now, and
  // the button opens it.
  const featured = useMemo(
    () => [...destinations].sort((a, b) => b.rating - a.rating)[0],
    [destinations]
  );

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes gtFloaty { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6px);} }
        .gt-fab { animation: gtFloaty 3.5s ease-in-out infinite; }
      `}</style>

      {/* Ambient background glows for depth */}
      <div className="gt-glow" style={{ width: 320, height: 320, top: -80, right: -80, background: theme.accent, opacity: dark ? 0.12 : 0.25 }} />
      <div className="gt-glow" style={{ width: 260, height: 260, top: 420, left: -100, background: theme.accent, opacity: dark ? 0.08 : 0.15 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(24px, 3.2vw, 32px)", color: theme.text, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
          Yaoundé Destinations
        </h1>
        <p style={{ color: theme.subtext, fontSize: 14.5, margin: "0 0 20px", lineHeight: 1.5 }}>
          Explore landmarks, culture, and nature spots across the city.
        </p>

        {/* Featured hero card — the signature element */}
        {featured && (
          <Link
            to={`/site/${featured.id}`}
            className="gt-fadeup gt-card"
            style={{
              display: "block", textDecoration: "none",
              borderRadius: 28, padding: "clamp(22px, 3vw, 34px)", marginBottom: 22,
              position: "relative", overflow: "hidden",
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 45%, #2dd4bf 100%)",
              boxShadow: "0 20px 50px rgba(13,148,136,0.35)",
            }}
          >
            <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
            <div style={{ position: "absolute", bottom: -50, right: 60, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "relative", maxWidth: 560 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Compass size={14} color="#fff" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.9 }}>
                  Picked for you today
                </span>
              </div>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(20px, 2.6vw, 27px)", color: "#fff", margin: "0 0 8px" }}>
                {featured.name}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                <MapPin size={12} color="rgba(255,255,255,0.85)" />
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>{featured.area}</span>
                <span style={{ margin: "0 4px", color: "rgba(255,255,255,0.6)" }}>·</span>
                <Star size={12} fill="#fbbf24" color="#fbbf24" />
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>{featured.rating}</span>
              </div>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.92)", lineHeight: 1.55, margin: "0 0 16px" }}>{featured.desc}</p>
              <span style={{ display: "inline-block", background: "#fff", color: "#0f766e", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 700 }}>
                View details
              </span>
            </div>
          </Link>
        )}

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "13px 16px", marginBottom: 16, backdropFilter: "blur(16px)", maxWidth: 560 }}>
          <Search size={18} color={theme.subtext} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations by name, area or description..."
            style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 14, flex: 1, minWidth: 0 }}
          />
          {query && <X size={15} color={theme.subtext} className="gt-icon-btn" onClick={() => setQuery("")} />}
        </div>

        {/* Filter chips */}
        <div className="gt-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isActive = active === c.id;
            return (
              <div
                key={c.id}
                className="gt-chip"
                onClick={() => setActive(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                  padding: "7px 16px 7px 8px", borderRadius: 999,
                  background: isActive ? theme.chipActive : theme.chipBg,
                  border: `1px solid ${isActive ? theme.chipActive : theme.border}`,
                  color: isActive ? theme.accentText : theme.text,
                  fontSize: 13, fontWeight: 600,
                  boxShadow: isActive ? `0 6px 16px ${dark ? "rgba(94,234,212,0.3)" : "rgba(13,148,136,0.3)"}` : "none",
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: isActive ? "rgba(255,255,255,0.3)" : `radial-gradient(circle at 30% 25%, ${c.color}, ${c.color}aa)`,
                  boxShadow: isActive ? "none" : `0 3px 10px ${c.color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={13} color={isActive ? theme.accentText : "#fff"} strokeWidth={2.3} />
                </div>
                {c.label}
              </div>
            );
          })}
        </div>

        {loadError && (
          <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{loadError}</p>
        )}

        <p style={{ fontSize: 12.5, color: theme.subtext, margin: "0 0 14px" }}>
          {visible.length} place{visible.length === 1 ? "" : "s"}
          {active !== "all" && ` in ${CATEGORIES.find((c) => c.id === active)?.label}`}
          {query && ` matching "${query}"`}
        </p>

        {/* Destination cards - a responsive grid, so a wide window shows a
            wall of places instead of one narrow column down the middle. */}
        <div className="gt-grid">
          {visible.map((d, i) => (
            <div
              key={d.id}
              onClick={() => navigate(`/site/${d.id}`)}
              className="gt-card gt-fadeup"
              style={{
                animationDelay: `${Math.min(0.1 + i * 0.04, 0.6)}s`,
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: 24,
                overflow: "hidden",
                backdropFilter: "blur(20px)",
                boxShadow: theme.shadow,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 150,
                  background: d.photo
                    ? theme.inputBg
                    : `radial-gradient(circle at 30% 20%, hsl(${(170 + i * 25) % 360},60%,50%) 0%, hsl(${(170 + i * 25) % 360},55%,22%) 70%)`,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {d.photo ? (
                  <img src={d.photo} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <MapPin size={32} color="rgba(255,255,255,0.8)" />
                )}
                {d.trending && (
                  <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.4)", padding: "5px 10px", borderRadius: 999 }}>
                    <TrendingUp size={11} color="#fb923c" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Trending</span>
                  </div>
                )}
                <div
                  className="gt-icon-btn"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(d.id); }}
                  style={{ position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Heart
                    size={16}
                    color={favoriteIds.includes(d.id) ? "#ec4899" : "#fff"}
                    fill={favoriteIds.includes(d.id) ? "#ec4899" : "none"}
                  />
                </div>
              </div>
              <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: theme.text, lineHeight: 1.3 }}>{d.name}</span>
                  {d.price && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, background: dark ? "rgba(94,234,212,0.12)" : "rgba(13,148,136,0.12)", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", maxWidth: 165, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
                      {d.price}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  <MapPin size={12} color={theme.subtext} />
                  <span style={{ fontSize: 12, color: theme.subtext }}>{d.area}</span>
                  {d.rating != null && (
                    <>
                      <span style={{ margin: "0 4px", color: theme.subtext }}>·</span>
                      <Star size={12} fill="#fbbf24" color="#fbbf24" />
                      <span style={{ fontSize: 12, color: theme.subtext }}>{d.rating}</span>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 13, color: theme.subtext, lineHeight: 1.5, margin: "0 0 12px" }}>{d.desc}</p>
                {d.tag && (
                  <span
                    style={{
                      marginTop: "auto", alignSelf: "flex-start",
                      fontSize: 11, fontWeight: 600, color: theme.text,
                      background: theme.chipBg, border: `1px solid ${theme.border}`,
                      padding: "4px 10px", borderRadius: 999,
                    }}
                  >
                    {d.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {visible.length === 0 && !loadError && destinations.length > 0 && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 22, padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: theme.subtext, margin: "0 0 14px" }}>
              Nothing matches that yet.
            </p>
            <button
              onClick={() => { setQuery(""); setActive("all"); }}
              className="gt-btn"
              style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13 }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Floating AI assistant button - it opens the assistant now, which is
          what it always looked like it should do. */}
      <button
        onClick={() => navigate("/ai-chat")}
        aria-label="Ask the GlobeTrotter assistant"
        className="gt-fab gt-icon-btn"
        style={{
          position: "fixed",
          bottom: "calc(var(--gt-nav-h) + 20px)",
          right: 22,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: theme.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 10px 30px ${dark ? "rgba(94,234,212,0.4)" : "rgba(13,148,136,0.45)"}`,
          zIndex: 1100,
        }}
      >
        <Bot size={24} color={theme.accentText} />
      </button>
    </div>
  );
}
