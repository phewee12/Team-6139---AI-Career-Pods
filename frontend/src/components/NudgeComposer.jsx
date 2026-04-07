import { useState } from "react";
import {
  applyTemplate,
  NUDGE_CUSTOM_MAX_LENGTH,
  NUDGE_TEMPLATES,
} from "../constants/accountability";

export default function NudgeComposer({ open, onClose, recipient, onSend, busy }) {
  const [mode, setMode] = useState("template");
  const [templateId, setTemplateId] = useState(NUDGE_TEMPLATES[0]?.id || "");
  const [customText, setCustomText] = useState("");
  const [sendError, setSendError] = useState("");

  if (!open || !recipient) {
    return null;
  }

  const name = recipient.fullName || recipient.email || "Member";
  const selectedTemplate = NUDGE_TEMPLATES.find((t) => t.id === templateId);

  function previewMessage() {
    if (mode === "custom") {
      return customText.trim();
    }
    if (!selectedTemplate) return "";
    return applyTemplate(selectedTemplate.body, recipient.fullName, recipient.email);
  }

  async function handleSend() {
    setSendError("");
    const message = previewMessage();
    if (!message) {
      setSendError("Add a message to send.");
      return;
    }
    if (mode === "custom" && message.length > NUDGE_CUSTOM_MAX_LENGTH) {
      setSendError(`Please keep custom messages under ${NUDGE_CUSTOM_MAX_LENGTH} characters.`);
      return;
    }
    try {
      await onSend({
        message,
        templateId: mode === "template" ? templateId : null,
      });
      setCustomText("");
      setMode("template");
      onClose();
    } catch (e) {
      setSendError(e.message || "Could not send.");
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Send a supportive nudge">
      <div className="modal-content nudge-composer-modal">
        <div className="members-view-header">
          <h2>Nudge {name}</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="helper-copy nudge-composer-lead">
          Gentle check-ins feel better than pressure. Pick a template or write your own.
        </p>

        <div className="nudge-mode-toggle" role="tablist" aria-label="Message type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "template"}
            className={mode === "template" ? "nudge-tab active" : "nudge-tab"}
            onClick={() => setMode("template")}
          >
            Templates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={mode === "custom" ? "nudge-tab active" : "nudge-tab"}
            onClick={() => setMode("custom")}
          >
            Custom
          </button>
        </div>

        {mode === "template" && (
          <div className="nudge-template-list">
            {NUDGE_TEMPLATES.map((t) => (
              <label key={t.id} className={`nudge-template-option ${templateId === t.id ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="nudge-template"
                  value={t.id}
                  checked={templateId === t.id}
                  onChange={() => setTemplateId(t.id)}
                />
                <span className="nudge-template-label">{t.label}</span>
                <span className="nudge-template-preview">
                  {applyTemplate(t.body, recipient.fullName, recipient.email)}
                </span>
              </label>
            ))}
          </div>
        )}

        {mode === "custom" && (
          <div className="nudge-custom-wrap">
            <textarea
              className="intro-textarea"
              rows={4}
              maxLength={NUDGE_CUSTOM_MAX_LENGTH}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Write something kind and low-pressure…"
            />
            <p className="char-count">
              {customText.length}/{NUDGE_CUSTOM_MAX_LENGTH}
            </p>
          </div>
        )}

        <div className="nudge-preview-box">
          <strong>Preview</strong>
          <p>{previewMessage() || "—"}</p>
        </div>

        {sendError && <p className="error-banner">{sendError}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="floating-action" onClick={handleSend} disabled={busy}>
            {busy ? "Sending…" : "Send nudge"}
          </button>
        </div>
      </div>
    </div>
  );
}
