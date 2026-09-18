// =============================================================================
// Chat.jsx  -  ONE CONVERSATION, LIVE
//
// Works for all three room types the same way (public/direct/group) - the
// backend already treats them uniformly (see services/chat-service/app/
// chatlogic.py), so this screen doesn't need special-case branches for
// "is this the global room?" anywhere.
//
// HOW IT STAYS LIVE
// ------------------
// A real WebSocket (api.chatSocketUrl(roomId) - see api/client.js), not
// polling. REST only loads the history once when the screen opens
// (api.getChatMessages); after that, every new message and every "a call
// started" signal arrives the instant the server broadcasts it.
//
// CALLS
// -----
// Sending {"type":"call_start"} over the socket makes the Chat Service
// broadcast a Jitsi room name to everyone connected (see chatlogic.py's
// start_call - the Chat Service itself never touches audio/video). This
// screen just opens that Jitsi room in a new tab - self-hosted Jitsi Meet
// runs as its own container (see docker-compose.yml), so no API key and
// no billing risk, ever.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Phone, PhoneCall, Send, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { useTheme } from "../theme";

// Self-hosted Jitsi's own address - configurable per-deployment (see
// docker-compose.yml and the README) since it's a separate container with
// its own port, not something the Gateway proxies.
const JITSI_BASE_URL = import.meta.env.VITE_JITSI_URL || "https://localhost:8443";

const RECONNECT_DELAY_MS = 3000;

function formatTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? time : `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

const AVATAR_COLORS = ["#f97316", "#8b5cf6", "#22c55e", "#6366f1", "#ec4899", "#0ea5e9", "#eab308", "#14b8a6"];
function colorForName(name) {
  let hash = 0;
  for (const char of name || "") hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

export default function ChatScreen() {
  const { roomId } = useParams();
  const { dark, theme } = useTheme();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeCall, setActiveCall] = useState(null); // jitsi room name, or null

  const bottomRef = useRef(null);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const openedCallsRef = useRef(new Set()); // avoid re-opening the same call twice

  // Room header info - best-effort. If it fails (e.g. logged out on the
  // public room), the room id itself is a perfectly fine fallback title.
  useEffect(() => {
    setRoom(null);
    api.getChatRoom(roomId).then(setRoom).catch(() => setRoom(null));
  }, [roomId]);

  // Message history, once, when the screen opens for this room.
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    api
      .getChatMessages(roomId)
      .then(setMessages)
      .catch(() => setErrorMessage("Couldn't load this conversation."))
      .finally(() => setLoading(false));
  }, [roomId]);

  // The live connection. Reconnects once after a short delay if it drops
  // unexpectedly (e.g. the backend restarted) - a chat screen that just
  // silently stops updating is worse than a brief "Connecting..." blip.
  const connect = useCallback(() => {
    const socket = new WebSocket(api.chatSocketUrl(roomId));
    socketRef.current = socket;

    socket.onopen = () => setConnected(true);

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === "message") {
        setMessages((current) =>
          current.some((m) => m.id === payload.message.id) ? current : [...current, payload.message]
        );
      } else if (payload.type === "call_started") {
        setActiveCall(payload.jitsi_room);
        if (payload.started_by === user?.id && !openedCallsRef.current.has(payload.jitsi_room)) {
          openedCallsRef.current.add(payload.jitsi_room);
          window.open(`${JITSI_BASE_URL}/${payload.jitsi_room}`, "_blank", "noopener");
        }
      }
    };

    socket.onclose = () => {
      setConnected(false);
      if (socketRef.current === socket) {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    socket.onerror = () => socket.close();
  }, [roomId, user]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      const socket = socketRef.current;
      socketRef.current = null; // tells onclose above not to reconnect
      socket?.close();
    };
  }, [connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: "message", text }));
    setInput("");
  };

  const startCall = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "call_start" }));
    }
  };

  const joinActiveCall = () => {
    if (activeCall) window.open(`${JITSI_BASE_URL}/${activeCall}`, "_blank", "noopener");
  };

  const participants = new Set(messages.map((m) => m.user_name)).size;

  return (
    <div className="gt-page gt-page--fill" style={{ background: theme.bg, display: "flex", flexDirection: "column", position: "relative" }}>
      <div className="gt-glow" style={{ width: 260, height: 260, top: -80, right: -80, background: theme.accent, opacity: dark ? 0.1 : 0.18 }} />

      {/* ---------------- Header ---------------- */}
      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <Link to="/chat" style={{ display: "flex", color: theme.subtext }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(18px, 2.2vw, 22px)", color: theme.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {room?.name || (roomId === "global" ? "Global Chat" : "Chat")}
          </h1>
          <p style={{ fontSize: 11.5, color: theme.subtext, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
            {connected ? "Live" : "Connecting..."}
            {room?.member_count != null && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <Users size={11} /> {room.member_count}
              </>
            )}
          </p>
        </div>
        <button
          onClick={startCall}
          title="Start a call"
          className="gt-btn"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: theme.accent, color: theme.accentText, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Phone size={17} />
        </button>
      </div>

      {activeCall && (
        <div className="gt-container" style={{ paddingBottom: 10, flexShrink: 0 }}>
          <button
            onClick={joinActiveCall}
            className="gt-btn"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 14, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
          >
            <PhoneCall size={15} /> A call is happening here - tap to join
          </button>
        </div>
      )}

      {/* ---------------- Messages ---------------- */}
      <div className="gt-scroll-y" style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1 }}>
        <div className="gt-container" style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.subtext, fontSize: 13, padding: "20px 0" }}>
              <Loader2 size={15} className="gt-spin" /> Loading...
            </div>
          )}

          {errorMessage && <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>{errorMessage}</p>}

          {!loading && messages.length === 0 && (
            <div style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 22, padding: "36px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: theme.subtext, margin: 0 }}>Nobody has said anything yet - be the first.</p>
            </div>
          )}

          {messages.map((message, i) => {
            const mine = user && message.user_id === user.id;
            const previous = messages[i - 1];
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
            placeholder={user ? "Message..." : "Log in to join the conversation"}
            maxLength={1000}
            disabled={!user}
            style={{ flex: 1, minWidth: 0, padding: "13px 18px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, fontSize: 14, outline: "none" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || !connected || !user}
            aria-label="Send message"
            className="gt-btn"
            style={{
              width: 46, height: 46, borderRadius: "50%", border: "none",
              background: theme.accent, color: theme.accentText,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              opacity: !input.trim() || !connected || !user ? 0.5 : 1,
            }}
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
