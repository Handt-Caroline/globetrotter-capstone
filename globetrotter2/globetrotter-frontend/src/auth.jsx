// =============================================================================
// auth.jsx  -  "WHO IS LOGGED IN, AND ARE THEY AN ADMIN?"
//
// One place to fetch api.getMe() and remember the answer, instead of every
// screen that cares about the role (Layout's menu, ManagePlaces, PlaceForm,
// the admin request queue, System health) making its own copy of the same
// fetch. Same pattern as theme.jsx / i18n.jsx / notifications.jsx.
//
// `role` comes from the JWT the backend issued at login (see
// services/user-service/app/security.py's create_access_token) - this
// context just surfaces it to React, it doesn't decide anything.
// =============================================================================

import { createContext, useContext, useEffect, useState } from "react";
import { api, authStorage } from "./api/client";

const AuthContext = createContext({ user: null, loading: true, isAdmin: false, refresh: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    if (!authStorage.getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin: user?.role === "admin", refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
