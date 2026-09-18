// =============================================================================
// AdminRequests.jsx  -  THE ADMIN REVIEW QUEUE
//
// Part of the roles/approval-workflow feature. A regular traveller can
// suggest a place be added, edited, or removed (see PlaceForm.jsx /
// ManagePlaces.jsx), but nothing they submit touches the real catalogue
// until an admin approves it here. Approving runs the exact same backend
// code a direct admin edit would (see services/itinerary-service/app/
// routers/destination_requests.py) - there is only one path that actually
// writes to the destinations table.
//
// ADMIN ONLY: the backend already returns 403 to anyone else, and the
// Navigate guard below sends a non-admin who somehow lands on this URL
// straight back to Explore instead of showing an error screen.
// =============================================================================

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Check, Hourglass, ShieldCheck, X } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";
import { useAuth } from "../auth";

const FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "", label: "All" },
];

const TYPE_LABEL = { create: "New place", update: "Edit", delete: "Delete" };

export default function AdminRequestsScreen() {
  const { dark, theme } = useTheme();
  const { isAdmin, loading: authLoading } = useAuth();

  const [statusFilter, setStatusFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [destinationsById, setDestinationsById] = useState({});
  const [requesterNames, setRequesterNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([api.listDestinationRequests(statusFilter), api.getDestinations()])
      .then(([reqs, destinations]) => {
        setRequests(reqs);
        setDestinationsById(Object.fromEntries(destinations.map((d) => [d.id, d])));

        // Best-effort: resolve each requester's display name. A failed
        // lookup just falls back to showing the raw id - never blocks
        // the list from rendering.
        const ids = [...new Set(reqs.map((r) => r.requested_by))];
        Promise.all(ids.map((id) => api.getUserPublic(id).catch(() => null))).then((users) => {
          setRequesterNames((current) => ({
            ...current,
            ...Object.fromEntries(users.filter(Boolean).map((u) => [u.id, u.name])),
          }));
        });
      })
      .catch((err) => setError(err.message || "Couldn't load requests."))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [statusFilter]);

  if (!authLoading && !isAdmin) {
    return <Navigate to="/destinations" replace />;
  }

  const nameFor = (req) =>
    req.type === "create" ? req.payload?.name || "New place" : destinationsById[req.destination_id]?.name || req.destination_id;

  const act = async (req, action) => {
    if (action === "reject") {
      const reason = window.prompt("Reason for rejecting (shown to the traveller who suggested it):", "");
      if (reason === null) return; // they cancelled the prompt
      setBusyId(req.id);
      try {
        await api.rejectDestinationRequest(req.id, reason);
        load();
      } catch (err) {
        setError(err.message || "Couldn't reject that request.");
      } finally {
        setBusyId(null);
      }
      return;
    }

    setBusyId(req.id);
    try {
      await api.approveDestinationRequest(req.id);
      load();
    } catch (err) {
      setError(err.message || "Couldn't approve that request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="gt-page" style={{ background: theme.bg }}>
      <div className="gt-container" style={{ paddingTop: 20, paddingBottom: 40, maxWidth: 800 }}>
        <Link
          to="/places"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to places
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#0ea5e922", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={17} color="#0ea5e9" />
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: 0 }}>
            Review requests
          </h1>
        </div>
        <p style={{ fontSize: 13, color: theme.subtext, margin: "0 0 16px", lineHeight: 1.55 }}>
          Suggestions from travellers. Approving applies the change immediately; rejecting doesn't.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className="gt-btn"
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid ${statusFilter === f.id ? theme.accent : theme.border}`,
                background: statusFilter === f.id ? theme.accent : theme.card,
                color: statusFilter === f.id ? theme.accentText : theme.text,
                fontWeight: 700,
                fontSize: 12.5,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, margin: "0 0 14px" }}>{error}</p>}

        {loading ? (
          <p style={{ color: theme.subtext, fontSize: 14 }}>Loading...</p>
        ) : requests.length === 0 ? (
          <div style={{ background: theme.card, border: `1px dashed ${theme.border}`, borderRadius: 20, padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: theme.subtext, margin: 0 }}>Nothing here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((req) => (
              <div
                key={req.id}
                style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: theme.subtext, marginBottom: 3 }}>
                    {TYPE_LABEL[req.type] || req.type}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: theme.text }}>{nameFor(req)}</div>
                  <div style={{ fontSize: 12, color: theme.subtext, marginTop: 3 }}>
                    Requested by {requesterNames[req.requested_by] || req.requested_by}
                  </div>
                </div>

                {req.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => act(req, "approve")}
                      disabled={busyId === req.id}
                      className="gt-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, border: "none", background: "#22c55e22", color: "#22c55e", fontWeight: 700, fontSize: 12.5 }}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => act(req, "reject")}
                      disabled={busyId === req.id}
                      className="gt-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, border: "none", background: "#ef444422", color: "#ef4444", fontWeight: 700, fontSize: 12.5 }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: req.status === "approved" ? "#22c55e" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {req.status === "pending" && <Hourglass size={14} />}
                    {req.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
