// =============================================================================
// GlobalChat.jsx  -  ONE ROOM, EVERYONE IN IT
//
// The AI assistant (/ai-chat) answers from what's written down. This is the
// other half: real people, in Yaounde, right now. Which market is open today,
// whether the road up to Mont Febe is passable, what a taxi to Mvolye is
// actually going for this afternoon - the kind of thing no dataset knows.
//
// It is reachable from the menu on every screen, which is the point: a chat
// you can only find by knowing its URL is not a chat anyone uses.
//
// HOW IT STAYS LIVE
// -----------------
// It polls: every few seconds it asks the backend "anything after the last
// message I have?" and appends whatever comes back. Not as instant as a
// WebSocket, but it needs no extra infrastructure and degrades gracefully -
// a failed poll is simply skipped and the next one catches up.
//
// The messages themselves live in the backend (db.json), so what you post is
// there for everyone else and still there when you come back.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Send, Users, MessageCircle, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

const POLL_INTERVAL_MS = 4000;

// "14:32" for today, "5 Sep, 14:32" for anything older.
function formatTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? time : `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

// A stable colour per person, so you can follow one voice down the room.
const AVATAR_COLORS = ["#f97316", "#8b5cf6", "#22c55e", "#6366f1", "#ec4899", "#0ea5e9", "#eab308", "#14b8a6"];
function colorForName(name) {
  let hash = 0;
  for (const char of name || "") hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

export default function GlobalChatScreen() {
  const { dark, theme } = useTheme();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const bottomRef = useRef(null);
  // Kept in a ref, not state, so the polling effect doesn't have to be torn
  // down and rebuilt every time a message arrives.
  const lastIdRef = useRef(null);

  useEffect(() => {
    api.getMe().then(setMe).catch(() => setMe(null));
  }, []);

  const appendNew = useCallback((incoming) => {
    if (!incoming?.length) return;
    setMessages((current) => {
      // The optimistic copy of our own message is replaced by the real one
      // when it comes back from the server, so it never appears twice.
      const known = new Set(current.map((m) => m.id));
      const merged = [...current.filter((m) => !m.pending), ...incoming.filter((m) => !known.has(m.id))];
      lastIdRef.current = merged.length ? merged[merged.length - 1].id : null;
      return merged;
    });
  }, []);

  // First load, then poll for what's new.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const batch = await api.getGlobalMessages(lastIdRef.current || undefined);
        if (!cancelled) appendNew(batch);
      } catch {
        /* a dropped poll is not worth interrupting the room over */
      }
    };

    api
      .getGlobalMessages()
      .then((batch) => {
        if (cancelled) return;
        setMessages(batch);
        lastIdRef.current = batch.length ? batch[batch.length - 1].id : null;
      })
      .catch(() => !cancelled && setErrorMessage("Couldn't load the chat. Is the backend running?"))
      .finally(() => !cancelled && setLoading(false));

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appendNew]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setErrorMessage("");
    setSending(true);
    setInput("");

    // Show it immediately; the poll will swap in the server's copy.
    const optimistic = {
      id: `pending-${Date.now()}`,
      user_id: me?.id,
      user_name: me?.name || "You",
      text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const saved = await api.postGlobalMessage(text);
      setMessages((current) => [...current.filter((m) => m.id !== optimistic.id), saved]);
      lastIdRef.current = saved.id;
    } catch (err) {
      setMessages((current) => current.filter((m) => m.id !== optimistic.id));
      setInput(text); // give them their words back rather than losing them
      setErrorMessage(err.message?.includes("401") || !me ? "Log in to post in the global chat." : "Couldn't send that message. Try again.");
    } finally {
      setSending(false);
    }
  };

  const participants = new Set(messages.map((m) => m.user_name)).size;

  return (
    <div
      className="gt-page gt-page--fill"
      style={{ background: theme.bg, display: "flex", flexDirection: "column", position: "relative" }}
    >
      <div className="gt-glow" style={{ width: 260, height: 260, top: -80, right: -80, background: theme.accent, opacity: dark ? 0.1 : 0.18 }} />

      {/* ---------------- Room heading ---------------- */}
      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 16, paddingBottom: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#0f766e,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Globe size={21} color="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(19px, 2.4vw, 24px)", color: theme.text, margin: 0 }}>
              Global Chat
            </h1>
            <p style={{ fontSize: 12.5, color: theme.subtext, margin: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Users size={12} /> {participants} {participants === 1 ? "traveller" : "travellers"} in this room
              <span style={{ color: theme.subtext, opacity: 0.5 }}>·</span>
              <span>Everyone using GlobeTrotter can see this</span>
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- Messages ---------------- */}
      <div
        className="gt-scroll-y"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1 }}
      >
        <div className="gt-container" style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.subtext, fontSize: 13, padding: "20px 0" }}>
              <Loader2 size={15} className="gt-spin" /> Loading the room...
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 22, padding: "40px 24px", textAlign: "center" }}>
              <MessageCircle size={34} color={theme.subtext} style={{ marginBottom: 14 }} />
              <h3 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, color: theme.text, margin: "0 0 8px" }}>
                Nobody has said anything yet
              </h3>
              <p style={{ fontSize: 13.5, color: theme.subtext, margin: "0 auto", maxWidth: 360, lineHeight: 1.6 }}>
                Be the first. Ask which market is open today, whether a road is passable, or what a fair taxi
                fare is right now — someone in the city will know.
              </p>
            </div>
          )}

          {messages.map((message, i) => {
            const mine = me && message.user_id === me.id;
            const previous = messages[i - 1];
            // Only re-label a message when the speaker changes, so a burst
            // from one person reads as one turn instead of five headers.
            const showAuthor = !previous || previous.user_name !== message.user_name;
            const color = colorForName(message.user_name);

            return (
              <div
                key={message.id}
                className="gt-fadeup"
                style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: 4 }}
              >
                {showAuthor && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: mine ? "0 4px 0 0" : "0 0 0 4px" }}>
                    {!mine && (
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: color, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {(message.user_name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: mine ? theme.subtext : color }}>
                      {mine ? "You" : message.user_name}
                    </span>
                    <span style={{ fontSize: 10.5, color: theme.subtext, opacity: 0.7 }}>{formatTime(message.created_at)}</span>
                  </div>
                )}

                <div
                  style={{
                    maxWidth: "min(78%, 620px)",
                    padding: "11px 15px",
                    borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: mine ? theme.bubbleUser : theme.card,
                    border: mine ? "none" : `1px solid ${theme.border}`,
                    backdropFilter: "blur(16px)",
                    color: mine ? "#fff" : theme.text,
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    opacity: message.pending ? 0.62 : 1,
                    wordBreak: "break-word",
                  }}
                >
                  {message.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ---------------- Composer ---------------- */}
      <div style={{ flexShrink: 0, position: "relative", zIndex: 1, borderTop: `1px solid ${theme.border}`, background: dark ? "rgba(10,22,40,0.75)" : "rgba(234,246,248,0.85)", backdropFilter: "blur(16px)" }}>
        <form onSubmit={send} className="gt-container" style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, paddingBottom: 14 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={me ? "Message everyone in Yaoundé..." : "Log in to join the conversation"}
            maxLength={500}
            style={{ flex: 1, minWidth: 0, padding: "13px 18px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, fontSize: 14, outline: "none" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="gt-btn"
            style={{
              width: 46, height: 46, borderRadius: "50%", border: "none",
              background: theme.accent, color: theme.accentText,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              opacity: !input.trim() || sending ? 0.5 : 1,
            }}
          >
            {sending ? <Loader2 size={17} className="gt-spin" /> : <Send size={17} />}
          </button>
        </form>

        {errorMessage && (
          <div className="gt-container" style={{ paddingBottom: 12 }}>
            <p style={{ fontSize: 12.5, color: "#f87171", fontWeight: 600, margin: 0 }}>
              {errorMessage}{" "}
              {!me && (
                <Link to="/login" style={{ color: theme.accent, fontWeight: 700 }}>
                  Log in
                </Link>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
