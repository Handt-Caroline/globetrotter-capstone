// =============================================================================
// Metrics.jsx  -  THE OBSERVABILITY DASHBOARD
//
// WHAT THIS SCREEN IS
// -------------------
// A live view of how the server is performing: how many requests it has
// handled, how fast, how many failed, and which endpoints are slowest.
//
// WHY IT EXISTS
// -------------
// The course slides list "Must be observable (metrics, logging, tracing)"
// as a technical requirement, and Phase 1 is meant to make the limits of a
// monolith obvious. This screen is where those limits become visible.
//
// HOW TO USE IT IN A DEMO
// -----------------------
//   1. Open this screen.
//   2. Press "Reset", so you start from zero.
//   3. In a terminal run:  python scripts/load_test.py
//   4. Watch the numbers here climb - especially p95 on POST /itineraries,
//      because every write locks and rewrites the whole JSON file.
//
// That gives you a concrete "here is why we need Phase 2 and Phase 4"
// moment instead of a slide that asserts it.
//
// WHAT THE NUMBERS MEAN
// ---------------------
//   p50 - half of all requests were faster than this (the typical case)
//   p95 - 95% were faster than this (what your unluckiest users feel)
//   p99 - the worst 1%
// Averages hide bad experiences; percentiles don't. That's why real teams
// watch p95 and p99.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Clock, RefreshCw, Server, Timer, Zap, RotateCcw,
} from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { useAuth } from "../auth";

export default function MetricsScreen() {
  const { theme } = useTheme();
  const { isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // useCallback keeps this the same function between renders, so the timer
  // below doesn't get torn down and rebuilt every second.
  const load = useCallback(async () => {
    try {
      const snapshot = await api.getMetrics();
      setData(snapshot);
      setError("");
      setLastUpdated(new Date());
    } catch {
      setError("Couldn't reach the server. Is it running on port 8000?");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll every 3 seconds while auto-refresh is on. The cleanup function
  // (the `return`) stops the timer when you leave the screen - forgetting
  // that is one of the most common memory leaks in React apps.
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  // ADMIN ONLY (roles feature) - the backend already rejects a regular
  // user's token here with 403, but redirecting client-side avoids a
  // flash of "couldn't reach the server" error text for someone who was
  // never going to be allowed to see this screen anyway. Hooks above must
  // still run unconditionally first, so this check comes after them.
  if (!authLoading && !isAdmin) {
    return <Navigate to="/destinations" replace />;
  }

  // Colour the response time: green is healthy, amber is worth watching,
  // red means users are definitely noticing.
  const speedColour = (ms) => (ms < 50 ? "#22c55e" : ms < 200 ? "#eab308" : "#ef4444");

  const headlineStats = data
    ? [
        { label: "Requests served", value: data.total_requests, icon: Activity, color: "#5eead4" },
        { label: "Typical (p50)", value: `${data.p50_ms} ms`, icon: Timer, color: speedColour(data.p50_ms) },
        { label: "Slow tail (p95)", value: `${data.p95_ms} ms`, icon: Zap, color: speedColour(data.p95_ms) },
        {
          label: "Error rate",
          value: `${data.error_rate_percent}%`,
          icon: AlertTriangle,
          color: data.error_rate_percent > 1 ? "#ef4444" : "#22c55e",
        },
      ]
    : [];

  return (
    <div className="gt-page" style={{ background: theme.bg }}>
      <div className="gt-container" style={{ paddingTop: 22, paddingBottom: 40 }}>

      {/* ---- header ---- */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.8vw, 28px)", color: theme.text, margin: 0 }}>
          System health
        </h1>
        <p style={{ fontSize: 12.5, color: theme.subtext, margin: "3px 0 0" }}>
          Live metrics from the Phase 1 monolith
        </p>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 16, padding: "13px 15px", fontSize: 13, color: theme.text, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ---- controls ---- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, border: `1px solid ${autoRefresh ? theme.accent : theme.border}`, background: autoRefresh ? theme.accent : "transparent", color: autoRefresh ? theme.accentText : theme.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
        >
          <RefreshCw size={13} className={autoRefresh ? "gt-spin" : ""} />
          {autoRefresh ? "Live" : "Paused"}
        </button>

        <button
          onClick={async () => { await api.resetMetrics(); load(); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
        >
          <RotateCcw size={13} /> Reset
        </button>

        {data && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, border: `1px solid ${theme.border}`, color: theme.subtext, fontSize: 12 }}>
            <Server size={13} /> up {data.uptime_human}
          </div>
        )}
      </div>

      {/* ---- headline numbers ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 12, marginBottom: 18 }}>
        {headlineStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{ background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "15px 16px" }}>
              <Icon size={17} color={stat.color} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 21, fontWeight: 800, color: theme.text, lineHeight: 1.1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: theme.subtext, marginTop: 3 }}>{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* ---- per-endpoint table ---- */}
      {data?.routes?.length > 0 && (
        <div style={{ background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px 17px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, marginBottom: 4 }}>Slowest endpoints</div>
          <p style={{ fontSize: 11, color: theme.subtext, margin: "0 0 12px", lineHeight: 1.5 }}>
            Sorted by p95. Writes are usually at the top: each one locks and rewrites the whole JSON file.
          </p>

          {data.routes.slice(0, 8).map((route) => {
            // Draw each bar relative to the slowest endpoint, so the shape
            // of the problem is visible at a glance.
            const widest = data.routes[0].p95_ms || 1;
            const widthPercent = Math.max(4, (route.p95_ms / widest) * 100);
            return (
              <div key={route.route} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, color: theme.text, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {route.route}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: speedColour(route.p95_ms), flexShrink: 0 }}>
                    {route.p95_ms} ms
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: theme.border, overflow: "hidden" }}>
                  <div style={{ width: `${widthPercent}%`, height: "100%", background: speedColour(route.p95_ms), borderRadius: 999, transition: "width .4s ease" }} />
                </div>
                <div style={{ fontSize: 10.5, color: theme.subtext, marginTop: 3 }}>
                  {route.count} calls · avg {route.avg_ms} ms · max {route.max_ms} ms
                  {route.errors > 0 && <span style={{ color: "#ef4444" }}> · {route.errors} errors</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- recent requests, like a live log ---- */}
      {data?.recent?.length > 0 && (
        <div style={{ background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px 17px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, marginBottom: 10 }}>Recent requests</div>
          <div style={{ maxHeight: 230, overflowY: "auto" }}>
            {data.recent.slice(0, 25).map((entry, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: entry.status >= 400 ? "#ef4444" : "#22c55e", width: 30, flexShrink: 0 }}>
                  {entry.status}
                </span>
                <span style={{ fontSize: 11, color: theme.subtext, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.route}
                </span>
                <span style={{ fontSize: 10.5, color: speedColour(entry.ms), flexShrink: 0 }}>{entry.ms} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- what to do with this ---- */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px 17px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <Clock size={14} color={theme.accent} />
          <span style={{ fontSize: 13, fontWeight: 800, color: theme.text }}>Try it yourself</span>
        </div>
        <p style={{ fontSize: 12, color: theme.subtext, lineHeight: 1.65, margin: 0 }}>
          Press Reset, then run <span style={{ fontFamily: "monospace", color: theme.text }}>python scripts/load_test.py</span> in
          a terminal. It pretends to be 1, then 5, 10, 25 and 50 users at once. Watch the p95 climb here as the
          number of simultaneous writers grows — that queue is the single JSON file, and it's the reason the
          project moves to microservices, caching and queues in later phases.
        </p>
        {lastUpdated && (
          <p style={{ fontSize: 10.5, color: theme.subtext, margin: "10px 0 0" }}>
            Updated {lastUpdated.toLocaleTimeString()} · metrics reset when the server restarts
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
