import { useEffect, useState } from "react";
import { firstName, quietModeAnnouncement } from "../constants/accountability";

export default function QuietModeControl({ user, quietMode, onSave, loading }) {
  const [enabled, setEnabled] = useState(Boolean(quietMode?.enabled));
  const [until, setUntil] = useState(quietMode?.until ? quietMode.until.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setEnabled(Boolean(quietMode?.enabled));
    setUntil(quietMode?.until ? quietMode.until.slice(0, 10) : "");
  }, [quietMode?.enabled, quietMode?.until]);

  const displayName = firstName(user?.fullName, user?.email);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await onSave({
        enabled,
        until: enabled && until ? new Date(`${until}T23:59:59`).toISOString() : null,
        announcedToPod: true,
      });
    } catch (e2) {
      setErr(e2.message || "Could not update quiet mode.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <article className="detail-card quiet-mode-card">
      <h2>Quiet mode</h2>
      <p className="helper-copy">
        Pause incoming nudges if you need space. Your pod will see a gentle note—never the contents of past
        nudges.
      </p>
      <form onSubmit={handleSubmit} className="quiet-mode-form">
        <label className="acknowledge-checkbox">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Temporarily pause nudges to me</span>
        </label>
        {enabled && (
          <>
            <label className="quiet-until-label">
              Optional: pause through
              <input
                type="date"
                className="quiet-date-input"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
            <div className="quiet-preview" role="status">
              <strong>Pod will see:</strong> {quietModeAnnouncement(displayName)}
            </div>
          </>
        )}
        {err && <p className="error-banner">{err}</p>}
        <button type="submit" className="secondary-action" disabled={saving}>
          {saving ? "Saving…" : "Save quiet mode"}
        </button>
      </form>
    </article>
  );
}
