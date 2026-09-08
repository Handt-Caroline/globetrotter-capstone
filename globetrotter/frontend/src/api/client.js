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
  // Turns a stored "/media/xyz.jpg" path into a URL the browser can load
  // (in the Vite dev server the API is on another origin, so it needs the base).
  mediaUrl: (path) => (path ? `${API_BASE_URL}${path}` : ""),

  // --- Observability (used by the System health screen) ---
  // These read the server's own performance counters. No login needed:
  // in a real deployment you'd protect them, but for a class project it's
  // more useful to be able to show them instantly during a demo.
  getMetrics: () => request("/metrics"),
  resetMetrics: () => request("/metrics/reset", { method: "POST" }),

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

  // --- Global chat ---
  // Pass the id of the last message you already have as `since` and you get
  // back only what's newer, which is what makes polling cheap.
  getGlobalMessages: (since) => request(`/chat/global${since ? `?since=${since}` : ""}`),
  postGlobalMessage: (text) => request("/chat/global", { method: "POST", auth: true, body: { text } }),

  // --- Favorites ---
  getFavorites: () => request("/favorites", { auth: true }),
  addFavorite: (destinationId) => request(`/favorites/${destinationId}`, { method: "POST", auth: true }),
  removeFavorite: (destinationId) => request(`/favorites/${destinationId}`, { method: "DELETE", auth: true }),
};

export const authStorage = { getToken, setToken, clearToken };
