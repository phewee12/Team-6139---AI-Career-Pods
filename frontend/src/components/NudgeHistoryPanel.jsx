import { useState } from "react";
import { NUDGE_QUICK_REPLIES } from "../constants/accountability";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NudgeHistoryPanel({ history, onRespond, respondBusy, loading }) {
  const [tab, setTab] = useState("received");

  if (loading) {
    return (
      <article className="detail-card nudge-history-card">
        <h2>Nudge activity</h2>
        <p className="helper-copy">Loading…</p>
      </article>
    );
  }

  const sent = history?.sent || [];
  const received = history?.received || [];

  return (
    <article className="detail-card nudge-history-card">
      <h2>Nudge activity</h2>
      <p className="helper-copy nudge-privacy-note">
        A lightweight log for you. We never show private notes to the whole pod—only that a supportive nudge
        was sent.
      </p>
      <div className="nudge-history-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "received"}
          className={tab === "received" ? "nudge-tab active" : "nudge-tab"}
          onClick={() => setTab("received")}
        >
          Received ({received.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sent"}
          className={tab === "sent" ? "nudge-tab active" : "nudge-tab"}
          onClick={() => setTab("sent")}
        >
          Sent ({sent.length})
        </button>
      </div>

      {tab === "received" && (
        <ul className="nudge-history-list">
          {received.length === 0 ? (
            <li className="nudge-history-empty">No nudges received this period.</li>
          ) : (
            received.map((row) => (
              <li key={row.id} className="nudge-history-item">
                <div className="nudge-history-meta">
                  <span className="nudge-history-who">
                    {row.displayAsAnonymous ? "A podmate" : row.fromName || "A podmate"}
                  </span>
                  <time dateTime={row.sentAt}>{formatWhen(row.sentAt)}</time>
                </div>
                {row.preview && <p className="nudge-history-preview">{row.preview}</p>}
                {!row.respondedAt && onRespond && (
                  <div className="nudge-quick-replies">
                    <span className="nudge-reply-label">Quick reply</span>
                    <div className="nudge-reply-buttons">
                      {NUDGE_QUICK_REPLIES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="nudge-reply-chip"
                          disabled={respondBusy}
                          onClick={() => onRespond(row.id, r.id)}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {row.respondedAt && (
                  <p className="nudge-replied">
                    You replied: <strong>{row.quickReply || "—"}</strong>
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "sent" && (
        <ul className="nudge-history-list">
          {sent.length === 0 ? (
            <li className="nudge-history-empty">You have not sent any nudges yet.</li>
          ) : (
            sent.map((row) => (
              <li key={row.id} className="nudge-history-item">
                <div className="nudge-history-meta">
                  <span>To {row.toName || "podmate"}</span>
                  <time dateTime={row.sentAt}>{formatWhen(row.sentAt)}</time>
                </div>
                {row.preview && <p className="nudge-history-preview">{row.preview}</p>}
              </li>
            ))
          )}
        </ul>
      )}
    </article>
  );
}
