// =============================================================================
// Notifications.jsx  -  THE INBOX
//
// WHAT WAS WRONG BEFORE
// ---------------------
// The bell icon at the top of every screen had no onClick, so nothing opened
// this screen - you had to type /notifications into the address bar. Once you
// got here, tapping a notification only marked it read: there was no detail
// to see and nowhere to go, even though every item was about something (a
// trip, a place, a payment) that already had a page in the app.
//
// WHAT IT DOES NOW
// ----------------
//   - the bell in the header opens it, and carries the unread count
//   - tapping a notification opens its own detail view, with the full text
//   - that view has a button through to the thing the notification is about
//   - what you have read or deleted is remembered between visits
//
// The list itself lives in src/notifications.jsx so the header's badge and
// this screen are always looking at the same inbox.
// =============================================================================

import React from "react";
import { Link } from "react-router-dom";
import {
  Bell, Calendar, CheckCircle2, ChevronRight, Globe, MessageCircle, Sparkles, Trash2,
} from "lucide-react";
import { useTheme } from "../theme";
import { useNotifications } from "../notifications";

// The inbox stores an icon NAME (a plain string can be saved and compared);
// this maps it to the component to draw.
const ICONS = {
  calendar: Calendar,
  sparkles: Sparkles,
  check: CheckCircle2,
  message: MessageCircle,
  globe: Globe,
};

export default function NotificationsScreen() {
  const { dark, theme } = useTheme();
  const { items, unreadCount, markAllRead, remove } = useNotifications();

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div className="gt-glow" style={{ width: 260, height: 260, top: -70, right: -80, background: theme.accent, opacity: dark ? 0.12 : 0.2 }} />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 22, paddingBottom: 40, maxWidth: 860 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(24px, 3vw, 30px)", color: theme.text, margin: "0 0 4px" }}>
              Notifications
            </h1>
            <p style={{ fontSize: 13.5, color: theme.subtext, margin: 0 }}>
              {unreadCount > 0 ? (
                <>
                  <b style={{ color: theme.accent }}>{unreadCount}</b> unread · tap one to read it in full
                </>
              ) : (
                "Nothing unread. Tap any item to read it again."
              )}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="gt-btn"
              style={{ padding: "10px 16px", borderRadius: 12, border: `1px solid ${theme.border}`, background: "transparent", color: theme.accent, fontWeight: 700, fontSize: 12.5 }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="gt-fadeup" style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "48px 24px", textAlign: "center" }}>
            <Bell size={38} color={theme.subtext} style={{ marginBottom: 14 }} />
            <h3 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18, color: theme.text, margin: "0 0 8px" }}>You're all caught up</h3>
            <p style={{ fontSize: 13.5, color: theme.subtext, margin: 0 }}>Trip reminders and updates will show up here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((n, i) => {
              const Icon = ICONS[n.iconName] || Bell;
              return (
                <Link
                  key={n.id}
                  to={`/notifications/${n.id}`}
                  className="gt-fadeup"
                  style={{
                    animationDelay: `${0.03 + i * 0.05}s`,
                    display: "flex",
                    gap: 13,
                    alignItems: "flex-start",
                    textDecoration: "none",
                    background: n.unread ? theme.cardUnread : theme.card,
                    backdropFilter: "blur(18px)",
                    border: `1px solid ${n.unread ? n.color + "55" : theme.border}`,
                    borderRadius: 18,
                    padding: "15px 16px",
                    position: "relative",
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: `${n.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={19} color={n.color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: theme.text }}>{n.title}</span>
                      {n.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, flexShrink: 0 }} />}
                    </div>
                    <p style={{ fontSize: 12.5, color: theme.subtext, lineHeight: 1.5, margin: "0 0 7px" }}>{n.desc}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, color: theme.subtext, opacity: 0.7 }}>{n.time}</span>
                      {n.link && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: n.color }}>{n.linkLabel}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <ChevronRight size={17} color={theme.subtext} />
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Delete "${n.title}"`}
                      className="gt-icon-btn"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(n.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); remove(n.id); } }}
                      style={{ color: theme.subtext, display: "flex" }}
                    >
                      <Trash2 size={15} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
