import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, Sparkles, MapPin, Star, Mic, Globe, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

const SUGGESTED = [
  "Tell me the history of Monument de la Réunification",
  "Where can I eat street food nearby?",
  "How do I get to Mont Fébé?",
];

// NOTE ON WHAT THIS ACTUALLY IS
// ------------------------------
// This is NOT a generative AI / large language model, and deliberately so:
// an LLM API needs a key that usually turns into a paid, billed dependency
// sooner or later - exactly the kind of surprise this project has been
// burned by twice already (Google Maps, then CARTO map tiles). Instead,
// every answer below comes from POST /assistant/ask, a free keyword search
// over the app's own real destination data (see backend services/
// itinerary-service/app/assistant.py) - no API key, ever. It's genuinely
// useful for "tell me about X" / "how do I get to X" questions, but it
// doesn't hold a conversation and can't answer anything not already
// written up on a destination's page.
function buildMessages(firstName) {
  return [
    {
      from: "ai",
      text:
        `Hi ${firstName} 👋 Ask me about a specific place - its history, how to get there, what to expect, ` +
        "tips, or price - and I'll pull the real answer from its page. I'm a search tool, not a chatbot, so " +
        "keep it to one place or topic at a time.",
    },
  ];
}

export default function AIAssistantScreen() {
  const { dark, theme } = useTheme();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(buildMessages("there"));
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef(null);

  // Real logged-in user's name, swapped into the greeting.
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

  // Calls the REAL backend (POST /assistant/ask - see the module comment
  // above for what that actually is and isn't).
  const ask = async (text) => {
    const question = (text ?? input).trim();
    if (!question || asking) return;
    setInput("");
    setMessages((current) => [...current, { from: "user", text: question }]);
    setAsking(true);
    try {
      const result = await api.askAssistant(question);
      setMessages((current) => [
        ...current,
        { from: "ai", text: result.answer, matches: result.matches || [] },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          from: "ai",
          text: err.message?.includes("422")
            ? "Ask me something a bit longer than that."
            : "Couldn't reach the assistant. Is the backend running?",
        },
      ]);
    } finally {
      setAsking(false);
    }
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
          to="/chat/global"
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

            {/* Real destinations the search matched - not scripted, these
                come straight from Itinerary Service's own catalogue. */}
            {m.matches && m.matches.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, width: "82%" }}>
                {m.matches.map((d) => (
                  <Link
                    key={d.id}
                    to={`/site/${d.id}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "10px 12px", backdropFilter: "blur(16px)", textDecoration: "none" }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${theme.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MapPin size={16} color={theme.accent} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.text }}>{d.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        {d.rating > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: theme.subtext }}>
                            <Star size={10} fill={theme.accent} color={theme.accent} /> {d.rating}
                          </span>
                        )}
                        {d.price_range && (
                          <span style={{ fontSize: 10.5, color: theme.subtext }}>{d.price_range}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {asking && (
          <div className="gt-fadeup" style={{ display: "flex", alignItems: "center", gap: 6, color: theme.subtext, fontSize: 12.5 }}>
            <Loader2 size={13} className="gt-spin" /> Searching the catalogue...
          </div>
        )}
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
          disabled={!input.trim() || asking}
          aria-label="Send"
          className="gt-btn"
          style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: input.trim() && !asking ? 1 : 0.5, boxShadow: `0 8px 20px ${dark ? "rgba(94,234,212,0.3)" : "rgba(13,148,136,0.35)"}` }}
        >
          {asking ? <Loader2 size={16} color={theme.accentText} className="gt-spin" /> : <Send size={16} color={theme.accentText} />}
        </button>
      </form>
    </div>
  );
}
