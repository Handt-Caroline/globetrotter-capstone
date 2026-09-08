import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Share2, Play, Volume2, Pause, Square, MapPin, Star, Clock, Bus, CloudSun, ChevronRight, BookOpen, Navigation, Users, ImageIcon, Film, Languages } from "lucide-react";
import { api } from "../api/client";
import { useLanguage } from "../i18n";
import { useTheme } from "../theme";
// Finds any photos/videos the user has dropped into
// frontend/src/assets/media/<destination_id>/ - see that folder's README.
import { getMediaFor } from "../lib/media";

// The tab keys stay in English internally (they're just identifiers); what
// the user sees is looked up per language through t().
const TABS = ["History", "Getting there", "What to expect", "Tips"];
const TAB_LABEL_KEYS = {
  History: "history",
  "Getting there": "gettingThere",
  "What to expect": "whatToExpect",
  Tips: "tips",
};

// Every one of these is now a real field on the destination (see
// backend/app/seed.py). The fallbacks only show while loading or if a
// destination is missing that field.
const FALLBACK_TAB_CONTENT = {
  History: "Loading the story of this place...",
  "Getting there": "Shared taxi or moto-taxi from the city centre.",
  "What to expect": "Details for this site haven't been written up yet.",
  Tips: "Carry small FCFA notes; most places here are cash only.",
};

export default function SiteDetailScreen() {
  const { destinationId } = useParams();
  const navigate = useNavigate();
  // Current language ("en" or "fr") and the translate helper.
  const { lang, setLang, t } = useLanguage();
  const { dark, theme } = useTheme();
  const [tab, setTab] = useState("History");
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [destination, setDestination] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [addedToTrip, setAddedToTrip] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");

  // Real photos/videos for this destination, if the user has added any
  // (see frontend/src/assets/media/README.md). Falls back to an empty
  // gallery - handled further down - if none exist yet.
  //
  // NOTE: this block has to come AFTER the useState calls above. It used to
  // sit before them and read `destination` for the label, which only avoided
  // a "cannot access before initialization" crash because no media files
  // exist yet - the moment someone dropped a photo into the media folder,
  // the map callback would have run and the page would have died.
  const media = getMediaFor(destinationId);
  const gallery = [
    // Photos/videos uploaded through the "Manage places" form come back on
    // the destination record itself. They lead; the build-time media folder
    // (frontend/src/assets/media/<id>/) still works as a fallback/extra.
    ...(destination?.media || []).map((m) => ({
      type: m.type, url: api.mediaUrl(m.url), label: destination?.name || "",
    })),
    ...media.photos.map((p) => ({ type: "photo", url: p.url, label: destination?.name || "" })),
    ...media.videos.map((v) => ({ type: "video", url: v.url, label: destination?.name || "" })),
  ];
  const hasMedia = gallery.length > 0;
  // Keep the gallery index in range if the destination changes (e.g. one
  // place has 5 photos, the next has 1).
  useEffect(() => { setGalleryIdx(0); }, [destinationId]);
  const current = hasMedia ? gallery[galleryIdx % gallery.length] : null;

  // ---------------------------------------------------------------------
  // AUDIO GUIDE
  //
  // Every browser ships with a speech engine, reachable through
  // window.speechSynthesis. We hand it the text of whichever tab you're
  // reading and it speaks it aloud - no server, no audio files, no cost,
  // and it works offline once the page has loaded.
  //
  // Why this is worth having: it turns the app into a real audio guide you
  // can listen to while walking, and it makes the long histories usable by
  // people who find reading on a phone tiring or who can't see well.
  // ---------------------------------------------------------------------
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  // If the user leaves the page mid-sentence, stop talking. Without this
  // the voice would follow them to the next screen.
  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  const stopSpeaking = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  // Stop talking if the language or the tab changes - otherwise you'd hear
  // French history read by an English voice, or the wrong section entirely.
  useEffect(() => {
    stopSpeaking();
  }, [lang, tab]);

  const speak = (text) => {
    if (!speechSupported || !text) return;

    // Already talking? Then this button is a pause / resume button.
    if (speaking && !paused) {
      window.speechSynthesis.pause();
      setPaused(true);
      return;
    }
    if (speaking && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }

    window.speechSynthesis.cancel(); // clear anything queued
    const utterance = new SpeechSynthesisUtterance(text);
    // Tell the engine which language to use, so French text gets a French
    // voice and the accent and liaison come out right.
    utterance.lang = lang === "fr" ? "fr-FR" : "en-GB";
    utterance.rate = 0.95;  // slightly slower than default - easier to follow
    utterance.pitch = 1;

    // Prefer a voice that actually matches the language, if the device has one.
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang?.toLowerCase().startsWith(lang === "fr" ? "fr" : "en"));
    if (match) utterance.voice = match;

    utterance.onend = () => { setSpeaking(false); setPaused(false); };
    utterance.onerror = () => { setSpeaking(false); setPaused(false); };

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  };

  // Re-fetch whenever the id OR the language changes, so switching to
  // French swaps the history, tips and everything else for the French text
  // stored in the backend (see backend/app/translations_fr.py).
  useEffect(() => {
    api
      .getDestination(destinationId, lang)
      .then(setDestination)
      .catch(() => setLoadError("Couldn't load this destination."));
  }, [destinationId, lang]);

  // Is this place already in the user's favourites? Needs a token, so a
  // logged-out visitor simply sees an empty heart.
  useEffect(() => {
    api
      .getFavorites()
      .then((favs) => setIsFavorite(favs.some((f) => f.id === destinationId)))
      .catch(() => setIsFavorite(false));
  }, [destinationId]);

  // Tap to like, tap again to unlike. The icon flips immediately and
  // flips back if the backend rejects the change.
  const toggleFavorite = async () => {
    setFavoriteError("");
    const wasFavorite = isFavorite;
    setIsFavorite(!wasFavorite);
    try {
      if (wasFavorite) await api.removeFavorite(destinationId);
      else await api.addFavorite(destinationId);
    } catch {
      setIsFavorite(wasFavorite);
      setFavoriteError(t("logInToSave"));
    }
  };

  const TAB_CONTENT = {
    History: destination?.history || destination?.description || FALLBACK_TAB_CONTENT.History,
    "Getting there": destination?.getting_there || FALLBACK_TAB_CONTENT["Getting there"],
    "What to expect": destination?.what_to_expect || FALLBACK_TAB_CONTENT["What to expect"],
    Tips: destination?.tips || FALLBACK_TAB_CONTENT.Tips,
  };


  const bars = Array.from({ length: 40 }, () => 8 + Math.round(Math.random() * 26));

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", paddingBottom: "calc(var(--gt-nav-h) + 86px)" }}>
      <style>{`
        .gt-bar { transition: height .2s ease; }
        @keyframes barpulse { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
        /* The hero fills the width of the window; the text beneath it is
           capped so a paragraph of history isn't 1800px wide. */
        .gt-site-body { width: 100%; max-width: 860px; margin-inline: auto; }
      `}</style>

      {/* -----------------------------------------------------------------
          HERO GALLERY

          If the destination has real photos/videos (dropped into
          frontend/src/assets/media/<id>/ - see that folder's README), we
          show those, swipeable, with a real <img> or <video>. If not, we
          fall back to a plain gradient with a pin icon, exactly like
          before, so a destination with no media yet still looks fine
          rather than broken.
      ----------------------------------------------------------------- */}
      <div
        style={{
          position: "relative", height: "clamp(240px, 38vh, 420px)", overflow: "hidden", borderRadius: "0 0 32px 32px",
          background: hasMedia
            ? "#0a1628"
            : `radial-gradient(circle at 30% 20%, hsl(${170 + galleryIdx * 25},60%,45%) 0%, hsl(${170 + galleryIdx * 25},55%,20%) 75%)`,
        }}
      >
        <div style={{ position: "absolute", top: 18, left: 18, right: 18, display: "flex", justifyContent: "space-between", zIndex: 3 }}>
          <div className="gt-icon-btn" onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={20} color="#fff" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="gt-icon-btn" style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={17} color="#fff" />
            </div>
            <div
              className="gt-icon-btn"
              onClick={toggleFavorite}
              title={isFavorite ? t("removeFromFavourites") : t("saveToFavourites")}
              style={{ width: 38, height: 38, borderRadius: "50%", background: isFavorite ? "rgba(236,72,153,0.9)" : "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Heart size={17} color="#fff" fill={isFavorite ? "#fff" : "none"} />
            </div>
          </div>
        </div>

        {hasMedia ? (
          current.type === "video" ? (
            // key={current.url} forces React to rebuild the <video> tag when
            // you swipe to a different clip, instead of reusing the old one
            // and confusingly playing the wrong file.
            <video
              key={current.url}
              src={current.url}
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <img
              key={current.url}
              src={current.url}
              alt={current.label}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={40} color="rgba(255,255,255,0.5)" />
          </div>
        )}

        {/* Gallery nav - only worth showing with more than one item */}
        {hasMedia && gallery.length > 1 && (
          <>
            <div className="gt-icon-btn" onClick={() => setGalleryIdx((galleryIdx - 1 + gallery.length) % gallery.length)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
              <ChevronLeft size={16} color="#fff" />
            </div>
            <div className="gt-icon-btn" onClick={() => setGalleryIdx((galleryIdx + 1) % gallery.length)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
              <ChevronRight size={16} color="#fff" />
            </div>

            <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 2 }}>
              {gallery.map((g, i) => (
                <div key={i} style={{ width: i === galleryIdx ? 18 : 6, height: 6, borderRadius: 999, background: i === galleryIdx ? "#fff" : "rgba(255,255,255,0.4)", transition: "width .2s ease" }} />
              ))}
            </div>
          </>
        )}

        {hasMedia && (
          <div style={{ position: "absolute", bottom: 14, right: 16, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.45)", padding: "5px 10px", borderRadius: 999, zIndex: 2 }}>
            {current.type === "video" ? <Film size={11} color="#fff" /> : <ImageIcon size={11} color="#fff" />}
            <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>
              {galleryIdx + 1} / {gallery.length}
            </span>
          </div>
        )}
      </div>

      <div className="gt-site-body" style={{ padding: "22px var(--gt-gutter) 0" }}>
        {/* Title row */}
        <div className="gt-fadeup" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 24, color: theme.text, margin: "0 0 4px" }}>
              {destination?.name || (loadError ? "Not found" : "Loading...")}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={13} color={theme.subtext} />
              <span style={{ fontSize: 13, color: theme.subtext }}>{destination?.neighbourhood || "Yaoundé"} · {destination?.category || ""}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* EN / FR switch. Changing it re-fetches this place's text in
                the other language and re-labels the interface. */}
            <div
              className="gt-icon-btn"
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              title={lang === "fr" ? "Switch to English" : "Passer en français"}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.card, color: theme.text }}
            >
              <Languages size={13} />
              <span style={{ fontSize: 11.5, fontWeight: 800 }}>{lang === "fr" ? "FR" : "EN"}</span>
            </div>
          </div>
        </div>

        {favoriteError && (
          <p style={{ fontSize: 12.5, color: "#f87171", fontWeight: 600, margin: "0 0 10px" }}>{favoriteError}</p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Star size={13} fill="#fbbf24" color="#fbbf24" />
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{destination?.rating ?? "--"}</span>
            <span style={{ fontSize: 12, color: theme.subtext }}>· {destination?.price_range || "—"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={13} color={theme.subtext} />
            <span style={{ fontSize: 12, color: theme.subtext }}>{t("popularWeekends")}</span>
          </div>
        </div>

        {/* Original addition: weather + best-time widget */}
        <div className="gt-fadeup" style={{ animationDelay: "0.05s", display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 18, padding: "14px" }}>
            <CloudSun size={18} color="#fbbf24" style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>27°C</div>
            <div style={{ fontSize: 11, color: theme.subtext }}>{t("rightNow")}</div>
          </div>
          <div style={{ flex: 1, background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 18, padding: "14px" }}>
            <Clock size={18} color="#22c55e" style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>5:30 PM</div>
            <div style={{ fontSize: 11, color: theme.subtext }}>{t("bestTime")}</div>
          </div>
          <div style={{ flex: 1, background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 18, padding: "14px" }}>
            <Bus size={18} color="#6366f1" style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Taxi</div>
            <div style={{ fontSize: 11, color: theme.subtext }}>{t("easiestWay")}</div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            AUDIO GUIDE

            This panel used to be decorative: a play button that animated
            some bars and played nothing. It is now a real audio guide - it
            reads the text of the tab you are on, in the language you have
            selected, using the speech engine built into the browser.

            The bars still animate, but now they animate because something
            is actually being spoken.
        ------------------------------------------------------------- */}
        <div className="gt-fadeup" style={{ animationDelay: "0.1s", background: `linear-gradient(135deg, #0f766e, #0d9488)`, borderRadius: 22, padding: "18px 20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="gt-icon-btn"
              onClick={() => speak(TAB_CONTENT[tab])}
              title={speaking && !paused ? t("pause") : t("listen")}
              style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              {speaking && !paused ? <Pause size={19} color="#fff" fill="#fff" /> : <Play size={19} color="#fff" fill="#fff" />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Volume2 size={12} color="#fff" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {speaking ? (paused ? t("pause") : t("listening")) : t("listen")}
                </span>
              </div>

              {/* The bars only move while the voice is actually speaking. */}
              <div style={{ display: "flex", alignItems: "center", gap: 2, height: 22 }}>
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="gt-bar"
                    style={{
                      width: 2.5,
                      height: speaking && !paused ? h : 6,
                      background: "rgba(255,255,255,0.85)",
                      borderRadius: 2,
                      animation: speaking && !paused ? `barpulse ${0.6 + (i % 5) * 0.15}s ease-in-out infinite` : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* A stop button appears only while something is playing. */}
            {speaking && (
              <div
                className="gt-icon-btn"
                onClick={stopSpeaking}
                title={t("stop")}
                style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Square size={13} color="#fff" fill="#fff" />
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", margin: "10px 0 0", lineHeight: 1.5 }}>
            {speechSupported
              ? lang === "fr"
                ? "Lecture à voix haute de l'onglet affiché, en français."
                : "Reads the section you're viewing aloud, in English."
              : t("audioUnsupported")}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14 }}>
          {TABS.map((tabName) => (
            <div
              key={tabName}
              onClick={() => setTab(tabName)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                cursor: "pointer",
                background: tab === tabName ? theme.accent : theme.card,
                border: `1px solid ${tab === tabName ? theme.accent : theme.border}`,
                color: tab === tabName ? theme.accentText : theme.text,
              }}
            >
              {t(TAB_LABEL_KEYS[tabName])}
            </div>
          ))}
        </div>

        <div className="gt-fadeup" key={tab} style={{ background: theme.card, backdropFilter: "blur(16px)", border: `1px solid ${theme.border}`, borderRadius: 20, padding: "18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <BookOpen size={15} color={theme.accent} />
            <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{t(TAB_LABEL_KEYS[tab])}</span>
          </div>
          {String(TAB_CONTENT[tab])
            .split("\n\n")
            .map((paragraph, i) => (
              <p key={i} style={{ fontSize: 13.5, color: theme.subtext, lineHeight: 1.75, margin: i === 0 ? 0 : "12px 0 0" }}>
                {paragraph}
              </p>
            ))}
        </div>
      </div>

      {/* Sticky bottom actions - they sit just above the app's nav row
          rather than on top of it. */}
      <div
        style={{
          position: "fixed", bottom: "var(--gt-nav-h)", left: 0, right: 0, zIndex: 1100,
          padding: "14px var(--gt-gutter)",
          background: dark ? "rgba(10,22,40,0.9)" : "rgba(234,246,248,0.94)",
          backdropFilter: "blur(16px)", borderTop: `1px solid ${theme.border}`,
          display: "flex", gap: 10, justifyContent: "center",
        }}
      >
        <button
          onClick={() => navigate("/map")}
          style={{ flex: 1, maxWidth: 280, padding: "14px", borderRadius: 16, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
        >
          <Navigation size={15} /> {t("directions")}
        </button>
        <button
          onClick={async () => {
            if (!destination || addedToTrip) return;
            try {
              const today = new Date().toISOString().split("T")[0];
              await api.createItinerary(destination.name, today, [{ destination_id: destination.id, order: 0 }]);
              setAddedToTrip(true);
            } catch (err) {
              setLoadError(err.message || "Couldn't add to itinerary.");
            }
          }}
          disabled={!destination || addedToTrip}
          style={{ flex: 1.4, maxWidth: 380, padding: "14px", borderRadius: 16, border: "none", background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 14, cursor: destination && !addedToTrip ? "pointer" : "default", opacity: destination && !addedToTrip ? 1 : 0.6 }}
        >
          {addedToTrip ? `${t("added")} ✓` : t("addToItinerary")}
        </button>
      </div>
    </div>
  );
}
