import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme";
import { Compass, User, Mail, Lock, Eye, EyeOff, Sun, Moon, ShieldCheck, ShieldAlert, ShieldQuestion, Shield } from "lucide-react";
import { api, authStorage } from "../api/client";

// -----------------------------------------------------------------------------
// GOOGLE SIGN-IN
//
// This is a public IDENTIFIER, not a secret - it's completely fine for it
// to sit in frontend code (anyone can already see it in Google's own
// login popup URL). It comes from a free OAuth Client ID you create once
// in Google Cloud Console (see the project README for the exact steps),
// set as VITE_GOOGLE_CLIENT_ID when you build the frontend. Until you set
// one, the button below quietly doesn't render instead of showing a
// broken/non-functional button.
// -----------------------------------------------------------------------------
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// --- Cybersecurity feature: real-time password strength meter with entropy scoring ---
function calcEntropy(pw) {
  if (!pw) return { bits: 0, pool: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  const bits = pool > 0 ? Math.round(pw.length * Math.log2(pool)) : 0;
  return { bits, pool };
}

function strengthLevel(bits) {
  if (bits === 0) return { label: "Enter a password", pct: 0, color: "#64748b", Icon: ShieldQuestion };
  if (bits < 28) return { label: "Weak", pct: 25, color: "#ef4444", Icon: ShieldAlert };
  if (bits < 45) return { label: "Fair", pct: 50, color: "#f97316", Icon: ShieldAlert };
  if (bits < 65) return { label: "Good", pct: 75, color: "#eab308", Icon: Shield };
  return { label: "Strong", pct: 100, color: "#22c55e", Icon: ShieldCheck };
}

// --- BUG FIX (moved OUTSIDE of AuthScreen) ---
// This component used to be declared INSIDE the AuthScreen function, right
// above its `return`. That looks harmless, but it's a classic React trap:
//
//   Every time AuthScreen re-renders (which happens on every keystroke,
//   because typing updates state), a *brand new* `Field` function was
//   being created from scratch. React has no way of knowing that "new
//   Field" is supposed to be the same input box as "old Field" - as far
//   as React can tell, the old input was removed from the page and a
//   completely different one was put in its place. When an <input> gets
//   removed and replaced like that, the browser drops keyboard focus from
//   it. That's exactly why you could only type one letter at a time: each
//   keystroke caused React to swap in a "new" input, which kicked your
//   cursor out.
//
// The fix is simple: define the component ONCE, outside of AuthScreen,
// so React reuses the same input across re-renders instead of recreating
// it. Since it's no longer inside AuthScreen, it can't reach AuthScreen's
// state directly anymore - so we pass everything it needs in as props.
function Field({
  icon: Icon,
  iconColor,
  label,
  placeholder,
  type = "text",
  withMeter = false,
  value,
  onChange,
  theme,
  showPw,
  setShowPw,
  pwValue,
  setPwValue,
  strength,
  bits,
  usesPasswordState = false,
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: theme.subtext, letterSpacing: "0.03em" }}>
        {label.toUpperCase()}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 6,
          padding: "12px 14px",
          borderRadius: 14,
          border: `1px solid ${withMeter && pwValue ? strength.color + "88" : theme.border}`,
          background: theme.inputBg,
          transition: "border-color .25s ease",
        }}
      >
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${iconColor}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={13} color={iconColor} strokeWidth={2.4} />
        </div>
        <input
          type={type === "password" && showPw ? "text" : type}
          placeholder={placeholder}
          value={usesPasswordState ? pwValue : value}
          onChange={usesPasswordState ? (e) => setPwValue(e.target.value) : onChange}
          style={{ border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 15, flex: 1 }}
        />
        {type === "password" && (
          <div onClick={() => setShowPw(!showPw)} style={{ cursor: "pointer", color: theme.subtext }}>
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </div>
        )}
      </div>

      {withMeter && (
        <div style={{ marginTop: 8, opacity: pwValue ? 1 : 0.5, transition: "opacity .2s ease" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 999,
                  background: strength.pct / 25 > i ? strength.color : theme.border,
                  transition: "background .3s ease",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <strength.Icon size={12} color={strength.color} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: strength.color }}>{strength.label}</span>
            </div>
            <span style={{ fontSize: 10.5, color: theme.subtext }}>{bits} bits of entropy</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthScreen() {
  const navigate = useNavigate();
  // Shares the app-wide theme, so the choice made here is still in
  // effect once you're inside the app - see src/theme.jsx.
  const { dark, setDark, theme } = useTheme();
  const [mode, setMode] = useState("login"); // login | register
  const [showPw, setShowPw] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pwValue, setPwValue] = useState("");
  // Real form fields the backend actually needs. The mockup only had a
  // "Username" field, but our backend's RegisterRequest wants name +
  // email + password - so name/email are added here.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const { bits } = calcEntropy(pwValue);
  const strength = strengthLevel(bits);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => setLoaded(true), 40);
    return () => clearTimeout(t);
  }, [mode]);

  // Handles the ID token Google's OWN button (rendered below) hands back
  // after someone signs in - we never see their Google password, only
  // this signed token, which the backend verifies (see services/user-
  // service/app/google_auth.py) before issuing our own JWT.
  const handleGoogleCredential = async (response) => {
    setErrorMessage("");
    setSubmitting(true);
    try {
      const result = await api.loginWithGoogle(response.credential);
      authStorage.setToken(result.access_token);
      navigate("/destinations");
    } catch (err) {
      setErrorMessage(err.message || "Google sign-in didn't work. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loads Google's own script and renders GOOGLE's own button into
  // googleButtonRef - we can't fully re-skin it (it's drawn inside a
  // cross-origin iframe Google controls, the same as every other site
  // using "Sign in with Google"), but we can still theme/size/shape it to
  // sit reasonably well in our card. Does nothing at all if no Client ID
  // is configured (see the constant above).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleButtonRef.current.innerHTML = ""; // avoid stacking duplicates on re-render
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: dark ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        width: 320,
        text: "continue_with",
      });
    };

    const existing = document.getElementById("google-identity-script");
    if (existing) {
      renderButton();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-identity-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.body.appendChild(script);
    // Deliberately NOT removing the script on unmount - Login is the only
    // screen that needs it, and re-adding it every time you bounce between
    // login/register would just re-trigger a network fetch for nothing.
  }, [dark]);

  const isLogin = mode === "login";

  // Talks to the real backend (POST /auth/login or /auth/register),
  // saves the JWT we get back, then navigates into the app.
  const handleSubmit = async () => {
    setErrorMessage("");
    setNotice("");
    if (!email && !pwValue) {
      setErrorMessage("Enter your email and password to continue.");
      return;
    }
    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!pwValue) {
      setErrorMessage("Please enter your password.");
      return;
    }
    if (!isLogin && !name) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!isLogin && pwValue !== confirmPw) {
      setErrorMessage("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = isLogin
        ? await api.login(email, pwValue)
        : await api.register(name, email, pwValue);

      authStorage.setToken(result.access_token);

      // New users go through onboarding first (pick interests) so
      // recommendations have something to work with; returning users
      // go straight into the app.
      navigate(isLogin ? "/destinations" : "/onboarding");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "'Manrope','Segoe UI',sans-serif", display: "flex", justifyContent: "center", padding: "24px 12px", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        .gt-btn { transition: transform .15s ease, box-shadow .15s ease; cursor: pointer; }
        .gt-btn:active { transform: scale(0.97); }
        .gt-icon-btn { transition: transform .15s ease; cursor: pointer; }
        .gt-icon-btn:hover { transform: scale(1.08); }
        .gt-fadeup { opacity: 0; transform: translateY(14px); animation: fadeUp .5s ease forwards; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        .gt-glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
        .gt-input:focus-within { border-color: var(--accent) !important; }
      `}</style>

      <div className="gt-glow" style={{ width: 280, height: 280, top: -60, right: -80, background: theme.accent, opacity: dark ? 0.12 : 0.22 }} />
      <div className="gt-glow" style={{ width: 220, height: 220, bottom: -60, left: -70, background: "#ec4899", opacity: dark ? 0.08 : 0.14 }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, color: theme.text }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Compass size={19} color={theme.accentText} strokeWidth={2.4} />
            </div>
            <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 21, letterSpacing: "-0.02em" }}>GlobeTrotter</span>
          </div>
          <div
            onClick={() => setDark(!dark)}
            className="gt-icon-btn"
            style={{ width: 38, height: 38, borderRadius: "50%", border: `1px solid ${theme.border}`, background: theme.card, backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {dark ? <Sun size={17} color={theme.text} /> : <Moon size={17} color={theme.text} />}
          </div>
        </div>

        {/* Mode switcher */}
        <div style={{ display: "flex", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 999, padding: 4, marginBottom: 18, backdropFilter: "blur(16px)" }}>
          {["login", "register"].map((m) => (
            <div
              key={m}
              onClick={() => setMode(m)}
              className="gt-btn"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                background: mode === m ? theme.accent : "transparent",
                color: mode === m ? theme.accentText : theme.subtext,
              }}
            >
              {m === "login" ? "Log In" : "Register"}
            </div>
          ))}
        </div>

        {/* Card */}
        <div
          key={mode}
          className="gt-fadeup"
          style={{
            background: theme.card,
            backdropFilter: "blur(20px)",
            border: `1px solid ${theme.border}`,
            borderRadius: 28,
            padding: "30px 26px",
            boxShadow: dark ? "0 20px 60px rgba(0,0,0,0.35)" : "0 20px 50px rgba(20,80,90,0.15)",
          }}
        >
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 27, color: theme.text, margin: "0 0 6px" }}>
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ color: theme.subtext, fontSize: 14, margin: "0 0 22px", lineHeight: 1.5 }}>
            {isLogin ? "Log in to keep planning your itineraries across Yaoundé." : "Join GlobeTrotter and start discovering Yaoundé."}
          </p>

          {!isLogin && (
            <Field
              icon={User}
              iconColor="#6366f1"
              label="Full name"
              placeholder="e.g. Handy Caroline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              theme={theme}
              showPw={showPw}
              setShowPw={setShowPw}
              pwValue={pwValue}
              setPwValue={setPwValue}
              strength={strength}
              bits={bits}
            />
          )}
          <Field
            icon={Mail}
            iconColor="#ec4899"
            label="Email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            theme={theme}
            showPw={showPw}
            setShowPw={setShowPw}
            pwValue={pwValue}
            setPwValue={setPwValue}
            strength={strength}
            bits={bits}
          />
          <Field
            icon={Lock}
            iconColor="#22c55e"
            label="Password"
            placeholder="••••••••"
            type="password"
            withMeter={!isLogin}
            usesPasswordState
            theme={theme}
            showPw={showPw}
            setShowPw={setShowPw}
            pwValue={pwValue}
            setPwValue={setPwValue}
            strength={strength}
            bits={bits}
          />
          {!isLogin && (
            <Field
              icon={Lock}
              iconColor="#22c55e"
              label="Confirm password"
              placeholder="••••••••"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              theme={theme}
              showPw={showPw}
              setShowPw={setShowPw}
              pwValue={pwValue}
              setPwValue={setPwValue}
              strength={strength}
              bits={bits}
            />
          )}

          {errorMessage && (
            <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, margin: "-6px 0 14px" }}>{errorMessage}</p>
          )}


          {isLogin && (
            <p
              onClick={() => {
                setErrorMessage("");
                setNotice(
                  "Password reset needs an email service, which Phase 1 doesn't have yet (the backend stores everything in a single JSON file). For now, register again with a different email, or ask an admin to reset the db.json entry."
                );
              }}
              style={{ fontSize: 13, color: theme.accent, fontWeight: 600, margin: "-4px 0 18px", cursor: "pointer" }}
            >
              Forgot password?
            </p>
          )}

          {notice && (
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.55,
                color: theme.text,
                background: dark ? "rgba(94,234,212,0.10)" : "rgba(13,148,136,0.10)",
                border: `1px solid ${theme.accent}55`,
                borderRadius: 14,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              {notice}
            </div>
          )}

          <button
            className="gt-btn"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 16,
              border: "none",
              background: theme.accent,
              color: theme.accentText,
              fontWeight: 700,
              fontSize: 15,
              boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.25)" : "rgba(13,148,136,0.3)"}`,
              marginTop: 4,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Please wait..." : isLogin ? "Log In" : "Create Account"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
            <span style={{ fontSize: 12, color: theme.subtext }}>or</span>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {/* Google renders ITS OWN button here (see the useEffect
                  above) - that's normal for every site using Sign in with
                  Google, not something we can fully re-skin ourselves. */}
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <p style={{ fontSize: 12, color: theme.subtext, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
              Google sign-in isn't configured on this build (no VITE_GOOGLE_CLIENT_ID) - see the README.
            </p>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: theme.subtext }}>
          {isLogin ? "New here?" : "Already have an account?"}{" "}
          <span onClick={() => setMode(isLogin ? "register" : "login")} style={{ color: theme.accent, fontWeight: 700, cursor: "pointer" }}>
            {isLogin ? "Create an account" : "Log in"}
          </span>
        </p>
      </div>
    </div>
  );
}
