import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme";
import { Sun, Moon, Landmark, Church, Palette, Users, Coffee, TreePine, BookOpen, UtensilsCrossed, Martini, Mic2, PartyPopper, Mountain, Flower2, ShoppingBag, Baby, Gem, Coins, Laptop, ChevronRight, ChevronLeft, Check, Sparkles, Gauge, Wallet, Flame, Trophy, Binoculars, Camera } from "lucide-react";
import { api } from "../api/client";

const INTERESTS = [
  // --- Culture & heritage ---
  { id: "landmarks", label: "Historical Landmarks", icon: Landmark, color: "#f97316" },
  { id: "museums", label: "Museums & Heritage", icon: Palette, color: "#ec4899" },
  { id: "religious", label: "Religious Sites", icon: Church, color: "#8b5cf6" },
  { id: "traditions", label: "Local Traditions & Craft", icon: Users, color: "#d97706" },
  { id: "arts", label: "Performing Arts & Cinema", icon: Mic2, color: "#7c3aed" },
  { id: "library", label: "Libraries & Archives", icon: BookOpen, color: "#6366f1" },
  // --- Food & drink ---
  { id: "streetfood", label: "Street Food", icon: Flame, color: "#ea580c" },
  { id: "restaurant", label: "Food & Restaurants", icon: UtensilsCrossed, color: "#ef4444" },
  { id: "cafe", label: "Cafés & Coffee", icon: Coffee, color: "#a16207" },
  { id: "shopping", label: "Markets & Shopping", icon: ShoppingBag, color: "#eab308" },
  // --- Going out ---
  { id: "nightlife", label: "Live Music & Nightlife", icon: Martini, color: "#db2777" },
  { id: "festivals", label: "Festivals & Events", icon: PartyPopper, color: "#f43f5e" },
  { id: "sports", label: "Football & Sport", icon: Trophy, color: "#0284c7" },
  // --- Outdoors ---
  { id: "nature", label: "Nature & Parks", icon: TreePine, color: "#22c55e" },
  { id: "viewpoints", label: "Viewpoints & Hills", icon: Binoculars, color: "#0d9488" },
  { id: "photography", label: "Photography Spots", icon: Camera, color: "#f59e0b" },
  { id: "outdoor", label: "Outdoor & Hiking", icon: Mountain, color: "#16a34a" },
  { id: "hidden", label: "Hidden Gems & Day Trips", icon: Gem, color: "#a855f7" },
  // --- Practical ---
  { id: "wellness", label: "Wellness & Spas", icon: Flower2, color: "#f472b6" },
  { id: "family", label: "Family & Kids", icon: Baby, color: "#0ea5e9" },
  { id: "budget", label: "Budget-Friendly / Free", icon: Coins, color: "#10b981" },
  { id: "coworking", label: "Coworking & Remote Work", icon: Laptop, color: "#64748b" },
];

const PACES = [
  { id: "relaxed", label: "Relaxed", desc: "1–2 stops a day, plenty of downtime" },
  { id: "balanced", label: "Balanced", desc: "3–4 stops, a mix of activity and rest" },
  { id: "packed", label: "Packed", desc: "5+ stops, make the most of every day" },
];

const BUDGETS = [
  { id: "free", label: "Free & low-cost", symbol: "0 – 2 000 FCFA" },
  { id: "mid", label: "Moderate", symbol: "2 000 – 15 000 FCFA" },
  { id: "premium", label: "Premium", symbol: "15 000+ FCFA" },
];

// The backend stores full category names (e.g. "Historical Landmarks")
// as interests, matching each destination's "category" field - not
// these short UI ids. Same for pace/budget: the UI uses short ids for
// styling, the backend expects the human-readable label.
const INTEREST_ID_TO_LABEL = Object.fromEntries(INTERESTS.map((i) => [i.id, i.label]));
const PACE_ID_TO_LABEL = { relaxed: "Relaxed", balanced: "Balanced", packed: "Packed" };
const BUDGET_ID_TO_SYMBOL = { free: "₣", mid: "₣₣", premium: "₣₣₣" }; // backend keeps the short symbol

export default function OnboardingScreen() {
  const navigate = useNavigate();
  // Shares the app-wide theme, so the choice made here is still in
  // effect once you're inside the app - see src/theme.jsx.
  const { dark, setDark, theme } = useTheme();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState([]);
  const [pace, setPace] = useState("balanced");
  const [budget, setBudget] = useState("mid");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const toggleInterest = (id) =>
    setInterests((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));

  const steps = ["Interests", "Pace", "Budget"];
  const canContinue = step === 0 ? interests.length > 0 : true;
  const isLast = step === steps.length - 1;

  // Called only on the final "Start exploring" tap. Converts the
  // short UI ids into the labels the backend expects, saves them,
  // then moves into the main app.
  const handleFinish = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await api.savePreferences(
        interests.map((id) => INTEREST_ID_TO_LABEL[id]),
        PACE_ID_TO_LABEL[pace],
        BUDGET_ID_TO_SYMBOL[budget]
      );
      navigate("/destinations");
    } catch (err) {
      setSaveError(err.message || "Couldn't save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryButton = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "'Manrope','Segoe UI',sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        .gt-icon-btn { transition: transform .15s ease; cursor: pointer; }
        .gt-icon-btn:hover { transform: scale(1.08); }
        .gt-icon-btn:active { transform: scale(0.9); }
        .gt-fadeup { opacity: 0; transform: translateY(18px); animation: fadeUp .5s ease forwards; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        .gt-glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
        .gt-tile { cursor: pointer; transition: all .15s ease; }
        .gt-tile:active { transform: scale(0.96); }
        .gt-opt { cursor: pointer; transition: all .15s ease; }
        .gt-scroll::-webkit-scrollbar { width: 4px; }
        .gt-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      <div className="gt-glow" style={{ width: 300, height: 300, top: -80, right: -80, background: theme.accent, opacity: dark ? 0.12 : 0.22 }} />
      <div className="gt-glow" style={{ width: 240, height: 240, bottom: -60, left: -80, background: "#ec4899", opacity: dark ? 0.07 : 0.14 }} />

      {/* Top bar: back + theme toggle + skip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 8px", position: "relative", zIndex: 1 }}>
        {step > 0 ? (
          <div className="gt-icon-btn" onClick={() => setStep(step - 1)} style={{ width: 36, height: 36, borderRadius: "50%", background: theme.card, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={18} color={theme.text} />
          </div>
        ) : <div style={{ width: 36 }} />}

        <div style={{ display: "flex", gap: 6 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 22 : 8, height: 6, borderRadius: 999, background: i <= step ? theme.accent : theme.border, transition: "all .25s ease" }} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="gt-icon-btn" onClick={() => setDark(!dark)} style={{ color: theme.text }}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </div>
          <span style={{ fontSize: 12.5, color: theme.subtext, fontWeight: 700, cursor: "pointer" }}>Skip</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: "10px 22px 24px", position: "relative", zIndex: 1, display: "flex", flexDirection: "column" }}>
        {step === 0 && (
          <div key="s0" className="gt-fadeup" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Sparkles size={14} color="#fbbf24" />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: theme.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 1 of 3</span>
            </div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 26, color: theme.text, margin: "0 0 8px", lineHeight: 1.2 }}>
              What draws you to Yaoundé?
            </h1>
            <p style={{ fontSize: 14, color: theme.subtext, margin: "0 0 22px", lineHeight: 1.5 }}>
              Pick as many as you like — we'll use these to shape your recommendations.
            </p>

            <div className="gt-scroll" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
              {INTERESTS.map((it) => {
                const Icon = it.icon;
                const on = interests.includes(it.id);
                return (
                  <div
                    key={it.id}
                    className="gt-tile"
                    onClick={() => toggleInterest(it.id)}
                    style={{
                      position: "relative",
                      borderRadius: 20,
                      padding: "18px 14px",
                      background: on ? it.color : theme.card,
                      border: `1.5px solid ${on ? it.color : theme.border}`,
                      backdropFilter: "blur(16px)",
                      boxShadow: on ? `0 10px 24px ${it.color}55` : "none",
                    }}
                  >
                    {on && (
                      <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                    <div style={{
                      width: 38, height: 38, borderRadius: 13,
                      background: on ? "rgba(255,255,255,0.3)" : `radial-gradient(circle at 30% 25%, ${it.color}, ${it.color}aa)`,
                      boxShadow: on ? "none" : `0 4px 14px ${it.color}50`,
                      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10
                    }}>
                      <Icon size={19} color="#fff" strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: on ? "#fff" : theme.text }}>{it.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div key="s1" className="gt-fadeup" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Gauge size={14} color="#22c55e" />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: theme.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 2 of 3</span>
            </div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 26, color: theme.text, margin: "0 0 8px" }}>
              How do you like to travel?
            </h1>
            <p style={{ fontSize: 14, color: theme.subtext, margin: "0 0 22px" }}>This helps us pace your itineraries right.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PACES.map((p) => {
                const on = pace === p.id;
                return (
                  <div key={p.id} className="gt-opt" onClick={() => setPace(p.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 18, background: on ? theme.accent : theme.card, border: `1.5px solid ${on ? theme.accent : theme.border}`, backdropFilter: "blur(16px)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: on ? theme.accentText : theme.text }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: on ? theme.accentText : theme.subtext, opacity: on ? 0.85 : 1 }}>{p.desc}</div>
                    </div>
                    {on && <Check size={18} color={theme.accentText} strokeWidth={3} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="gt-fadeup" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Wallet size={14} color="#eab308" />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: theme.accent, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 3 of 3</span>
            </div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 26, color: theme.text, margin: "0 0 8px" }}>
              What's your budget like?
            </h1>
            <p style={{ fontSize: 14, color: theme.subtext, margin: "0 0 22px" }}>You can always change this later in your profile.</p>

            <div style={{ display: "flex", gap: 10 }}>
              {BUDGETS.map((b) => {
                const on = budget === b.id;
                return (
                  <div key={b.id} className="gt-opt" onClick={() => setBudget(b.id)} style={{ flex: 1, textAlign: "center", padding: "22px 10px", borderRadius: 18, background: on ? theme.accent : theme.card, border: `1.5px solid ${on ? theme.accent : theme.border}`, backdropFilter: "blur(16px)" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: on ? theme.accentText : theme.text, marginBottom: 6 }}>{b.symbol}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: on ? theme.accentText : theme.subtext }}>{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {saveError && (
          <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: -6 }}>{saveError}</p>
        )}

        <button
          onClick={handlePrimaryButton}
          disabled={!canContinue || saving}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 16,
            border: "none",
            background: theme.accent,
            color: theme.accentText,
            fontWeight: 700,
            fontSize: 15,
            cursor: canContinue && !saving ? "pointer" : "default",
            opacity: canContinue && !saving ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 20,
            boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.25)" : "rgba(13,148,136,0.3)"}`,
          }}
        >
          {saving ? "Saving..." : isLast ? "Start exploring" : "Continue"} <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
