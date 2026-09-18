// =============================================================================
// ChatList.jsx  -  YOUR CONVERSATIONS
//
// Lists every room you're in: the shared public room (Global Chat - the
// old Phase 1 feature, now real-time instead of polled), 1-on-1 chats,
// and groups. From here you can open one, or start a new direct chat or
// group by searching for someone by name (see services/user-service/app/
// routers/users.py's /users/search - added specifically for this screen).
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, MessageCircle, Plus, Search, Users, X, Check } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

const ROOM_ICON = { public: Globe, direct: MessageCircle, group: Users };

export default function ChatListScreen() {
  const { dark, theme } = useTheme();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "closed" | "direct" | "group" - which "start something new" panel is open.
  const [panel, setPanel] = useState("closed");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]); // [{id, name}]
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState("");

  const loadRooms = () => {
    setLoading(true);
    api
      .listChatRooms()
      .then(setRooms)
      .catch((err) => setError(err.message || "Couldn't load your chats."))
      .finally(() => setLoading(false));
  };

  useEffect(loadRooms, []);

  // Debounced search-as-you-type, same idea as any real chat app's "new
  // message" screen.
  useEffect(() => {
    if (panel === "closed" || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchUsers(query.trim())
        .then((found) => setResults(found.filter((u) => !groupMembers.some((m) => m.id === u.id))))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, panel, groupMembers]);

  const openPanel = (which) => {
    setPanel(which);
    setQuery("");
    setResults([]);
    setGroupName("");
    setGroupMembers([]);
    setPanelError("");
  };

  const startDirectChat = async (user) => {
    setBusy(true);
    setPanelError("");
    try {
      const room = await api.createDirectChatRoom(user.id);
      navigate(`/chat/${room.id}`);
    } catch (err) {
      setPanelError(err.message || "Couldn't start that chat.");
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0 || busy) return;
    setBusy(true);
    setPanelError("");
    try {
      const room = await api.createGroupChatRoom(groupName.trim(), groupMembers.map((m) => m.id));
      navigate(`/chat/${room.id}`);
    } catch (err) {
      setPanelError(err.message || "Couldn't create that group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div
        className="gt-glow"
        style={{ width: 300, height: 300, top: -70, right: -90, background: theme.accent, opacity: dark ? 0.12 : 0.22 }}
      />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40, maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#0f766e22", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageCircle size={17} color="#0d9488" />
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: 0, flex: 1 }}>
            Chats
          </h1>
          <button
            onClick={() => openPanel("direct")}
            className="gt-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, fontWeight: 700, fontSize: 12.5 }}
          >
            <Plus size={14} /> New chat
          </button>
          <button
            onClick={() => openPanel("group")}
            className="gt-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 12.5 }}
          >
            <Users size={14} /> New group
          </button>
        </div>

        {/* -------------------- New direct chat / new group panel -------------------- */}
        {panel !== "closed" && (
          <div className="gt-fadeup" style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: "16px", marginBottom: 18, backdropFilter: "blur(16px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                {panel === "direct" ? "Start a new chat" : "Create a group"}
              </span>
              <X size={16} color={theme.subtext} className="gt-icon-btn" onClick={() => openPanel("closed")} />
            </div>

            {panel === "group" && (
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                maxLength={120}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, fontSize: 13.5, outline: "none", marginBottom: 10 }}
              />
            )}

            {panel === "group" && groupMembers.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {groupMembers.map((m) => (
                  <span
                    key={m.id}
                    onClick={() => setGroupMembers((list) => list.filter((x) => x.id !== m.id))}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: theme.accent, color: theme.accentText, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {m.name} <X size={11} />
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 13px" }}>
              <Search size={14} color={theme.subtext} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name..."
                style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", color: theme.text, fontSize: 13.5 }}
              />
            </div>

            {panelError && <p style={{ fontSize: 12.5, color: "#f87171", fontWeight: 600, margin: "10px 0 0" }}>{panelError}</p>}

            {(searching || results.length > 0) && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {results.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => (panel === "direct" ? startDirectChat(user) : setGroupMembers((list) => [...list, user]))}
                    className="gt-icon-btn"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 12, cursor: "pointer" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: theme.accent, color: theme.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13.5, color: theme.text, fontWeight: 600, flex: 1 }}>{user.name}</span>
                  </div>
                ))}
              </div>
            )}

            {panel === "group" && (
              <button
                onClick={createGroup}
                disabled={!groupName.trim() || groupMembers.length === 0 || busy}
                className="gt-btn"
                style={{
                  width: "100%", marginTop: 12, padding: "11px", borderRadius: 12, border: "none",
                  background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 13.5,
                  opacity: !groupName.trim() || groupMembers.length === 0 || busy ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Check size={14} /> Create group ({groupMembers.length} member{groupMembers.length === 1 ? "" : "s"})
              </button>
            )}
          </div>
        )}

        {/* -------------------- Room list -------------------- */}
        {loading ? (
          <p style={{ color: theme.subtext, fontSize: 14 }}>Loading...</p>
        ) : error ? (
          <p style={{ color: "#ef4444", fontSize: 14, fontWeight: 600 }}>{error}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rooms.map((room) => {
              const Icon = ROOM_ICON[room.type] || MessageCircle;
              return (
                <Link
                  key={room.id}
                  to={`/chat/${room.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "13px 16px", textDecoration: "none", backdropFilter: "blur(16px)" }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: room.type === "public" ? "linear-gradient(135deg,#0f766e,#0d9488)" : theme.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={17} color={room.type === "public" ? "#fff" : theme.accentText} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: theme.text }}>{room.name}</div>
                    {room.member_count != null && (
                      <div style={{ fontSize: 11.5, color: theme.subtext }}>{room.member_count} member{room.member_count === 1 ? "" : "s"}</div>
                    )}
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
