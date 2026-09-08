import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, Sparkles, MapPin, Clock, Landmark, TreePine, Mic, Globe } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

const SUGGESTED = [
  "Plan a 3-hour trip near Mvolyé",
  "Where can I eat local food nearby?",
  "What's the cheapest way to Monument de la Réunification?",
];

function buildMessages(firstName) {
  return [
    { from: "ai", text: `Hi ${firstName} 👋 I'm your GlobeTrotter assistant. I can help you plan trips, find places that fit your interests, or answer questions about getting around Yaoundé. What are you in the mood for?` },
    { from: "user", text: "I have about 3 hours free this afternoon, something with architecture and maybe a coffee after." },
    { from: "ai", text: "Perfect combo. Here's what I'd suggest:", cards: [
        { name: "Palais des Congrès", tag: "Architecture", time: "45 min visit", color: "#f97316", icon: Landmark },
        { name: "Café de la Place", tag: "Coffee stop", time: "30 min", color: "#a16207", icon: TreePine },
      ] },
  ];
}

export default function AIAssistantScreen() {
  const { dark, theme } = useTheme();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(buildMessages("there"));
  const bottomRef = useRef(null);

  // Real logged-in user's name, swapped into the scripted greeting.
  // Note: this chat's replies are still scripted, not a live AI - real
  // AI backend integration was intentionally deferred (per project decisions).
  useEffect(() => {
    api.getMe().then((user) => {
      const firstName = user.name.split(" ")[0];
      setMessages(buildMessages(firstName));
    }).catch(() => {});
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // The send button and the suggested prompts used to do nothing at all -
  // you could type and press send and the conversation never changed. They
  // work now. The assistant's replies are still scripted (a real language
  // model was intentionally deferred), so rather than fake an answer it says
  // what it is and points at the two places that CAN answer: the global chat,
  // where real travellers are, and the destination pages.
  const ask = (text) => {
    const question = (text ?? input).trim();
    if (!question) return;
    setInput("");
    setMessages((current) => [
      ...current,
      { from: "user", text: question },
      {
        from: "ai",
        text:
          "I'm the demo assistant for this project — my answers are scripted rather than generated, so I can't " +
          "properly answer that yet. For something live, ask in the Global Chat: other travellers in Yaoundé " +
          "read it. For anything about a specific place, open it from Explore — the history, how to get there, " +
          "what to expect and the tips are all written up there.",
        showChatLink: true,
      },
    ]);
  };

  return (
    <div className="gt-page gt-page--fill" style={{ background: theme.bg, display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{`
        @keyframes gtFloaty { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-3px);} }
        .gt-bot-avatar { animation: gtFloaty 3s ease-in-out infinite; }
      `}</style>

      <div className="gt-glow" style={{ width: 260, height: 260, top: -80, right: -80, background: theme.accent, opacity: dark ? 0.1 : 0.18 }} />

      {/* Who you're talking to */}
      <div className="gt-container" style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, paddingBottom: 12, position: "relative", zIndex: 1, flexShrink: 0 }}>
        <div className="gt-bot-avatar" style={{ width: 36, height: 36, borderRadius: "50%", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Bot size={18} color={theme.accentText} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>GlobeTrotter AI</div>
          <div style={{ fontSize: 11, color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} /> Online
          </div>
        </div>
        <Link
          to="/global-chat"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: theme.accent, textDecoration: "none", flexShrink: 0 }}
        >
          <Globe size={14} /> Global Chat
        </Link>
      </div>

      {/* Messages */}
      <div className="gt-scroll-y gt-container" style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m, i) => (
          <div key={i} className="gt-fadeup" style={{ animationDelay: `${i * 0.1}s`, display: "flex", flexDirection: "column", alignItems: m.from === "user" ? "flex-end" : "flex-start" }}>
            {m.from === "ai" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, marginLeft: 2 }}>
                <Sparkles size={11} color={theme.accent} />
                <span style={{ fontSize: 10.5, color: theme.subtext, fontWeight: 600 }}>GlobeTrotter AI</span>
              </div>
            )}
            <div
              style={{
                maxWidth: "82%",
                padding: "12px 15px",
                borderRadius: m.from === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: m.from === "user" ? theme.bubbleUser : theme.card,
                border: m.from === "user" ? "none" : `1px solid ${theme.border}`,
                backdropFilter: "blur(16px)",
                color: m.from === "user" ? "#fff" : theme.text,
                fontSize: 13.5,
                lineHeight: 1.5,
              }}
            >
              {m.text}
            </div>

            {/* Rich cards inside AI message */}
            {m.cards && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, width: "82%" }}>
                {m.cards.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "10px 12px", backdropFilter: "blur(16px)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={16} color={c.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.text }}>{c.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: c.color, fontWeight: 700 }}>{c.tag}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: theme.subtext }}>
                            <Clock size={10} /> {c.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Link
                  to="/itinerary/new"
                  style={{ alignSelf: "flex-start", marginTop: 2, padding: "8px 16px", borderRadius: 999, background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <MapPin size={12} /> Build an itinerary
                </Link>
              </div>
            )}

            {/* Where a real answer can come from */}
            {m.showChatLink && (
              <Link
                to="/global-chat"
                style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 12, textDecoration: "none" }}
              >
                <Globe size={13} /> Ask in the Global Chat
              </Link>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts - tapping one asks it */}
      <div className="gt-scroll gt-container" style={{ display: "flex", gap: 8, overflowX: "auto", paddingTop: 8, paddingBottom: 8, position: "relative", zIndex: 1, flexShrink: 0 }}>
        {SUGGESTED.map((s) => (
          <div
            key={s}
            onClick={() => ask(s)}
            className="gt-chip"
            style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: theme.text, background: theme.card, border: `1px solid ${theme.border}`, padding: "8px 14px", borderRadius: 999, backdropFilter: "blur(12px)" }}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(); }}
        className="gt-container"
        style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6, paddingBottom: 16, position: "relative", zIndex: 1, flexShrink: 0 }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 999, padding: "11px 16px", backdropFilter: "blur(16px)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about Yaoundé..."
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 13.5 }}
          />
          <Mic size={16} color={theme.subtext} className="gt-icon-btn" />
        </div>
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send"
          className="gt-btn"
          style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: input.trim() ? 1 : 0.5, boxShadow: `0 8px 20px ${dark ? "rgba(94,234,212,0.3)" : "rgba(13,148,136,0.35)"}` }}
        >
          <Send size={16} color={theme.accentText} />
        </button>
      </form>
    </div>
  );
}
