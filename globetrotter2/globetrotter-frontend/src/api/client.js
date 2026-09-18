// Central place every screen uses to talk to the FastAPI backend.
// Keeping this in one file means: if the backend URL changes (e.g.
// when you deploy in Codespaces), you only update it here, not in
// 12 different screen files.

// Works automatically in both places:
// - Local machine: talks to http://localhost:8000
// - GitHub Codespaces: your browser URL looks like
//   https://xxxx-5173.app.github.dev - Codespaces forwards each port
//   under its own subdomain, so the backend (port 8000) lives at
//   https://xxxx-8000.app.github.dev. This swaps "-5173" for "-8000"
//   automatically so you never have to edit this file by hand.
// Three situations, handled automatically:
//
// 1. BUILT APP served by FastAPI itself (npm run build, then uvicorn on
//    port 8000): the page and the API share one origin, so we use ""
//    and every request becomes a plain relative URL like "/auth/login".
// 2. Vite dev server on your machine (npm run dev, port 5173): the API
//    lives on a different port, so we point at http://localhost:8000.
// 3. Vite dev server in GitHub Codespaces: your browser URL looks like
//    https://xxxx-5173.app.github.dev - Codespaces forwards each port
//    under its own subdomain, so the backend (port 8000) lives at
//    https://xxxx-8000.app.github.dev. This swaps "-5173" for "-8000"
//    automatically so you never have to edit this file by hand.
const isViteDevServer = window.location.port === "5173" || window.location.hostname.includes("-5173.");

const API_BASE_URL = !isViteDevServer
  ? "" // same server serves the app and the API
  : window.location.hostname.includes("app.github.dev")
    ? `https://${window.location.hostname.replace("-5173", "-8000")}`
    : "http://localhost:8000";

function getToken() {
  return localStorage.getItem("gt_token");
}

function setToken(token) {
  localStorage.setItem("gt_token", token);
}

function clearToken() {
  localStorage.removeItem("gt_token");
}

// Same idea as API_BASE_URL above, but for a ws:// URL instead of http://
// - the Chat Service's real-time connection (see Chat.jsx) needs one of
// these, not a plain fetch(). Same host/port either way, just a
// different scheme, since a WebSocket IS an HTTP connection that got
// upgraded.
function wsBaseUrl() {
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/^http/, "ws");
  }
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}`;
}

// Every authenticated request goes through this. It automatically
// attaches the JWT (if we have one) and throws a readable error if
// the backend responds with a non-2xx status - so screens can just
// try/catch instead of manually checking response.ok everywhere.
async function request(path, { method = "GET", body, auth = false } = {}) {
  // A FormData body (file uploads) must NOT get a JSON content type - the
  // browser sets "multipart/form-data" with the right boundary itself - and
  // must be sent as-is rather than stringified.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Request failed (${response.status})`);
  }

  // 204 No Content responses have no JSON body to parse
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  // --- Auth ---
  register: (name, email, password) =>
    request("/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  // Called with the ID token Google's own "Sign in with Google" button
  // hands back to the browser (see Login.jsx) - returns the same
  // {access_token} shape as login(), so everything downstream is identical.
  loginWithGoogle: (idToken) =>
    request("/auth/google", { method: "POST", body: { id_token: idToken } }),
  getMe: () => request("/auth/me", { auth: true }),

  // --- Destinations ---
  getDestinations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/destinations${query ? `?${query}` : ""}`);
  },
  // `lang` is optional: pass "fr" to get the French text of a place. The
  // backend falls back to English for anything not translated yet.
  getDestination: (id, lang) => request(`/destinations/${id}${lang ? `?lang=${lang}` : ""}`),
  getCategories: () => request("/destinations/categories"),
  // Managing places - login required, but any signed-in user may touch any
  // place (seeded or traveller-added): it's a shared catalogue.
  createDestination: (payload) => request("/destinations", { method: "POST", auth: true, body: payload }),
  updateDestination: (id, payload) =>
    request(`/destinations/${id}`, { method: "PUT", auth: true, body: payload }),
  deleteDestination: (id) => request(`/destinations/${id}`, { method: "DELETE", auth: true }),
  // Uploads one file, returns { url, type: "photo"|"video", name }.
  uploadMedia: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/destinations/media", { method: "POST", auth: true, body: form });
  },

  // --- Ratings, comments, likes (destination.rating/rating_count/
  // like_count already come back from getDestination(s) above - these
  // are just the actions a traveller can take). ---
  getTopRatedDestinations: (limit) => request(`/destinations/top-rated${limit ? `?limit=${limit}` : ""}`),
  rateDestination: (id, stars) =>
    request(`/destinations/${id}/rating`, { method: "POST", auth: true, body: { stars } }),
  getMyRating: (id) => request(`/destinations/${id}/rating/mine`, { auth: true }),
  getComments: (id) => request(`/destinations/${id}/comments`),
  postComment: (id, text) =>
    request(`/destinations/${id}/comments`, { method: "POST", auth: true, body: { text } }),
  deleteComment: (id, commentId) =>
    request(`/destinations/${id}/comments/${commentId}`, { method: "DELETE", auth: true }),
  likeDestination: (id) => request(`/destinations/${id}/like`, { method: "POST", auth: true }),
  unlikeDestination: (id) => request(`/destinations/${id}/like`, { method: "DELETE", auth: true }),
  getMyLike: (id) => request(`/destinations/${id}/like/mine`, { auth: true }),
  // Turns a stored "/media/xyz.jpg" path into a URL the browser can load
  // (in the Vite dev server the API is on another origin, so it needs the base).
  mediaUrl: (path) => (path ? `${API_BASE_URL}${path}` : ""),

  // --- Observability (used by the System health screen) ---
  // ADMIN ONLY as of the roles feature (see services/gateway/app/
  // security.py) - a regular traveller's token gets a 403 here now, so
  // this must send the Authorization header.
  getMetrics: () => request("/metrics", { auth: true }),
  resetMetrics: () => request("/metrics/reset", { method: "POST", auth: true }),

  // --- Recommendations ---
  savePreferences: (interests, pace, budget) =>
    request("/recommendations/preferences", {
      method: "POST",
      auth: true,
      body: { interests, pace, budget },
    }),
  getPreferences: () => request("/recommendations/preferences", { auth: true }),
  getRecommendations: () => request("/recommendations", { auth: true }),

  // --- Itineraries ---
  // The list screen gets the summaries; the detail screen fetches one trip,
  // which comes back with each stop's full destination attached.
  getItineraries: () => request("/itineraries", { auth: true }),
  getItinerary: (id) => request(`/itineraries/${id}`, { auth: true }),
  createItinerary: (title, date, stops) =>
    request("/itineraries", { method: "POST", auth: true, body: { title, date, stops } }),
  deleteItinerary: (id) => request(`/itineraries/${id}`, { method: "DELETE", auth: true }),

  // --- Routing (OpenRouteService, proxied by our backend) ---
  // `coordinates` is [[lng, lat], ...] in visiting order. The reply always
  // has geometry/distance/duration; `source` says whether those came from
  // OpenRouteService or from a straight-line estimate, so a screen can be
  // honest about which it's showing. See backend/app/routers/routing.py.
  getRoute: (coordinates, profile = "driving-car") =>
    request("/routing/directions", { method: "POST", body: { coordinates, profile } }),
  getRoutingStatus: () => request("/routing/status"),

  // --- Chat (Chat Service - 1-on-1, group, and the shared public room) ---
  // Real-time delivery is a WebSocket (see Chat.jsx), not polling - these
  // REST calls handle room/membership management and loading history
  // when a chat screen first opens. "global" is always a valid room id -
  // it's the one every traveller shares (the old Phase 1 Global Chat).
  listChatRooms: () => request("/rooms", { auth: true }),
  createDirectChatRoom: (otherUserId) =>
    request("/rooms/direct", { method: "POST", auth: true, body: { other_user_id: otherUserId } }),
  createGroupChatRoom: (name, memberIds) =>
    request("/rooms/group", { method: "POST", auth: true, body: { name, member_ids: memberIds } }),
  getChatRoom: (id) => request(`/rooms/${id}`, { auth: true }),
  addChatRoomMember: (id, userId) =>
    request(`/rooms/${id}/members`, { method: "POST", auth: true, body: { user_id: userId } }),
  // Pass the id of the last message you already have as `since` and you
  // get back only what's newer. `auth: true` is safe to pass even for the
  // public room when logged out - request() only attaches a header when
  // an actual token exists (see request() above).
  getChatMessages: (roomId, since) =>
    request(`/rooms/${roomId}/messages${since ? `?since=${since}` : ""}`, { auth: true }),
  // REST fallback for posting - the WebSocket (Chat.jsx) is the real path.
  postChatMessage: (roomId, text) =>
    request(`/rooms/${roomId}/messages`, { method: "POST", auth: true, body: { text } }),
  deleteChatMessage: (roomId, messageId) =>
    request(`/rooms/${roomId}/messages/${messageId}`, { method: "DELETE", auth: true }),
  // Broadcasts "a call started here" to everyone connected to the room -
  // see services/chat-service/app/chatlogic.py's start_call(). This
  // service never touches audio/video itself; the returned Jitsi room
  // name is what the frontend actually joins (see Chat.jsx / Call.jsx).
  startChatCall: (roomId) => request(`/rooms/${roomId}/call/start`, { method: "POST", auth: true }),
  // The URL to open a real-time WebSocket connection to this room. The
  // token travels as a query param because a browser's `new
  // WebSocket(url)` can't send custom headers - see chat-service/app/
  // ws.py's module docstring for the full reasoning.
  chatSocketUrl: (roomId) => `${wsBaseUrl()}/ws/${roomId}?token=${encodeURIComponent(getToken() || "")}`,
  // Find someone to start a chat with, by name (see services/user-
  // service/app/routers/users.py's search endpoint).
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),

  // --- Favorites ---
  getFavorites: () => request("/favorites", { auth: true }),
  addFavorite: (destinationId) => request(`/favorites/${destinationId}`, { method: "POST", auth: true }),
  removeFavorite: (destinationId) => request(`/favorites/${destinationId}`, { method: "DELETE", auth: true }),

  // --- Destination change requests (roles feature) ---
  // A regular user can no longer call createDestination/updateDestination/
  // deleteDestination directly (the backend now returns 403) - they submit
  // one of these instead, and an admin approves or rejects it. See
  // backend services/itinerary-service/app/routers/destination_requests.py.
  submitDestinationRequest: (body) =>
    request("/destinations/requests", { method: "POST", auth: true, body }),
  // Admin only - the review queue. Pass "pending" to see just what needs a
  // decision, or omit it to see the full history.
  listDestinationRequests: (status) =>
    request(`/destinations/requests${status ? `?status=${status}` : ""}`, { auth: true }),
  // Any logged-in user - "did my suggestion get approved?"
  listMyDestinationRequests: () => request("/destinations/requests/mine", { auth: true }),
  approveDestinationRequest: (id) =>
    request(`/destinations/requests/${id}/approve`, { method: "POST", auth: true }),
  rejectDestinationRequest: (id, reason) =>
    request(`/destinations/requests/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, {
      method: "POST",
      auth: true,
    }),

  // Public {id, name} lookup - no auth needed (see services/user-service/
  // app/routers/users.py). Used to show a request's "requested by" name.
  getUserPublic: (id) => request(`/users/${id}`),

  // --- AI assistant ---
  // A free, self-hosted keyword search over the real destination data (no
  // external API, no billing risk - see backend services/itinerary-service/
  // app/assistant.py). Every reply is labelled "source": "keyword-search".
  askAssistant: (question) => request("/assistant/ask", { method: "POST", body: { question } }),
};

export const authStorage = { getToken, setToken, clearToken };
