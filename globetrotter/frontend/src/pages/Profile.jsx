import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Camera, Calendar, MapPin, Map, Heart, Compass as CompassIcon, Landmark, Church, Palette, Users, Coffee, TreePine, BookOpen, UtensilsCrossed, Martini, Mic2, PartyPopper, Mountain, Flower2, ShoppingBag, Baby, Gem, Coins, Laptop, Globe, LogOut, Check, Flame, Trophy, Binoculars } from "lucide-react";
import { api, authStorage } from "../api/client";
import { useTheme } from "../theme";
import { useLanguage } from "../i18n";

const INTERESTS = [
  { id: "landmarks", label: "Historical Landmarks", icon: Landmark, color: "#f97316" },
  { id: "museums", label: "Museums & Heritage", icon: Palette, color: "#ec4899" },
  { id: "religious", label: "Religious Sites", icon: Church, color: "#8b5cf6" },
  { id: "traditions", label: "Local Traditions & Craft", icon: Users, color: "#d97706" },
  { id: "arts", label: "Performing Arts & Cinema", icon: Mic2, color: "#7c3aed" },
  { id: "library", label: "Libraries & Archives", icon: BookOpen, color: "#6366f1" },
  { id: "streetfood", label: "Street Food", icon: Flame, color: "#ea580c" },
  { id: "restaurant", label: "Food & Restaurants", icon: UtensilsCrossed, color: "#ef4444" },
  { id: "cafe", label: "Cafés & Coffee", icon: Coffee, color: "#a16207" },
  { id: "shopping", label: "Markets & Shopping", icon: ShoppingBag, color: "#eab308" },
  { id: "nightlife", label: "Live Music & Nightlife", icon: Martini, color: "#db2777" },
  { id: "festivals", label: "Festivals & Events", icon: PartyPopper, color: "#f43f5e" },
  { id: "sports", label: "Football & Sport", icon: Trophy, color: "#0284c7" },
  { id: "nature", label: "Nature & Parks", icon: TreePine, color: "#22c55e" },
  { id: "viewpoints", label: "Viewpoints & Hills", icon: Binoculars, color: "#0d9488" },
  { id: "outdoor", label: "Outdoor & Hiking", icon: Mountain, color: "#16a34a" },
  { id: "hidden", label: "Hidden Gems & Day Trips", icon: Gem, color: "#a855f7" },
  { id: "wellness", label: "Wellness & Spas", icon: Flower2, color: "#f472b6" },
  { id: "family", label: "Family & Kids", icon: Baby, color: "#0ea5e9" },
  { id: "budget", label: "Budget-Friendly / Free", icon: Coins, color: "#10b981" },
  { id: "coworking", label: "Coworking & Remote Work", icon: Laptop, color: "#64748b" },
];

// The backend stores full labels (e.g. "Cafés"), this screen's chips
// use short ids (e.g. "cafe") - these two maps convert between them.
const LABEL_TO_ID = Object.fromEntries(INTERESTS.map((i) => [i.label, i.id]));
const ID_TO_LABEL = Object.fromEntries(INTERESTS.map((i) => [i.id, i.label]));

export default function ProfileScreen() {
  const navigate = useNavigate();
  // Both of these used to be local state, which meant the Theme and Language
  // switches on this screen changed nothing outside it. They now drive the
  // app-wide theme and language, the same ones the header toggle uses.
  const { dark, setDark, theme } = useTheme();
  const { lang, setLang } = useLanguage();
  const [selected, setSelected] = useState([]);
  const [about, setAbout] = useState("");
  const [user, setUser] = useState(null);
  const [itineraryCount, setItineraryCount] = useState(0);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
    api.getItineraries().then((data) => setItineraryCount(data.length)).catch(() => {});
    api
      .getPreferences()
      .then((prefs) => setSelected(prefs.interests.map((label) => LABEL_TO_ID[label]).filter(Boolean)))
      .catch(() => {});
  }, []);

  const handleSavePreferences = () => {
    const labels = selected.map((id) => ID_TO_LABEL[id]).filter(Boolean);
    if (labels.length === 0) return; // backend requires at least one interest
    api.savePreferences(labels, "Balanced", "₣₣").catch(() => {});
  };

  const handleLogout = () => {
    authStorage.clearToken();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  const toggleInterest = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        .gt-interest { cursor: pointer; transition: all .15s ease; }
        .gt-interest:active { transform: scale(0.95); }
      `}</style>

      <div className="gt-glow" style={{ width: 300, height: 300, top: -80, left: -80, background: theme.accent, opacity: dark ? 0.12 : 0.22 }} />

      {/* A settings form is capped rather than stretched: the app fills the
          window, but a 2000px-wide text field would be unusable. */}
      <div
        className="gt-container"
        style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40, maxWidth: 860, display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* Avatar + identity card */}
        <div className="gt-fadeup" style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 26, padding: "28px 22px", textAlign: "center", boxShadow: dark ? "0 18px 46px rgba(0,0,0,0.3)" : "0 18px 40px rgba(20,80,90,0.12)" }}>
          <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 14px" }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #ec4899, #f97316)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{initials}</span>
            </div>
            <div className="gt-icon-btn" style={{ position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: "50%", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${dark ? "#0f2138" : "#eaf6f8"}` }}>
              <Camera size={14} color={theme.accentText} />
            </div>
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(20px, 2.4vw, 25px)", color: theme.text, margin: "0 0 3px" }}>{user?.name || "Loading..."}</h1>
          <p style={{ fontSize: 13, color: theme.subtext, margin: "0 0 14px" }}>{user?.email || ""}</p>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: theme.text, background: theme.inputBg, border: `1px solid ${theme.border}`, padding: "6px 12px", borderRadius: 999 }}>
              <Calendar size={12} color="#22c55e" /> Member since Aug 2026
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: theme.text, background: theme.inputBg, border: `1px solid ${theme.border}`, padding: "6px 12px", borderRadius: 999 }}>
              <MapPin size={12} color="#f97316" /> Based in Yaoundé
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
            {[
              { label: "Itineraries", value: itineraryCount, icon: Map, color: "#6366f1" },
              { label: "Interests picked", value: selected.length, icon: Heart, color: "#ec4899" },
              { label: "Member since", value: "2026", icon: CompassIcon, color: "#22c55e" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <Icon size={16} color={s.color} />
                  <span style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: theme.subtext }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* About me */}
        <div className="gt-fadeup" style={{ animationDelay: "0.08s", background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "20px" }}>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 16, color: theme.text, margin: "0 0 12px" }}>About me</h3>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Tell fellow travellers a bit about yourself..."
            rows={3}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit" }}
          />
          <button style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 999, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Check size={13} /> Save
          </button>
        </div>

        {/* Areas of interest */}
        <div className="gt-fadeup" style={{ animationDelay: "0.14s", background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "20px" }}>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 16, color: theme.text, margin: "0 0 4px" }}>Areas of interest</h3>
          <p style={{ fontSize: 12.5, color: theme.subtext, margin: "0 0 14px", lineHeight: 1.5 }}>Pick a few things you enjoy — we'll use these to recommend Yaoundé spots for you.</p>
          <div className="gt-scroll-y" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, maxHeight: "min(46vh, 340px)", overflowY: "auto", paddingRight: 4 }}>
            {INTERESTS.map((it) => {
              const Icon = it.icon;
              const isOn = selected.includes(it.id);
              return (
                <div
                  key={it.id}
                  className="gt-interest"
                  onClick={() => toggleInterest(it.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 14px 8px 8px",
                    borderRadius: 999,
                    background: isOn ? it.color : theme.inputBg,
                    border: `1px solid ${isOn ? it.color : theme.border}`,
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: isOn ? "rgba(255,255,255,0.3)" : `radial-gradient(circle at 30% 25%, ${it.color}, ${it.color}aa)`,
                    boxShadow: isOn ? "none" : `0 3px 10px ${it.color}50`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <Icon size={13} color="#fff" strokeWidth={2.3} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: isOn ? "#fff" : theme.text }}>{it.label}</span>
                </div>
              );
            })}
          </div>
          <button onClick={handleSavePreferences} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 999, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Check size={13} /> Save
          </button>
        </div>

        {/* Language */}
        <div className="gt-fadeup" style={{ animationDelay: "0.18s", background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Globe size={17} color="#6366f1" />
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Language</span>
          </div>
          <div style={{ display: "flex", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 999, padding: 3 }}>
            {["en", "fr"].map((l) => (
              <div key={l} onClick={() => setLang(l)} style={{ padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: lang === l ? theme.accent : "transparent", color: lang === l ? theme.accentText : theme.subtext, display: "flex", alignItems: "center", gap: 4 }}>
                {lang === l && <Check size={11} />} {l === "en" ? "English" : "French"}
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="gt-fadeup" style={{ animationDelay: "0.22s", background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {dark ? <Moon size={17} color="#f97316" /> : <Sun size={17} color="#f97316" />}
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Theme</span>
          </div>
          <div style={{ display: "flex", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 999, padding: 3 }}>
            <div onClick={() => setDark(false)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: !dark ? theme.accent : "transparent", color: !dark ? theme.accentText : theme.subtext }}>Light</div>
            <div onClick={() => setDark(true)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: dark ? theme.accent : "transparent", color: dark ? theme.accentText : theme.subtext }}>Dark</div>
          </div>
        </div>

        {/* Logout */}
        <div className="gt-fadeup" style={{ animationDelay: "0.26s", background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: theme.subtext }}>Signed in as <b style={{ color: theme.text }}>{user?.name || "..."}</b></span>
          <div onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <LogOut size={15} /> Logout
          </div>
        </div>
      </div>
    </div>
  );
}
