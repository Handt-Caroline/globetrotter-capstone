// =============================================================================
// TopRated.jsx  -  "RATINGS" LEADERBOARD
//
// A ranked list of every destination by rating, best first. Reads GET
// /destinations/top-rated (see services/itinerary-service/app/social.py) -
// a place's rating there is the real average of everyone's votes once
// anyone has rated it, or the original seed number until then, so this
// page is honest about which is which (see the "N ratings" pill).
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, TrendingUp, ThumbsUp } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { CATEGORIES } from "../lib/categories";

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export default function TopRatedScreen() {
  const { dark, theme } = useTheme();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getTopRatedDestinations(50)
      .then(setDestinations)
      .catch((err) => setError(err.message || "Couldn't load ratings."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div
        className="gt-glow"
        style={{ width: 300, height: 300, top: -70, right: -90, background: theme.accent, opacity: dark ? 0.12 : 0.22 }}
      />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40, maxWidth: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fbbf2422", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={17} color="#fbbf24" />
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: 0 }}>
            Top rated
          </h1>
        </div>
        <p style={{ fontSize: 13, color: theme.subtext, margin: "0 0 20px", lineHeight: 1.55 }}>
          Ranked by real traveller ratings where any exist, our starting estimate otherwise.
        </p>

        {loading ? (
          <p style={{ color: theme.subtext, fontSize: 14 }}>Loading...</p>
        ) : error ? (
          <p style={{ color: "#ef4444", fontSize: 14, fontWeight: 600 }}>{error}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {destinations.map((d, i) => (
              <Link
                key={d.id}
                to={`/site/${d.id}`}
                className="gt-fadeup"
                style={{
                  animationDelay: `${Math.min(0.03 * i, 0.4)}s`,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 16,
                  padding: "12px 16px",
                  textDecoration: "none",
                  backdropFilter: "blur(16px)",
                }}
              >
                <span
                  style={{
                    width: 26,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: i < 3 ? "#fbbf24" : theme.subtext,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>
                    {CATEGORY_LABEL[d.category] || d.category} · {d.neighbourhood}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Star size={12} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{d.rating}</span>
                    {d.rating_count > 0 ? (
                      <span style={{ fontSize: 11, color: theme.subtext }}>({d.rating_count})</span>
                    ) : (
                      <span style={{ fontSize: 10.5, color: theme.subtext, fontStyle: "italic" }}>estimate</span>
                    )}
                  </div>
                  {d.like_count > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ThumbsUp size={11} color={theme.subtext} />
                      <span style={{ fontSize: 11, color: theme.subtext }}>{d.like_count}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
