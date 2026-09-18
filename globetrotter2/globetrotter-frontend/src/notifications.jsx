// =============================================================================
// notifications.jsx  -  ONE SHARED NOTIFICATION INBOX
//
// WHAT WAS WRONG BEFORE
// ---------------------
// The bell icon in every screen's header was a plain <Bell/> with no onClick,
// so it did nothing at all. The Notifications screen existed but you could
// only reach it by typing /notifications yourself, its list was hard-coded
// inside that one file, tapping an item only dimmed it, and the places it
// mentioned ("Musee National", "Basilique...") were text, not links - there
// was nowhere to go.
//
// WHAT THIS DOES
// --------------
// Puts the inbox in a context, like the theme and the language, so:
//   - the bell in the app header can show a real unread count and open it
//   - tapping a notification opens a detail view with its full content
//   - a notification that is *about* something (a place, a trip, a payment)
//     carries a link to that thing, so "open" actually takes you there
//     instead of dead-ending
//   - what you have read or deleted survives a refresh (localStorage)
//
// The notifications are built from the user's real data - their saved trips
// and real destinations from the API - so the links point at records that
// actually exist rather than at invented ids.
// =============================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";

const READ_KEY = "gt_notifs_read";
const REMOVED_KEY = "gt_notifs_removed";

function loadIdSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore - the inbox still works, it just won't remember next time */
  }
}

// ---------------------------------------------------------------------------
// Building the list.
//
// `destinations` and `itineraries` are whatever the API gave us (either can
// be empty - a logged-out visitor has no trips). Every entry is written so it
// still reads sensibly when the data it would have referenced is missing, and
// only carries a `link` when that link definitely resolves to a real screen.
// ---------------------------------------------------------------------------
function buildNotifications({ destinations, itineraries }) {
  const list = [];
  const topRated = [...destinations].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const nextTrip = itineraries[0];

  if (nextTrip) {
    const firstStop = nextTrip.stops?.[0];
    const stopPlace = firstStop && destinations.find((d) => d.id === firstStop.destination_id);
    list.push({
      id: "trip-reminder",
      type: "reminder",
      title: "Trip starting soon",
      desc: `"${nextTrip.title}" is planned for ${nextTrip.date}.`,
      body:
        `Your itinerary "${nextTrip.title}" is set for ${nextTrip.date}, starting at 9:00 AM. ` +
        `It has ${nextTrip.stops.length} stop${nextTrip.stops.length === 1 ? "" : "s"}` +
        (stopPlace ? `, beginning at ${stopPlace.name}.` : ".") +
        "\n\nOpen the trip to see the route, the distance between stops and what the day should cost in FCFA.",
      time: "2h ago",
      color: "#22c55e",
      iconName: "calendar",
      link: `/itinerary/${nextTrip.id}`,
      linkLabel: "Open this trip",
    });
  }

  if (topRated.length > 0) {
    const picks = topRated.slice(0, 3);
    list.push({
      id: "new-picks",
      type: "ai",
      title: "New picks for you",
      desc: `We found ${picks.length} highly rated places you haven't seen yet.`,
      body:
        "Based on what's rated highest in Yaounde right now:\n\n" +
        picks.map((p) => `- ${p.name} (${p.rating}★) in ${p.neighbourhood || "Yaounde"}`).join("\n") +
        "\n\nOpen For You to see why each one was matched to your interests.",
      time: "5h ago",
      color: "#6366f1",
      iconName: "sparkles",
      link: "/for-you",
      linkLabel: "See your picks",
    });

    const commented = topRated[1] || topRated[0];
    list.push({
      id: `comment-${commented.id}`,
      type: "comment",
      title: "New comment",
      desc: `Someone replied to your review on ${commented.name}.`,
      body:
        `A fellow traveller replied to your review of ${commented.name}:\n\n` +
        `"Completely agree about going late in the afternoon - the light is much better and it's far less busy. ` +
        `Take a shared taxi to the junction and walk the last stretch."\n\n` +
        "Open the place to read its full story, or reply in the global chat.",
      time: "2d ago",
      color: "#ec4899",
      iconName: "message",
      link: `/site/${commented.id}`,
      linkLabel: "Open this place",
    });
  }

  list.push({
    id: "payment-confirmed",
    type: "payment",
    title: "Payment confirmed",
    desc: "Your payment of 2,500 FCFA via Orange Money was successful.",
    body:
      "Payment received.\n\nAmount: 2 500 FCFA\nMethod: Orange Money\nStatus: Confirmed\n\n" +
      "Your receipt has been saved to your account. Nothing further is needed from you.",
    time: "1d ago",
    color: "#f97316",
    iconName: "check",
    link: "/payment",
    linkLabel: "View payment details",
  });

  list.push({
    id: "welcome-chat",
    type: "chat",
    title: "Global chat is open",
    desc: "Travellers are swapping tips about Yaounde right now.",
    body:
      "The global chat is where everyone using GlobeTrotter can ask and answer questions in one room - " +
      "which market is open today, whether a road is passable, what a fair taxi fare is right now.\n\n" +
      "It's the fastest way to get an answer from someone who is actually in the city.",
    time: "3d ago",
    color: "#0ea5e9",
    iconName: "globe",
    link: "/global-chat",
    linkLabel: "Open global chat",
  });

  return list;
}

const NotificationsContext = createContext({
  items: [],
  unreadCount: 0,
  getById: () => undefined,
  markRead: () => {},
  markAllRead: () => {},
  remove: () => {},
});

export function NotificationsProvider({ children }) {
  const [source, setSource] = useState({ destinations: [], itineraries: [] });
  const [readIds, setReadIds] = useState(() => loadIdSet(READ_KEY));
  const [removedIds, setRemovedIds] = useState(() => loadIdSet(REMOVED_KEY));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getDestinations().catch(() => []),
      api.getItineraries().catch(() => []), // needs a login; empty is fine
    ]).then(([destinations, itineraries]) => {
      if (!cancelled) setSource({ destinations, itineraries });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () =>
      buildNotifications(source)
        .filter((n) => !removedIds.has(n.id))
        .map((n) => ({ ...n, unread: !readIds.has(n.id) })),
    [source, readIds, removedIds]
  );

  const markRead = useCallback((id) => {
    setReadIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current).add(id);
      saveIdSet(READ_KEY, next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(buildNotifications(source).map((n) => n.id));
      saveIdSet(READ_KEY, next);
      return next;
    });
  }, [source]);

  const remove = useCallback((id) => {
    setRemovedIds((current) => {
      const next = new Set(current).add(id);
      saveIdSet(REMOVED_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount: items.filter((n) => n.unread).length,
      getById: (id) => items.find((n) => n.id === id),
      markRead,
      markAllRead,
      remove,
    }),
    [items, markRead, markAllRead, remove]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
