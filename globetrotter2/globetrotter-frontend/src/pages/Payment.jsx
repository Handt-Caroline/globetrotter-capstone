import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Smartphone, QrCode, CheckCircle2, Loader2, Receipt, MapPin, ShieldCheck } from "lucide-react";
import { useTheme } from "../theme";

const PROVIDERS = [
  { id: "orange", name: "Orange Money", color: "#FF6600", initials: "OM" },
  { id: "mtn", name: "MTN MoMo", color: "#FFCC00", textColor: "#111", initials: "MoMo" },
];

export default function PaymentScreen() {
  const navigate = useNavigate();
  const { dark, theme } = useTheme();
  const [provider, setProvider] = useState("orange");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | processing | done
  const [mode, setMode] = useState("phone"); // phone | qr

  const activeProvider = PROVIDERS.find((p) => p.id === provider);

  const pay = () => {
    setStatus("processing");
    setTimeout(() => setStatus("done"), 1800);
  };

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes gtPop { 0% { transform: scale(0.6); opacity:0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity:1; } }
        .gt-pop { animation: gtPop .5s cubic-bezier(.34,1.56,.64,1) forwards; }
      `}</style>

      <div className="gt-glow" style={{ width: 280, height: 280, top: -70, right: -80, background: theme.accent, opacity: dark ? 0.1 : 0.2 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40, maxWidth: 620 }}>
        <div
          className="gt-icon-btn"
          onClick={() => navigate(-1)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, marginBottom: 16 }}
        >
          <ChevronLeft size={17} /> Back
        </div>
        {status === "done" ? (
          <div className="gt-pop" style={{ textAlign: "center", paddingTop: 50 }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 14px 34px rgba(34,197,94,0.4)" }}>
              <CheckCircle2 size={40} color="#fff" />
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 22, color: theme.text, margin: "0 0 8px" }}>Payment confirmed</h2>
            <p style={{ fontSize: 13.5, color: theme.subtext, marginBottom: 26, maxWidth: 280, marginInline: "auto", lineHeight: 1.6 }}>
              Your trip to <b style={{ color: theme.text }}>Monument de la Réunification</b> is booked and saved to your itineraries.
            </p>
            <div style={{ background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "18px", textAlign: "left", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: theme.subtext }}>Provider</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{activeProvider.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: theme.subtext }}>Reference</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>GT-84213-YDE</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: theme.subtext }}>Amount</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: theme.accent }}>2,500 FCFA</span>
              </div>
            </div>
            <button onClick={() => navigate("/itinerary")} style={{ width: "100%", padding: "14px", borderRadius: 16, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Back to trip
            </button>
          </div>
        ) : (
          <>
            {/* Trip summary */}
            <div className="gt-fadeup" style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 22, padding: "18px 20px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#f97316,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>Monument de la Réunification</div>
                  <div style={{ fontSize: 11, color: theme.subtext }}>Trip from your current location</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: theme.subtext, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                <span>Ride fare</span><span>1,800 FCFA</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: theme.subtext, margin: "6px 0" }}>
                <span>Entry & service fee</span><span>700 FCFA</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: theme.text, paddingTop: 10, borderTop: `1px dashed ${theme.border}` }}>
                <span>Total</span><span style={{ color: theme.accent }}>2,500 FCFA</span>
              </div>
            </div>

            {/* Provider select */}
            <p style={{ fontSize: 12, fontWeight: 700, color: theme.subtext, letterSpacing: "0.03em", marginBottom: 8 }}>PAY WITH</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {PROVIDERS.map((p) => {
                const isActive = provider === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    style={{
                      flex: 1,
                      cursor: "pointer",
                      borderRadius: 18,
                      padding: "14px",
                      background: isActive ? p.color : theme.card,
                      border: `2px solid ${isActive ? p.color : theme.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      transition: "all .15s ease",
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: isActive ? "rgba(255,255,255,0.35)" : `${p.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: isActive ? (p.textColor || "#fff") : p.color }}>{p.initials}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: isActive ? (p.textColor || "#fff") : theme.text }}>{p.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Mode toggle: phone vs QR */}
            <div style={{ display: "flex", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 999, padding: 4, marginBottom: 18 }}>
              {[{ id: "phone", label: "Phone number", icon: Smartphone }, { id: "qr", label: "Scan QR", icon: QrCode }].map((m) => {
                const Icon = m.icon;
                const isActive = mode === m.id;
                return (
                  <div key={m.id} onClick={() => setMode(m.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 999, cursor: "pointer", background: isActive ? theme.accent : "transparent", color: isActive ? theme.accentText : theme.subtext, fontSize: 12.5, fontWeight: 700 }}>
                    <Icon size={13} /> {m.label}
                  </div>
                );
              })}
            </div>

            {mode === "phone" ? (
              <div className="gt-fadeup" style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, letterSpacing: "0.03em" }}>MOBILE MONEY NUMBER</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, padding: "13px 16px", borderRadius: 14, border: `1px solid ${theme.border}`, background: theme.inputBg }}>
                  <Smartphone size={16} color={activeProvider.color} />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XXX XXX" style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 15, flex: 1 }} />
                </div>
              </div>
            ) : (
              <div className="gt-fadeup" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 22, padding: "24px" }}>
                <div style={{ width: 160, height: 160, background: "#fff", borderRadius: 16, padding: 12, marginBottom: 12 }}>
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    {Array.from({ length: 100 }).map((_, i) => {
                      const seed = (i * 9301 + 49297) % 233280;
                      if (seed / 233280 > 0.55) return null;
                      const x = (i % 10) * 10;
                      const y = Math.floor(i / 10) * 10;
                      return <rect key={i} x={x} y={y} width="10" height="10" fill="#0a1628" />;
                    })}
                  </svg>
                </div>
                <p style={{ fontSize: 12, color: theme.subtext, textAlign: "center" }}>Scan with your {activeProvider.name} app</p>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "10px 14px", borderRadius: 12, background: dark ? "rgba(94,234,212,0.08)" : "rgba(13,148,136,0.08)" }}>
              <ShieldCheck size={15} color={theme.accent} />
              <span style={{ fontSize: 11.5, color: theme.subtext }}>You'll get a prompt on your phone to confirm this payment.</span>
            </div>

            <button
              onClick={pay}
              disabled={status === "processing" || (mode === "phone" && !phone)}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 16,
                border: "none",
                background: theme.accent,
                color: theme.accentText,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: mode === "phone" && !phone ? 0.5 : 1,
                boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.25)" : "rgba(13,148,136,0.3)"}`,
              }}
            >
              {status === "processing" ? (
                <>
                  <Loader2 size={17} className="gt-spin" /> Processing...
                </>
              ) : (
                <>
                  <Receipt size={16} /> Pay 2,500 FCFA
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
