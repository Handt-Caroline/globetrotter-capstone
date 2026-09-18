// =============================================================================
// PlaceForm.jsx  -  ADD / EDIT A PLACE (a destination)
//
// One screen does both jobs: /places/new (no :placeId) creates, and
// /places/:placeId/edit loads that place and saves changes back. Every
// place on Explore - the ones the app ships with included - is an ordinary
// editable record, so this form also edits the built-ins.
//
// The media picker is the one bit of UI nothing else in the app has: a
// hidden <input type="file"> behind a button, a hard cap of 6 items (photos
// and videos combined), each file uploaded as soon as it's chosen, and a
// thumbnail grid with a remove button per item. Fields follow the
// controlled-input + button-onClick shape used across the app (no <form>).
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, MapPin, X } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { useAuth } from "../auth";
import { CATEGORY_OPTIONS } from "../lib/categories";

const MAX_MEDIA = 6;
const PRICE_LEVELS = [
  { id: "free", label: "Free" },
  { id: "budget", label: "Budget" },
  { id: "mid", label: "Mid-range" },
  { id: "premium", label: "Premium" },
];

const BLANK = {
  name: "", category: "", neighbourhood: "", description: "",
  latitude: "", longitude: "", rating: "", price_level: "free", price_range: "",
  history: "", getting_there: "", what_to_expect: "", tips: "",
};

export default function PlaceForm() {
  const navigate = useNavigate();
  const { placeId } = useParams();
  const isEdit = Boolean(placeId);
  const { dark, theme } = useTheme();
  const { isAdmin } = useAuth();
  const fileInputRef = useRef(null);

  const [fields, setFields] = useState(BLANK);
  const [media, setMedia] = useState([]); // [{ url, type, name }]

  const [loading, setLoading] = useState(isEdit);
  const [uploading, setUploading] = useState(0);
  const [mediaError, setMediaError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  // --- edit mode: load the existing record -------------------------------
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    api
      .getDestination(placeId)
      .then((d) => {
        if (cancelled) return;
        setFields({
          name: d.name || "",
          category: d.category || "",
          neighbourhood: d.neighbourhood || "",
          description: d.description || "",
          latitude: d.latitude ?? "",
          longitude: d.longitude ?? "",
          rating: d.rating ?? "",
          price_level: d.price_level || "free",
          price_range: d.price_range || "",
          history: d.history || "",
          getting_there: d.getting_there || "",
          what_to_expect: d.what_to_expect || "",
          tips: d.tips || "",
        });
        setMedia(Array.isArray(d.media) ? d.media : []);
      })
      .catch((err) => !cancelled && setErrorMessage(err.message || "Couldn't load that place."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isEdit, placeId]);

  // --- media picker -----------------------------------------------------
  const handleFilesChosen = async (event) => {
    setMediaError("");
    const chosen = Array.from(event.target.files || []);
    event.target.value = ""; // let the same file be picked again later
    if (chosen.length === 0) return;

    const room = MAX_MEDIA - media.length;
    if (room <= 0) {
      setMediaError(`You can attach at most ${MAX_MEDIA} photos or videos.`);
      return;
    }
    const toUpload = chosen.slice(0, room);
    if (chosen.length > room) {
      setMediaError(`Only ${room} more file${room === 1 ? "" : "s"} allowed - extra ones were skipped.`);
    }

    for (const file of toUpload) {
      setUploading((n) => n + 1);
      try {
        const item = await api.uploadMedia(file);
        setMedia((list) => (list.length >= MAX_MEDIA ? list : [...list, item]));
      } catch (err) {
        setMediaError(err.message || `Couldn't upload ${file.name}.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removeMedia = (url) => {
    setMedia((list) => list.filter((m) => m.url !== url));
    setMediaError("");
  };

  // --- save -----------------------------------------------------------
  const handleSave = async () => {
    setErrorMessage("");
    if (!fields.name.trim()) {
      setErrorMessage("Give this place a name.");
      return;
    }
    if (uploading > 0) {
      setErrorMessage("Hold on until the uploads finish.");
      return;
    }

    const num = (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const text = (value) => {
      const t = (value || "").trim();
      return t === "" ? undefined : t;
    };

    // Only send fields the user actually filled - the backend fills the
    // rest with sensible defaults so the record stays contract-complete.
    const payload = { name: fields.name.trim() };
    for (const key of ["category", "neighbourhood", "description", "price_range",
      "history", "getting_there", "what_to_expect", "tips"]) {
      const v = text(fields[key]);
      if (v !== undefined) payload[key] = v;
    }
    if (fields.price_level) payload.price_level = fields.price_level;
    for (const key of ["latitude", "longitude", "rating"]) {
      const v = num(fields[key]);
      if (v !== undefined) payload[key] = v;
    }
    payload.media = media.map((m) => ({ url: m.url, type: m.type, name: m.name ?? null }));

    setSaving(true);
    try {
      if (isAdmin) {
        const saved = isEdit
          ? await api.updateDestination(placeId, payload)
          : await api.createDestination(payload);
        // Land on the finished place so the change is visible right away.
        navigate(`/site/${saved.id}`);
        return;
      }

      // REGULAR USER: the backend rejects a direct create/update with 403
      // now (see services/itinerary-service/app/routers/destinations.py) -
      // submit a request instead. Nothing goes live until an admin
      // approves it (see "My requests" to track the outcome).
      await api.submitDestinationRequest(
        isEdit
          ? { type: "update", destination_id: placeId, payload }
          : { type: "create", payload }
      );
      navigate("/places/my-requests");
    } catch (err) {
      setErrorMessage(err.message || "Couldn't save this place. Are you logged in?");
      setSaving(false);
    }
  };

  // --- shared styles (same idea as ItineraryNew.jsx) --------------------
  const label = (text) => (
    <label style={{ fontSize: 12, fontWeight: 700, color: theme.subtext, letterSpacing: "0.03em" }}>{text}</label>
  );
  const fieldStyle = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: 14,
    outline: "none",
  };
  const selectStyle = { ...fieldStyle, colorScheme: dark ? "dark" : "light", cursor: "pointer" };
  const areaStyle = { ...fieldStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
  const sectionTitle = (t) => (
    <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 16, color: theme.text, margin: "26px 0 12px" }}>{t}</h2>
  );
  const gap = { marginTop: 6, marginBottom: 16 };

  const canAddMore = media.length + uploading < MAX_MEDIA;

  return (
    <div className="gt-page" style={{ background: theme.bg, position: "relative", overflow: "hidden" }}>
      <div
        className="gt-glow"
        style={{ width: 300, height: 300, top: -70, right: -90, background: theme.accent, opacity: dark ? 0.12 : 0.22 }}
      />

      <div className="gt-container" style={{ position: "relative", zIndex: 1, paddingTop: 20, paddingBottom: 40, maxWidth: 720 }}>
        <Link
          to="/places"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to places
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#0ea5e922", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={17} color="#0ea5e9" />
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: 0 }}>
            {isEdit ? "Edit place" : "Add a place"}
          </h1>
        </div>

        {!isAdmin && (
          <p style={{ fontSize: 12.5, color: theme.subtext, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 14px", margin: "0 0 16px", lineHeight: 1.5 }}>
            You're not an admin, so this goes to an admin as a request instead of saving directly - see
            "My requests" to check whether it was approved.
          </p>
        )}

        {loading ? (
          <p style={{ fontSize: 14, color: theme.subtext }}>Loading...</p>
        ) : (
          <div
            className="gt-fadeup"
            style={{ background: theme.card, backdropFilter: "blur(20px)", border: `1px solid ${theme.border}`, borderRadius: 24, padding: "22px 20px", boxShadow: theme.shadow }}
          >
            {label("NAME")}
            <input
              value={fields.name}
              onChange={set("name")}
              placeholder="e.g. Rocher du Loup viewpoint"
              maxLength={120}
              style={{ ...fieldStyle, ...gap }}
            />

            {label("CATEGORY")}
            <select value={fields.category} onChange={set("category")} style={{ ...selectStyle, ...gap }}>
              <option value="">— Select a category —</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            {label("NEIGHBOURHOOD")}
            <input
              value={fields.neighbourhood}
              onChange={set("neighbourhood")}
              placeholder="e.g. Bastos"
              maxLength={120}
              style={{ ...fieldStyle, ...gap }}
            />

            {label("SHORT DESCRIPTION")}
            <textarea
              value={fields.description}
              onChange={set("description")}
              placeholder="One or two lines shown on the Explore card."
              rows={3}
              maxLength={4000}
              style={{ ...areaStyle, ...gap }}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                {label("LATITUDE")}
                <input type="number" step="any" value={fields.latitude} onChange={set("latitude")} placeholder="3.8480" style={{ ...fieldStyle, ...gap }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                {label("LONGITUDE")}
                <input type="number" step="any" value={fields.longitude} onChange={set("longitude")} placeholder="11.5021" style={{ ...fieldStyle, ...gap }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                {label("RATING (0–5)")}
                <input type="number" step="0.1" min="0" max="5" value={fields.rating} onChange={set("rating")} placeholder="4.5" style={{ ...fieldStyle, ...gap }} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                {label("PRICE LEVEL")}
                <select value={fields.price_level} onChange={set("price_level")} style={{ ...selectStyle, ...gap }}>
                  {PRICE_LEVELS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                {label("PRICE RANGE")}
                <input value={fields.price_range} onChange={set("price_range")} placeholder="e.g. 2 000 – 5 000 FCFA" maxLength={120} style={{ ...fieldStyle, ...gap }} />
              </div>
            </div>

            {sectionTitle("Detail page")}
            <p style={{ fontSize: 12.5, color: theme.subtext, margin: "-6px 0 14px", lineHeight: 1.5 }}>
              These fill the tabs on the place's own page. All optional.
            </p>
            {[
              ["history", "HISTORY / STORY", "The story of this place."],
              ["getting_there", "GETTING THERE", "How to reach it - taxi, moto, on foot."],
              ["what_to_expect", "WHAT TO EXPECT", "What a visitor will find when they arrive."],
              ["tips", "TIPS", "Practical advice - best time, what to bring."],
            ].map(([key, lbl, ph]) => (
              <div key={key}>
                {label(lbl)}
                <textarea value={fields[key]} onChange={set(key)} placeholder={ph} rows={key === "history" ? 5 : 3} maxLength={key === "history" ? 20000 : 4000} style={{ ...areaStyle, ...gap }} />
              </div>
            ))}

            {sectionTitle("Photos & videos")}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              {label("UP TO 6 FILES")}
              <span style={{ fontSize: 12, fontWeight: 700, color: media.length >= MAX_MEDIA ? "#f59e0b" : theme.subtext }}>
                {media.length} / {MAX_MEDIA}
              </span>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFilesChosen} style={{ display: "none" }} />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAddMore}
              className="gt-btn"
              style={{
                width: "100%", marginTop: 8, padding: "13px", borderRadius: 14,
                border: `1px dashed ${theme.border}`, background: theme.inputBg,
                color: canAddMore ? theme.text : theme.subtext, fontWeight: 700, fontSize: 13.5,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: canAddMore ? "pointer" : "not-allowed", opacity: canAddMore ? 1 : 0.6,
              }}
            >
              <ImagePlus size={16} />
              {uploading > 0
                ? `Uploading ${uploading}...`
                : canAddMore
                  ? "Add photos or videos"
                  : `Maximum ${MAX_MEDIA} reached`}
            </button>

            {mediaError && (
              <p style={{ fontSize: 12.5, color: "#f59e0b", fontWeight: 600, margin: "8px 0 0" }}>{mediaError}</p>
            )}

            {media.length > 0 && (
              <div
                className="gt-grid"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 120px), 1fr))", gap: 10, marginTop: 12 }}
              >
                {media.map((item) => (
                  <div
                    key={item.url}
                    style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: `1px solid ${theme.border}`, background: theme.inputBg, aspectRatio: "1 / 1" }}
                  >
                    {item.type === "video" ? (
                      <video src={api.mediaUrl(item.url)} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <img src={api.mediaUrl(item.url)} alt={item.name || "place media"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    {item.type === "video" && (
                      <span style={{ position: "absolute", bottom: 6, left: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.55)", padding: "2px 6px", borderRadius: 999 }}>
                        Video
                      </span>
                    )}
                    <button
                      onClick={() => removeMedia(item.url)}
                      aria-label="Remove this file"
                      className="gt-icon-btn"
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errorMessage && (
              <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, margin: "18px 0 0" }}>{errorMessage}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="gt-btn"
              style={{
                width: "100%", marginTop: 22, padding: "15px", borderRadius: 16, border: "none",
                background: theme.accent, color: theme.accentText, fontWeight: 700, fontSize: 15,
                boxShadow: `0 10px 24px ${dark ? "rgba(94,234,212,0.25)" : "rgba(13,148,136,0.3)"}`,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? isAdmin ? "Saving..." : "Submitting..."
                : isAdmin
                  ? (isEdit ? "Save changes" : "Add place")
                  : "Submit for review"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
