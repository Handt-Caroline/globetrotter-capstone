// =============================================================================
// theme.jsx  -  ONE THEME FOR THE WHOLE APP
//
// Every screen used to keep its own `const [dark, setDark] = useState(true)`
// and its own copy of the same colour table. That meant the theme reset every
// time you moved between screens, and the toggle in one screen's header had no
// effect on any other screen.
//
// Now the theme lives in one place: a React context, the same technique
// i18n.jsx uses for the language. Screens read it with useTheme() and the
// single toggle in the app header changes all of them at once. The choice is
// remembered in localStorage between visits.
//
// The palette below is the union of every colour key the screens were already
// using, so nothing had to be renamed - only de-duplicated.
// =============================================================================

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const DARK = {
  // `bg` is the page gradient; `solidBg` is for screens (the map) that need a
  // flat colour behind a full-bleed element instead of a gradient.
  bg: "linear-gradient(160deg, #0a1628 0%, #0f2138 35%, #163449 65%, #0a1f2e 100%)",
  solidBg: "#0a1628",
  card: "rgba(255,255,255,0.06)",
  cardSolid: "rgba(12,28,48,0.90)",
  cardUnread: "rgba(94,234,212,0.07)",
  border: "rgba(255,255,255,0.14)",
  text: "#f1f7f8",
  subtext: "rgba(241,247,248,0.62)",
  accent: "#5eead4",
  accentText: "#062b28",
  inputBg: "rgba(255,255,255,0.04)",
  chipBg: "rgba(255,255,255,0.05)",
  chipActive: "#5eead4",
  bubbleUser: "linear-gradient(135deg,#0f766e,#0d9488)",
  shadow: "0 14px 40px rgba(0,0,0,0.30)",
  shadowSoft: "0 12px 32px rgba(0,0,0,0.25)",
};

const LIGHT = {
  bg: "linear-gradient(160deg, #eaf6f8 0%, #d7ecf0 35%, #c3e4ea 65%, #a9d8e0 100%)",
  solidBg: "#eaf6f8",
  card: "rgba(255,255,255,0.55)",
  cardSolid: "rgba(255,255,255,0.93)",
  cardUnread: "rgba(13,148,136,0.09)",
  border: "rgba(255,255,255,0.9)",
  text: "#0a2a2e",
  subtext: "rgba(10,42,46,0.6)",
  accent: "#0d9488",
  accentText: "#ffffff",
  inputBg: "rgba(255,255,255,0.5)",
  chipBg: "rgba(255,255,255,0.5)",
  chipActive: "#0d9488",
  bubbleUser: "linear-gradient(135deg,#0d9488,#14b8a6)",
  shadow: "0 14px 34px rgba(20,80,90,0.12)",
  shadowSoft: "0 12px 28px rgba(20,80,90,0.10)",
};

const ThemeContext = createContext({ dark: true, setDark: () => {}, theme: DARK });

export function ThemeProvider({ children }) {
  const [dark, setDarkState] = useState(() => {
    try {
      const saved = localStorage.getItem("gt_theme");
      return saved ? saved === "dark" : true;
    } catch {
      return true; // private browsing can block localStorage - never crash over it
    }
  });

  const setDark = (next) => {
    // Accepts either a boolean or an updater function, like useState does.
    setDarkState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      try {
        localStorage.setItem("gt_theme", value ? "dark" : "light");
      } catch {
        /* ignore - the app still works, it just won't remember next time */
      }
      return value;
    });
  };

  // Paint the page background behind the app too, so overscroll on a phone
  // shows the theme colour rather than a flash of white.
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  const value = useMemo(() => ({ dark, setDark, theme: dark ? DARK : LIGHT }), [dark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// The hook every screen uses:  const { dark, setDark, theme } = useTheme();
export const useTheme = () => useContext(ThemeContext);
