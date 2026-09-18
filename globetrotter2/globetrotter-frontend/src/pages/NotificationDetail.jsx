// =============================================================================
// NotificationDetail.jsx  -  ONE NOTIFICATION, IN FULL
//
// This is what tapping a notification now does. The list gives you a headline
// and a sentence; this gives you the whole thing, and - the part that was
// missing entirely - a way through to whatever the notification is ABOUT.
//
// A trip reminder opens that trip. A comment opens the place it was left on.
// A payment opens the payment. That's the difference between a notification
// and a note: a notification takes you somewhere.
//
// Opening this page marks the notification read, which is where the header's
// unread badge gets its number from.
// =============================================================================

import React, { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Bell, Calendar, CheckCircle2, Globe, MessageCircle, Sparkles, Trash2,
} from "lucide-react";
import { useTheme } from "../theme";
import { useNotifications } from "../notifications";

const ICONS = {
  calendar: Calendar,
  sparkles: Sparkles,
  check: CheckCircle2,
  message: MessageCircle,
  globe: Globe,
};

export default function NotificationDetailScreen() {
  const { notificationId } = useParams();
  const navigate = useNavigate();
  const { dark, theme } = useTheme();
  const { getById, markRead, remove, items } = useNotifications();

  const notification = getById(notificationId);

  // Reading it is what marks it read.
  useEffect(() => {
    if (notification?.unread) markRead(notification.id);
  }, [notification, markRead]);

  const handleDelete = () => {
    remove(notificationId);
    navigate("/notifications");
  };

  // `items` starts empty for a moment while the inbox loads its data, so an
  // id we can't find yet isn't necessarily a bad id.
  if (!notification) {
    return (
      <div className="gt-page" style={{ background: theme.bg }}>
        <div className="gt-container" style={{ paddingTop: 26, maxWidth: 760 }}>
          <Link to="/notifications" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 18 }}>
            <ArrowLeft size={16} /> All notifications
          </Link>
          <p style={{ fontSize: 14, color: theme.subtext }}>
            {items.length === 0 ? "Loading..." : "That notification is no longer in your inbox."}
          </p>
        </div>
      </div>
    );
  }

  const Icon = ICONS[notification.iconName] || Bell;

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div className="gt-glow" style={{ width: 260, height: 260, top: -70, right: -80, background: notification.color, opacity: dark ? 0.14 : 0.22 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40, maxWidth: 760 }}>
        <Link to="/notifications" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 18 }}>
          <ArrowLeft size={16} /> All notifications
        </Link>

        <div
          className="gt-fadeup"
          style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "24px", boxShadow: theme.shadow }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `${notification.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={24} color={notification.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(20px, 2.6vw, 26px)", color: theme.text, margin: "0 0 6px", lineHeight: 1.25 }}>
                {notification.title}
              </h1>
              <span style={{ fontSize: 12, color: theme.subtext }}>{notification.time}</span>
            </div>
          </div>

          {/* The full text. Blank lines in the body become paragraphs. */}
          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 18 }}>
            {String(notification.body || notification.desc)
              .split("\n\n")
              .map((paragraph, i) => (
                <p
                  key={i}
                  style={{ fontSize: 14.5, color: theme.text, opacity: 0.88, lineHeight: 1.7, margin: i === 0 ? 0 : "14px 0 0", whiteSpace: "pre-line" }}
                >
                  {paragraph}
                </p>
              ))}
          </div>

          {/* The point of the whole screen: go to the thing this is about. */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            {notification.link && (
              <Link
                to={notification.link}
                className="gt-btn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "13px 22px", borderRadius: 14, textDecoration: "none",
                  background: theme.accent, color: theme.accentText,
                  fontWeight: 700, fontSize: 14,
                  boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.22)" : "rgba(13,148,136,0.28)"}`,
                }}
              >
                {notification.linkLabel || "Open"} <ArrowRight size={16} />
              </Link>
            )}

            <button
              onClick={handleDelete}
              className="gt-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 20px", borderRadius: 14, border: `1px solid ${theme.border}`, background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: 14 }}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
