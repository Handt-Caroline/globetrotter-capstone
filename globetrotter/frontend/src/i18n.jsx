// =============================================================================
// i18n.jsx  -  FRENCH / ENGLISH SUPPORT
//
// "i18n" is the usual short way of writing "internationalisation" (i, then
// 18 letters, then n). It means: building an app so it can speak more than
// one language without rewriting every screen.
//
// WHY THIS MATTERS HERE
// ---------------------
// Cameroon is officially bilingual and Yaounde is majority francophone. An
// app about Yaounde that only speaks English is the wrong app.
//
// HOW IT WORKS - THREE PARTS
// --------------------------
// 1. STRINGS - a dictionary below with an English and a French version of
//    every piece of interface text.
//
// 2. CONTEXT - React "context" is a way to share one value with the whole
//    component tree without passing it down through every component by
//    hand. We put the current language in a context, so any screen can read
//    it directly.
//
// 3. THE t() FUNCTION - "t" is short for "translate". A screen writes
//    t("readTheStory") instead of hard-coding "Read the story", and gets
//    the right language automatically.
//
// The destination text itself (histories, tips) is NOT here - it lives in
// the backend and is fetched with ?lang=fr, because content belongs with
// the data, not with the interface.
// =============================================================================

import React, { createContext, useContext, useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// The dictionary. Add a key here and both languages stay in step.
// ---------------------------------------------------------------------------
export const STRINGS = {
  en: {
    // navigation / general
    explore: "Explore",
    forYou: "For You",
    map: "Map",
    itinerary: "Itinerary",
    favourites: "Favourites",
    profile: "Profile",
    search: "Search places in Yaoundé",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    logIn: "Log In",
    logOut: "Log out",

    // site detail
    history: "History",
    gettingThere: "Getting there",
    whatToExpect: "What to expect",
    tips: "Tips",
    directions: "Directions",
    addToItinerary: "Add to Itinerary",
    added: "Added",
    readTheStory: "Read the story",
    listen: "Listen to this story",
    listening: "Reading aloud...",
    pause: "Pause",
    stop: "Stop",
    audioUnsupported: "This browser can't read text aloud.",
    saveToFavourites: "Save to favourites",
    removeFromFavourites: "Remove from favourites",
    logInToSave: "Log in to save this place to your favourites.",
    popularWeekends: "Popular on weekends",
    bestTime: "Best time to visit",
    easiestWay: "Easiest way there",
    rightNow: "Right now",

    // itinerary
    gettingBetweenStops: "Getting between stops",
    distance: "Distance",
    travelTime: "Travel time",
    wholeDay: "Whole day",
    sharedTaxiWalking: "Shared taxi + walking",
    privateTaxiAllDay: "Private taxi all day",
    freeOnFoot: "Free on foot",

    // map
    nearbyServices: "Nearby services",
    myLocation: "My location",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    placesOnMap: "places on the map",
  },
  fr: {
    // navigation / général
    explore: "Explorer",
    forYou: "Pour vous",
    map: "Carte",
    itinerary: "Itinéraire",
    favourites: "Favoris",
    profile: "Profil",
    search: "Rechercher des lieux à Yaoundé",
    loading: "Chargement...",
    save: "Enregistrer",
    cancel: "Annuler",
    logIn: "Se connecter",
    logOut: "Se déconnecter",

    // fiche du lieu
    history: "Histoire",
    gettingThere: "S'y rendre",
    whatToExpect: "À quoi s'attendre",
    tips: "Conseils",
    directions: "Itinéraire",
    addToItinerary: "Ajouter à l'itinéraire",
    added: "Ajouté",
    readTheStory: "Lire l'histoire",
    listen: "Écouter cette histoire",
    listening: "Lecture en cours...",
    pause: "Pause",
    stop: "Arrêter",
    audioUnsupported: "Ce navigateur ne peut pas lire le texte à voix haute.",
    saveToFavourites: "Ajouter aux favoris",
    removeFromFavourites: "Retirer des favoris",
    logInToSave: "Connectez-vous pour enregistrer ce lieu dans vos favoris.",
    popularWeekends: "Fréquenté le week-end",
    bestTime: "Meilleur moment",
    easiestWay: "Le plus simple",
    rightNow: "En ce moment",

    // itinéraire
    gettingBetweenStops: "Entre les étapes",
    distance: "Distance",
    travelTime: "Temps de trajet",
    wholeDay: "Journée entière",
    sharedTaxiWalking: "Taxi partagé + marche",
    privateTaxiAllDay: "Taxi privé toute la journée",
    freeOnFoot: "Gratuit à pied",

    // carte
    nearbyServices: "Services à proximité",
    myLocation: "Ma position",
    zoomIn: "Zoomer",
    zoomOut: "Dézoomer",
    placesOnMap: "lieux sur la carte",
  },
};

// createContext makes a "channel" other components can listen to.
const LanguageContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

// The provider wraps the whole app (see main.jsx) and holds the current
// language in state, so changing it re-renders every screen automatically.
export function LanguageProvider({ children }) {
  // Remember the choice between visits. localStorage is the browser's tiny
  // key/value store; it survives refreshes and closing the tab.
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem("gt_lang") || "en";
    } catch {
      return "en"; // private browsing can block localStorage - never crash over it
    }
  });

  const setLang = (next) => {
    setLangState(next);
    try {
      localStorage.setItem("gt_lang", next);
    } catch {
      /* ignore - the app still works, it just won't remember next time */
    }
  };

  // Also tell the browser and screen readers which language the page is in.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // t("save") -> "Save" or "Enregistrer". If a key is missing we fall back
  // to English, then to the key itself, so a typo shows up visibly in
  // development instead of rendering as an empty space.
  const t = (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

// The hook every screen uses:  const { t, lang, setLang } = useLanguage();
export const useLanguage = () => useContext(LanguageContext);
