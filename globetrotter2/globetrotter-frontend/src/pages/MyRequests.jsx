// =============================================================================
// MyRequests.jsx  -  "DID MY SUGGESTION GET APPROVED?"
//
// Part of the roles/approval-workflow feature: a regular traveller can no
// longer edit/add/delete a place directly (see ManagePlaces.jsx and
// PlaceForm.jsx) - they submit a request instead, and this screen is where
// they come back to check whether an admin approved it, rejected it (and
// why), or hasn't looked at it yet.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Hourglass, XCircle } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../theme";

const STATUS_STYLE = {
  pending: { color: "#eab308", icon: Hourglass, label: "Pending review" },
  approved: { color: "#22c55e", icon: CheckCircle2, label: "Approved" },
  rejected: { color: "#ef4444", icon: XCircle, label: "Rejected" },
};

const TYPE_LABEL = { create: "New place", update: "Edit", delete: "Delete" };

export default function MyRequestsScreen() {
  const { theme } = useTheme();
  const [requests, setRequests] = useState([]);
  const [destinationsById, setDestinationsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.listMyDestinationRequests(), api.getDestinations()])
      .then(([reqs, destinations]) => {
        setRequests(reqs);
        setDestinationsById(Object.fromEntries(destinations.map((d) => [d.id, d])));
      })
      .catch((err) => setError(err.message || "Couldn't load your requests."))
      .finally(() => setLoading(false));
  }, []);

  const nameFor = (req) =>
    req.type === "create" ? req.payload?.name || "New place" : destinationsById[req.destination_id]?.name || req.destination_id;

  return (
    <div className="gt-page" style={{ background: theme.bg }}>
      <div className="gt-container" style={{ paddingTop: 20, paddingBottom: 40, maxWidth: 720 }}>
        <Link
          to="/places"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: theme.subtext, textDecoration: "none", marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to places
        </Link>

        <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(22px, 2.6vw, 28px)", color: theme.text, margin: "0 0 8px" }}>
          My requests
        </h1>
        <p style={{ fontSize: 13, color: theme.subtext, margin: "0 0 20px", lineHeight: 1.55 }}>
          Places you've suggested adding, editing or removing. An admin reviews each one before it goes live.
        </p>

        {loading ? (
          <p style={{ color: theme.subtext, fontSize: 14 }}>Loading...</p>
        ) : error ? (
          <p style={{ color: "#ef4444", fontSize: 14, fontWeight: 600 }}>{error}</p>
        ) : requests.length === 0 ? (
          <div style={{ background: theme.card, border: `1px dashed ${theme.border}`, borderRadius: 20, padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: theme.subtext, margin: 0 }}>You haven't suggested any changes yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((req) => {
              const status = STATUS_STYLE[req.status] || STATUS_STYLE.pending;
              const StatusIcon = status.icon;
              return (
                <div
                  key={req.id}
                  style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: theme.subtext, marginBottom: 3 }}>
                      {TYPE_LABEL[req.type] || req.type}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: theme.text }}>{nameFor(req)}</div>
                    {req.status === "rejected" && req.reject_reason && (
                      <div style={{ fontSize: 12.5, color: theme.subtext, marginTop: 4 }}>Reason: {req.reject_reason}</div>
                    )}
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: status.color, whiteSpace: "nowrap" }}>
                    <StatusIcon size={14} /> {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
