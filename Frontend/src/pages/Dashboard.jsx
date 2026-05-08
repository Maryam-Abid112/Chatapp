import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import "./Dashboard.css";

const API = "http://localhost:5001";
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#6c63ff,#a78bfa)",
  "linear-gradient(135deg,#00d4aa,#0099cc)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#a855f7)",
  "linear-gradient(135deg,#14b8a6,#06b6d4)",
  "linear-gradient(135deg,#8b5cf6,#6366f1)",
];

function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function getGradient(id = "") {
  const idx = id.charCodeAt(id.length - 1) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}
function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short" });
}

const EMOJI_LIST = [
  "😀","😂","😍","🥲","😭","😎","😉","😅","🤣","😊",
  "👍","🙏","🙌","💯","🎉","🥳","😇","😡","😱","❤️"
];

const Avatar = ({ name = "", id = "", size = "md" }) => (
  <div
    className={`avatar avatar-${size}`}
    style={{ background: getGradient(id) }}
  >
    {getInitials(name)}
  </div>
);

export default function Dashboard() {

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");

  const typingTimeoutRef = useRef(null);

  const [typingUsers, setTypingUsers] = useState({});
  // ── online users state (socket) ───────────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState({});

  const navigate = useNavigate();
  const socketRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const searchRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiToggleRef = useRef(null);
  const emojiInputRef = useRef(null);

  // ── state ──────────────────────────────────────────────────────────────────
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState("");

  // sidebar
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  // search
  const [searchVal, setSearchVal] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // messages
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── helpers ────────────────────────────────────────────────────────────────
  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: `Bearer ${token()}` });

  const normalizeId = (id) => {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (typeof id === "object") {
      if (id._id) return normalizeId(id._id);
      if (id.id) return normalizeId(id.id);
      if (typeof id.toString === "function") {
        const stringValue = id.toString();
        if (stringValue && stringValue !== "[object Object]") return stringValue;
      }
      return "";
    }
    return String(id);
  };

  const promoteChat = (chatList, chatId, patch = {}) => {
    const normalizedId = normalizeId(chatId);
    const target = chatList.find((c) => normalizeId(c._id) === normalizedId);
    if (!target) return chatList;
    const updated = { ...target, ...patch };
    return [updated, ...chatList.filter((c) => normalizeId(c._id) !== normalizedId)];
  };

  const getMessageSenderId = (msg) => {
    if (!msg) return "";
    const sender = msg.sender;
    if (!sender) return "";
    // sender can be a populated object { _id, name, email } or a raw ObjectId string
    if (typeof sender === "object" && sender._id) return normalizeId(sender._id);
    return normalizeId(sender);
  };

  // ── decode logged-in user from token ──────────────────────────────────────
  useEffect(() => {
    const t = token();
    if (!t) { navigate("/login"); return; }
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      setMyId(normalizeId(payload.id || payload._id || payload.userId));
      setMyName(payload.name || payload.username || "");
    } catch (_) { }
  }, []);

  // ── socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(API, { auth: { token: token() } });
    socketRef.current = socket;

    socket.on("connect", () => console.log("Socket connected:", socket.id));
    socket.on("connect_error", (e) => console.log("Socket error:", e.message));
    socket.on("online_users", (users) => {
      console.log("online users:", users);
      setOnlineUsers(users);
    });
    socket.on("typing", ({ chatId, userId }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [chatId]: userId
      }));
    });

    socket.on("stop_typing", ({ chatId }) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[chatId];
        return copy;
      });
    });
    socket.on("receive_message", (message) => {
      const chatId = normalizeId(message.chatId);
      const isActiveChat = chatId === normalizeId(activeChatIdRef.current);

      if (isActiveChat) {
        setMessages((prev) => {
          if (!prev) return [message];

          const filtered = prev.filter((m) => {
            if (!m.pending) return true;
            const sameText = m.text === message.text;
            const senderA = normalizeId(m.sender);
            const senderB = normalizeId(message.sender);
            const sameSender = senderA && senderB && senderA === senderB;
            const sameTime = Math.abs(new Date(m.createdAt) - new Date(message.createdAt)) < 3000;
            return !(sameText && sameSender && sameTime);
          });

          if (filtered.some((m) => m._id === message._id)) return filtered;
          return [...filtered, message];
        });
      }

      setChats((prev) => {
        const next = prev.map((c) =>
          normalizeId(c._id) === chatId
            ? {
                ...c,
                lastMessage: { text: message.text, createdAt: message.createdAt },
                unreadCount: isActiveChat ? 0 : (c.unreadCount || 0) + 1,
              }
            : c
        );

        const updatedChat = next.find((c) => normalizeId(c._id) === chatId);
        if (!updatedChat) return prev;
        return [updatedChat, ...next.filter((c) => normalizeId(c._id) !== chatId)];
      });
    });

    return () => socket.disconnect();
  }, []);

  // ── fetch chats on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    console.log('fetching chats with token', token());
    try {
      const res = await axios.get(`${API}/api/Chats/getchats`, { headers: authHeader() });
      console.log('fetched chats', res.data.length);
      setChats(res.data);
    } catch (e) {
      handleAuthError(e);
    }
  };

  // ── search (on Enter) ─────────────────────────────────────────────────────
  const handleSearchKey = async (e) => {
    if (e.key !== "Enter") return;
    const q = searchVal.trim();
    if (!q) { setSearchResults([]); setShowSearch(false); return; }
    setSearchLoading(true);
    setShowSearch(true);
    try {
      const res = await axios.get(`${API}/api/Users/getalluser`, { headers: authHeader() });
      const filtered = res.data.filter(
        (u) =>
          u._id !== myId &&
          (u.name?.toLowerCase().includes(q.toLowerCase()) ||
            u.email?.toLowerCase().includes(q.toLowerCase()))
      );
      setSearchResults(filtered);
    } catch (e) {
      handleAuthError(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchVal("");
    setSearchResults([]);
    setShowSearch(false);
  };

  // ── open / create chat from search result ────────────────────────────────
  const openOrCreateChat = async (user) => {
    clearSearch();
    try {
      // try to create / get existing DM
      const res = await axios.post(
        `${API}/api/Chats/accesschat`,
        { userId: user._id },
        { headers: authHeader() }
      );
      const chat = res.data;
      setChats((prev) => {
        const exists = prev.find((c) => c._id === chat._id);
        return exists ? prev : [chat, ...prev];
      });
      selectChat(chat);
    } catch (e) {
      handleAuthError(e);
    }
  };

  // ── select chat & load messages ───────────────────────────────────────────
  const selectChat = async (chat) => {
    setActiveChatId(chat._id);
    activeChatIdRef.current = chat._id;
    setActiveChat(chat);
    setChats((prev) => promoteChat(prev, chat._id, { unreadCount: 0 }));
    setMessages([]);
    socketRef.current?.emit("join_chat", chat._id);
    try {
      const res = await axios.get(`${API}/api/Chats/getmessages/${chat._id}`, {
        headers: authHeader(),
      });
      setMessages(res.data);
    } catch (e) {
      handleAuthError(e);
    }
  };

  // for group chat creation
  const createGroupChat = async (groupName, users) => {
    try {
      const res = await axios.post(
        `${API}/api/Chats/creategroup`,
        {
          name: groupName,
          users: users, // array of user IDs
        },
        { headers: authHeader() }
      );

      const newGroup = res.data;

      setChats((prev) => [newGroup, ...prev]);
      selectChat(newGroup);
    } catch (e) {
      handleAuthError(e);
    }
  };

const handleCreateGroup = async () => {

  if (selectedUsers.length === 0) {
    alert("Select users first");
    return;
  }

  try {

    // ✅ only one user → create DM
    if (selectedUsers.length === 1) {

      const userId = selectedUsers[0];

      const res = await axios.post(
        `${API}/api/Chats/accesschat`,
        { userId },
        { headers: authHeader() }
      );

      const chat = res.data;

      setChats((prev) => {
        const exists = prev.find((c) => c._id === chat._id);
        return exists ? prev : [chat, ...prev];
      });

      selectChat(chat);
    }

    // ✅ multiple users → create group
    else {

      await createGroupChat(
        groupName || "New Group",
        selectedUsers
      );
    }

    // reset panel
    setShowCreatePanel(false);
    setSelectedUsers([]);
    setGroupName("");
    setSearchResults([]);

  } catch (e) {
    handleAuthError(e);
  }
};


  const isUserOnline = (userId) => {
    const id = normalizeId(userId);
    return !!onlineUsers[id];
  };

  // ── send message (auto-creates chat if none) ─────────────────────────────
  const sendMessage = () => {
    const text = newMsg.trim();
    if (!text || !activeChatId || !socketRef.current) return;

    const tempMessage = {
      _id: `temp-${Date.now()}`,
      text,
      sender: { _id: myId, name: myName },
      chatId: activeChatId,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    // 🔥 Optimistic UI (instant message)
    setMessages((prev) => [...(prev || []), tempMessage]);

    setChats((prev) => promoteChat(prev, activeChatId, {
      lastMessage: { text, createdAt: tempMessage.createdAt },
      unreadCount: 0,
    }));

    // 🔥 send to backend via socket
    socketRef.current.emit("send_messages", {
      chatId: activeChatId,
      text,
    });

    setNewMsg("");
  };

  const handleMsgKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);
  const insertEmoji = (emoji) => {
    const textarea = emojiInputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? newMsg.length;
    const end = textarea.selectionEnd ?? newMsg.length;
    const nextMsg = `${newMsg.slice(0, start)}${emoji}${newMsg.slice(end)}`;

    setNewMsg(nextMsg);
    setShowEmojiPicker(false);

    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + emoji.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showEmojiPicker) return;
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(event.target) &&
        emojiToggleRef.current && !emojiToggleRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // ── scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── auth error helper ─────────────────────────────────────────────────────
  const handleAuthError = (e) => {
    console.error(e?.response?.data?.message || e.message);
    if (e?.response?.status === 401) {
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  // ── derive other participant name for DM ──────────────────────────────────
  const getChatDisplayName = (chat) => {
    if (chat.isGroup) return chat.chatName;
    const myIdString = normalizeId(myId);
    const other = chat.members?.find((u) => normalizeId(u) !== myIdString);
    return other?.name || chat.chatName || "Unknown";
  };
  const getChatDisplayId = (chat) => {
    if (chat.isGroup) return chat._id;
    const myIdString = normalizeId(myId);
    const other = chat.members?.find((u) => normalizeId(u) !== myIdString);
    return normalizeId(other) || chat._id;
  };

  // selecting the users for group chat creation

  const toggleUserSelect = (userId) => {
  setSelectedUsers((prev) =>
    prev.includes(userId)
      ? prev.filter((id) => id !== userId)
      : [...prev, userId]
  );
};

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const typingUser = typingUsers[activeChatId];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="nova-shell">
      {showCreatePanel && (
  <div className="nc-overlay" onClick={() => setShowCreatePanel(false)}>
    <div className="nc-panel" onClick={(e) => e.stopPropagation()}>

      <div className="nc-panel-header">
        <h3>Create Chat / Group</h3>
        <button onClick={() => setShowCreatePanel(false)}>✕</button>
      </div>

      {/* group name */}
      <input
        className="nc-panel-input"
        placeholder="Group name (optional)"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />

      {/* search */}
      <input
        className="nc-panel-input"
        placeholder="Search users..."
        onChange={async (e) => {
          const q = e.target.value;

          const res = await axios.get(`${API}/api/Users/getalluser`, {
            headers: authHeader(),
          });

          setSearchResults(
            res.data.filter(
              (u) =>
                u._id !== myId &&
                u.name?.toLowerCase().includes(q.toLowerCase())
            )
          );
        }}
      />

      {/* users list */}
      <div className="nc-user-list">
        {searchResults.map((user) => (
          <div
            key={user._id}
            className={`nc-user-item ${
              selectedUsers.includes(user._id) ? "active" : ""
            }`}
            onClick={() => toggleUserSelect(user._id)}
          >
            <Avatar name={user.name} id={user._id} size="sm" />
            <div className="nc-user-info">
              <span>{user.name}</span>
              <small>{user.email}</small>
            </div>
          </div>
        ))}
      </div>

      {/* create button */}
      <button className="nc-create-btn" onClick={handleCreateGroup}>
        Create Chat / Group
      </button>
    </div>
  </div>
)}
      {/* ── SIDEBAR ── */}
      <aside className="nova-sidebar">
        {/* Header */}
        <div className="ns-header">
          <div className="ns-brand">
            <span className="ns-brand-name">Talkhub</span>
            {myName && <span className="ns-user-name"> - {myName}</span>}
            <div className="ns-header-actions">
              <button className="ns-icon-btn" title="New chat" onClick={() => setShowCreatePanel(true)}>
                ✏️
              </button>
              <button className="ns-icon-btn ns-logout-btn" onClick={logout} title="Logout">
                ⎋
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="ns-search-wrap">
            <span className="ns-search-icon">⌕</span>
            <input
              ref={searchRef}
              className="ns-search-input"
              placeholder="Search people…"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={handleSearchKey}
            />
            {searchVal && (
              <button className="ns-search-clear" onClick={clearSearch}>×</button>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {showSearch && (
          <div className="ns-search-results">
            {searchLoading ? (
              <div className="ns-search-loading">
                <span className="ns-spinner" />
                Searching…
              </div>
            ) : searchResults.length === 0 ? (
              <div className="ns-search-empty">
                <span>🔍</span>
                <p>No users found for "<strong>{searchVal}</strong>"</p>
              </div>
            ) : (
              <>
                <div className="ns-search-label">People on Talkhub</div>
                {searchResults.map((user) => (
                  <div
                    key={user._id}
                    className="ns-search-item"
                    onClick={() => openOrCreateChat(user)}
                  >
                    <Avatar name={user.name} id={user._id} size="sm" />
                    <div className="ns-search-info">
                      <span className="ns-search-name">{user.name}</span>
                      <span className="ns-search-email">{user.email}</span>
                    </div>
                    <span className="ns-search-arrow">→</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Chat List */}
        <div className="ns-chat-list">
          {!showSearch && chats.length === 0 && (
            <div className="ns-empty-sidebar">
              <div className="ns-empty-icon">💬</div>
              <p className="ns-empty-title">No conversations yet</p>
              <p className="ns-empty-sub">Search for someone to start chatting</p>
            </div>
          )}

          {!showSearch && chats.map((chat) => {
            const name = getChatDisplayName(chat);
            const cid = getChatDisplayId(chat);
            const isActive = chat._id === activeChatId;
            return (
              <div
                key={chat._id}
                className={`ns-chat-item${isActive ? " active" : ""}`}
                onClick={() => selectChat(chat)}
              >
                <div className="ns-ci-avatar">
                  <Avatar name={name} id={cid} />
                </div>
                <div className="ns-ci-info">
                  <div className="ns-ci-name">{name}</div>
                  <div className="ns-ci-preview">
                    {chat.lastMessage?.text || "Start a conversation"}
                  </div>
                </div>
                <div className="ns-ci-meta">
                  <span className="ns-ci-time">
                    {formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                  </span>
                  {chat.unreadCount > 0 && (
                    <span className="ns-ci-unread">
                      {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── CHAT WINDOW ── */}
      <main className="nova-chat">
        {!activeChat ? (
          <div className="nc-empty">
            <div className="nc-empty-icon">✦</div>
            <h2 className="nc-empty-title">Welcome to Talkhub</h2>
            <p className="nc-empty-sub">Search for someone or select a chat to begin</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="nc-header">
              <Avatar name={getChatDisplayName(activeChat)} id={getChatDisplayId(activeChat)} size="sm" />
              <div className="nc-header-info">
                <span className="nc-header-name">{getChatDisplayName(activeChat)}</span>
                <span className="nc-header-status">
                  {typingUser ? "Typing..." : (
                    <>
                      <span className={`nc-status-dot ${isUserOnline(getChatDisplayId(activeChat)) ? "online" : "offline"}`} />
                      {isUserOnline(getChatDisplayId(activeChat)) ? "Online" : "Offline"}
                    </>
                  )}
                </span>
              </div>
              <div className="nc-header-actions">
                <button className="ns-icon-btn">📞</button>
                <button className="ns-icon-btn">📹</button>
                <button className="ns-icon-btn">⋯</button>
              </div>
            </div>

            {/* Messages */}
            <div className="nc-messages">
              {messages.length === 0 && (
                <div className="nc-no-messages">
                  <span>👋</span>
                  <p>Say hello to {getChatDisplayName(activeChat)}!</p>
                </div>
              )}
              {messages.map((msg) => {
                const senderId = getMessageSenderId(msg);
                const myIdString = normalizeId(myId);
                const isMine = !!myIdString && !!senderId && senderId === myIdString;
                const senderName = msg.sender?.name || "";
                return (
                  <div key={msg._id} className={`nc-msg-row ${isMine ? "sent" : "recv"}`}>
                    {!isMine && (
                      <Avatar name={senderName} id={msg.sender?._id || msg.sender || ""} size="xs" />
                    )}
                    <div className="nc-msg-content">
                      <div className="nc-bubble">{msg.text}</div>
                      <div className="nc-msg-time">
                        {formatTime(msg.createdAt)}
                        {isMine && <span className="nc-read-check">✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="nc-input-area">
              <button className="ns-icon-btn" type="button">📎</button>
              <textarea
                ref={emojiInputRef}
                className="nc-textarea"
                placeholder={`Message ${getChatDisplayName(activeChat)}…`}
                value={newMsg}
                rows={1}
                onChange={(e) => {
                  setNewMsg(e.target.value);

                  socketRef.current.emit("typing", activeChatId);

                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }

                  typingTimeoutRef.current = setTimeout(() => {
                    socketRef.current.emit("stop_typing", activeChatId);
                  }, 1000);

                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleMsgKey}
              />
              <div className="nc-emoji-group">
                <button
                  type="button"
                  className="ns-icon-btn"
                  ref={emojiToggleRef}
                  onClick={toggleEmojiPicker}
                  aria-label="Open emoji picker"
                >
                  😊
                </button>
                {showEmojiPicker && (
                  <div className="nc-emoji-picker" ref={emojiPickerRef}>
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="nc-emoji-btn"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className={`nc-send-btn${sending ? " loading" : ""}`}
                onClick={sendMessage}
                disabled={!newMsg.trim() || sending}
              >
                {sending ? <span className="ns-spinner-white" /> : "➤"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
