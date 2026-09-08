// =============================================================================
// Layout.jsx  -  THE APPLICATION SHELL
//
// WHAT WAS WRONG BEFORE
// ---------------------
// The nav bar was five unlabelled-looking icons crammed into a translucent
// strip, and the hamburger icon at the top of every screen was decorative -
// it opened nothing. Half the app (Favourites, Notifications, the AI chat,
// System health) had no route into it from the interface at all: you had to
// know the URL. Every screen also drew its own header, so the bell and the
// theme toggle were repeated five times and behaved differently in each.
//
// WHAT THIS IS NOW
// ----------------
//   - one header, on every screen: the menu button, the app name, the
//     notification bell (with a live unread count) and the theme toggle
//   - THE THREE MAIN DESTINATIONS - Explore, Map, Trips - always on a single
//     row: a bottom bar on a phone, and up in the header on a wide screen
//     where a bottom bar would just be wasted space
//   - the menu button opens a drawer listing ALL FIVE tabs, one per row,
//     followed by everything else in the app - Global Chat, Favourites,
//     Notifications, System health - so nothing is unreachable any more
// =============================================================================

import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Compass, Heart, Activity, LogOut, Map as MapIcon, MapPin, Menu, MessageCircle,
  Moon, Route, Sparkles, Sun, User, X, Bot,
} from "lucide-react";
import { useTheme } from "../theme";
import { useNotifications } from "../notifications";
import { authStorage } from "../api/client";

// The three main destinations. These are the ones that get the single row.
const MAIN_TABS = [
  { to: "/destinations", label: "Explore", icon: Compass },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/itinerary", label: "Trips", icon: Route },
];

// The drawer lists all five tabs one per row (the three above plus these two),
// then everything else the app can do.
const DRAWER_TABS = [
  ...MAIN_TABS,
  { to: "/for-you", label: "For You", icon: Sparkles },
  { to: "/profile", label: "Profile", icon: User },
];

const DRAWER_EXTRAS = [
  { to: "/places", label: "Manage places", icon: MapPin, hint: "Edit places, add photos & video" },
  { to: "/global-chat", label: "Global Chat", icon: MessageCircle, hint: "Talk to everyone in Yaounde" },
  { to: "/ai-chat", label: "AI Assistant", icon: Bot, hint: "Plan a trip by asking" },
  { to: "/favorites", label: "Favourites", icon: Heart, hint: "Places you saved" },
  { to: "/notifications", label: "Notifications", icon: Bell, hint: "Reminders and updates" },
  { to: "/system-health", label: "System health", icon: Activity, hint: "Live API metrics" },
];

export default function Layout() {
  const { dark, setDark, theme } = useTheme();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes, so tapping an entry doesn't
  // leave the panel sitting open over the screen it just opened.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Escape closes it too - a panel you can only dismiss with the mouse is a
  // panel that traps keyboard users.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    authStorage.clearToken();
    navigate("/login");
  };

  const iconButton = {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: theme.card,
    border: `1px solid ${theme.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.text,
    flexShrink: 0,
  };

  return (
    <div className="gt-shell" style={{ background: theme.bg, color: theme.text }}>
      <style>{`
        /* --- the three-destination row ---------------------------------- */
        /* Phone: a bottom bar. Desktop: the same three links, in the header. */
        .gt-nav-bottom { display: flex; }
        .gt-nav-top { display: none; }
        @media (min-width: 900px) {
          .gt-nav-bottom { display: none; }
          .gt-nav-top { display: flex; }
        }
        .gt-navlink {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; text-decoration: none; font-weight: 700;
          transition: background .18s ease, color .18s ease;
        }
        /* Bottom bar: icon over label, three equal columns, always one row. */
        .gt-nav-bottom .gt-navlink {
          flex: 1 1 0; min-width: 0; flex-direction: column; gap: 3px;
          font-size: 11.5px; padding: 8px 4px; border-radius: 14px;
        }
        /* Header row: icon beside label. */
        .gt-nav-top .gt-navlink {
          font-size: 13.5px; padding: 8px 16px; border-radius: 999px;
        }
        .gt-drawer-link {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 14px;
          text-decoration: none; font-size: 14.5px; font-weight: 600;
          transition: background .16s ease, transform .16s ease;
        }
        .gt-drawer-link:hover { transform: translateX(3px); }
        @keyframes gtSlideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes gtFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ===================== HEADER ===================== */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "var(--gt-header-h)",
          zIndex: 1200,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 var(--gt-gutter)",
          background: dark ? "rgba(10,22,40,0.88)" : "rgba(234,246,248,0.92)",
          backdropFilter: "blur(18px)",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="gt-icon-btn"
          style={{ ...iconButton, cursor: "pointer" }}
        >
          <Menu size={20} />
        </button>

        <NavLink
          to="/destinations"
          style={{
            fontFamily: "'Fraunces',serif",
            fontWeight: 600,
            fontSize: 18,
            color: theme.text,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          GlobeTrotter
        </NavLink>

        {/* The three main destinations, on one row, on wide screens. */}
        <nav className="gt-nav-top" style={{ gap: 6, marginLeft: 18, flex: 1 }} aria-label="Main">
          {MAIN_TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="gt-navlink"
              style={({ isActive }) => ({
                background: isActive ? theme.accent : "transparent",
                color: isActive ? theme.accentText : theme.subtext,
                border: `1px solid ${isActive ? theme.accent : "transparent"}`,
              })}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} className="gt-nav-bottom" aria-hidden="true" />

        {/* --- the bell. It is a button now, and it says how many are unread. */}
        <button
          onClick={() => navigate("/notifications")}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          className="gt-icon-btn"
          style={{ ...iconButton, cursor: "pointer", position: "relative" }}
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 19,
                height: 19,
                padding: "0 5px",
                borderRadius: 999,
                background: "#ef4444",
                color: "#fff",
                fontSize: 10.5,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${dark ? "#0a1628" : "#eaf6f8"}`,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setDark(!dark)}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          className="gt-icon-btn"
          style={{ ...iconButton, cursor: "pointer" }}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>

      {/* ===================== DRAWER ===================== */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 1300,
              animation: "gtFadeIn .18s ease",
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(310px, 86vw)",
              zIndex: 1301,
              background: dark ? "#0b1a30" : "#f4fbfc",
              borderRight: `1px solid ${theme.border}`,
              boxShadow: "8px 0 40px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              animation: "gtSlideIn .22s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 16px 12px",
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18, color: theme.text }}>
                GlobeTrotter
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="gt-icon-btn"
                style={{ ...iconButton, width: 34, height: 34, cursor: "pointer" }}
              >
                <X size={17} />
              </button>
            </div>

            <div className="gt-scroll-y" style={{ flex: 1, overflowY: "auto", padding: "12px 12px 20px" }}>
              {/* All five tabs, one per row. */}
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.subtext,
                  padding: "6px 14px 8px",
                }}
              >
                Browse
              </div>
              {DRAWER_TABS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className="gt-drawer-link"
                  style={({ isActive }) => ({
                    background: isActive ? theme.accent : "transparent",
                    color: isActive ? theme.accentText : theme.text,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} color={isActive ? theme.accentText : theme.accent} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}

              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.subtext,
                  padding: "18px 14px 8px",
                }}
              >
                More
              </div>
              {DRAWER_EXTRAS.map(({ to, label, icon: Icon, hint }) => (
                <NavLink
                  key={to}
                  to={to}
                  className="gt-drawer-link"
                  style={({ isActive }) => ({
                    background: isActive ? theme.accent : "transparent",
                    color: isActive ? theme.accentText : theme.text,
                    alignItems: "flex-start",
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} color={isActive ? theme.accentText : theme.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {label}
                          {to === "/notifications" && unreadCount > 0 && (
                            <span
                              style={{
                                minWidth: 18,
                                height: 18,
                                padding: "0 5px",
                                borderRadius: 999,
                                background: "#ef4444",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {unreadCount}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: isActive ? theme.accentText : theme.subtext }}>
                          {hint}
                        </span>
                      </span>
                    </>
                  )}
                </NavLink>
              ))}

              <button
                onClick={handleLogout}
                className="gt-drawer-link"
                style={{
                  width: "100%",
                  marginTop: 18,
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  color: "#ef4444",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <LogOut size={18} /> Log out
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ===================== THE ACTIVE SCREEN ===================== */}
      <Outlet />

      {/* ===================== THREE-DESTINATION ROW (phone) ===================== */}
      <nav
        className="gt-nav-bottom"
        aria-label="Main"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "var(--gt-nav-h)",
          zIndex: 1200,
          alignItems: "center",
          gap: 6,
          padding: "0 10px",
          background: dark ? "rgba(10,22,40,0.92)" : "rgba(234,246,248,0.95)",
          backdropFilter: "blur(18px)",
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        {MAIN_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="gt-navlink"
            style={({ isActive }) => ({
              background: isActive ? (dark ? "rgba(94,234,212,0.14)" : "rgba(13,148,136,0.12)") : "transparent",
              color: isActive ? theme.accent : theme.subtext,
            })}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
