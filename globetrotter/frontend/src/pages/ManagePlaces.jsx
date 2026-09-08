// =============================================================================
// ManagePlaces.jsx  -  EDIT / DELETE THE PLACES SHOWN ON EXPLORE
//
// Every place on Explore - the 28 the app ships with and any a traveller
// adds - is an editable record. This screen lists them all and gives each
// an Edit and a Delete control. Explore itself stays browse-only; a card
// there just opens the place's detail page.
//
// Same gt-grid of gt-cards as Explore, minus the featured hero, chips and
// favourite heart.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Image as ImageIcon, MapPin, Pencil, Plus, Search, Trash2, Video, X } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { CATEGORIES } from "../lib/categories";

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export default function ManagePlacesScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .getDestinations()
      .then(setPlaces)
      .catch((err) => setLoadError(err.message || "Couldn't load places."))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.neighbourhood || "").toLowerCase().includes(needle) ||
        (p.category || "").toLowerCase().includes(needle)
    );
  }, [places, query]);

  const handleDelete = async (place) => {
    if (!window.confirm(`Delete "${place.name}"? This also removes its photos and videos.`)) {
      return;
    }
    setActionError("");
    const previous = places;
    setPlaces((list) => list.filter((p) => p.id !== place.id));
    try {
      await api.deleteDestination(place.id);
    } catch (err) {
      setPlaces(previous);
      setActionError(err.message || "Couldn't delete that place. Are you logged in?");
    }
  };

  const firstPhoto = (place) => (place.media || []).find((m) => m.type === "photo");
  const countByType = (place, type) => (place.media || []).filter((m) => m.type === type).length;

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div
        className="gt-glow"
        style={{ width: 300, height: 300, top: -70, right: -90, background: theme.accent, opacity: dark ? 0.12 : 0.22 }}
      />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#0ea5e922", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={17} color="#0ea5e9" />
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: 0, flex: 1 }}>
            Manage places
          </h1>
          <button
            onClick={() => navigate("/places/new")}
            className="gt-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", borderRadius: 14, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13.5 }}
          >
            <Plus size={16} /> Add place
          </button>
        </div>

        <p style={{ fontSize: 13, color: theme.subtext, margin: "0 0 16px", lineHeight: 1.55 }}>
          Everything shown on Explore. Edit any place, add photos or a short video, or remove it.
        </p>

        {/* search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "12px 15px", marginBottom: 16, maxWidth: 480 }}>
          <Search size={17} color={theme.subtext} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, area or category..."
            style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 14, flex: 1, minWidth: 0 }}
          />
          {query && <X size={15} color={theme.subtext} className="gt-icon-btn" onClick={() => setQuery("")} />}
        </div>

        {actionError && (
          <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, margin: "0 0 14px" }}>{actionError}</p>
        )}

        {loading ? (
          <p style={{ fontSize: 14, color: theme.subtext }}>Loading places...</p>
        ) : loadError ? (
          <p style={{ fontSize: 14, color: "#ef4444", fontWeight: 600 }}>{loadError}</p>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: theme.subtext, margin: "0 0 14px" }}>
              {visible.length} place{visible.length === 1 ? "" : "s"}
            </p>
            <div className="gt-grid">
              {visible.map((place, i) => {
                const photo = firstPhoto(place);
                const photos = countByType(place, "photo");
                const videos = countByType(place, "video");
                return (
                  <div
                    key={place.id}
                    className="gt-card gt-fadeup"
                    style={{
                      animationDelay: `${Math.min(0.06 + i * 0.03, 0.5)}s`,
                      background: theme.card,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 22,
                      overflow: "hidden",
                      backdropFilter: "blur(18px)",
                      boxShadow: theme.shadow,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Link
                      to={`/site/${place.id}`}
                      style={{
                        height: 150,
                        position: "relative",
                        flexShrink: 0,
                        background: photo
                          ? theme.inputBg
                          : `radial-gradient(circle at 30% 20%, hsl(${(200 + i * 33) % 360},60%,50%) 0%, hsl(${(200 + i * 33) % 360},55%,22%) 70%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {photo ? (
                        <img src={api.mediaUrl(photo.url)} alt={place.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <MapPin size={32} color="rgba(255,255,255,0.85)" />
                      )}
                      {(photos > 0 || videos > 0) && (
                        <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 6 }}>
                          {photos > 0 && (
                            <span style={countPillStyle}>
                              <ImageIcon size={11} /> {photos}
                            </span>
                          )}
                          {videos > 0 && (
                            <span style={countPillStyle}>
                              <Video size={11} /> {videos}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>

                    <div style={{ padding: "15px 17px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                        <Link
                          to={`/site/${place.id}`}
                          style={{ fontWeight: 700, fontSize: 16, color: theme.text, lineHeight: 1.3, textDecoration: "none" }}
                        >
                          {place.name}
                        </Link>
                        {place.category && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: theme.accent,
                              background: dark ? "rgba(94,234,212,0.12)" : "rgba(13,148,136,0.12)",
                              padding: "3px 9px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {CATEGORY_LABEL[place.category] || place.category}
                          </span>
                        )}
                      </div>

                      {place.description && (
                        <p
                          style={{
                            fontSize: 13,
                            color: theme.subtext,
                            lineHeight: 1.5,
                            margin: "0 0 12px",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {place.description}
                        </p>
                      )}

                      <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                        <Link
                          to={`/places/${place.id}/edit`}
                          className="gt-btn"
                          style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "9px 12px",
                            borderRadius: 12,
                            border: `1px solid ${theme.border}`,
                            background: theme.inputBg,
                            color: theme.text,
                            fontWeight: 700,
                            fontSize: 12.5,
                            textDecoration: "none",
                          }}
                        >
                          <Pencil size={13} /> Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(place)}
                          className="gt-btn"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "9px 14px",
                            borderRadius: 12,
                            border: `1px solid ${dark ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.35)"}`,
                            background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
                            color: "#ef4444",
                            fontWeight: 700,
                            fontSize: 12.5,
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {visible.length === 0 && (
              <div style={{ background: theme.card, border: `1px dashed ${theme.border}`, borderRadius: 20, padding: "36px 24px", textAlign: "center" }}>
                <p style={{ fontSize: 14, color: theme.subtext, margin: "0 0 14px" }}>
                  {query ? "Nothing matches that." : "No places yet."}
                </p>
                <button
                  onClick={() => (query ? setQuery("") : navigate("/places/new"))}
                  className="gt-btn"
                  style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13 }}
                >
                  {query ? "Clear search" : "Add the first place"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const countPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "rgba(0,0,0,0.5)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 999,
};
