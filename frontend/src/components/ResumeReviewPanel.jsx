import { useEffect, useMemo, useState } from "react";
import {
  createResumeReviewRequest,
  deleteResumeReviewRequest,
  getResumeReviewFileUrl,
  getMyResumeReviewFeedback,
  getResumeReviewRequest,
  getResumeReviewRequests,
  submitResumeReviewFeedback,
  updateResumeReviewStatus,
} from "../api/client";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

// ─── Rubric config ────────────────────────────────────────────────────────────
const RUBRIC_CATEGORIES = [
  {
    key: "overallScore",
    setter: "setOverallScore",
    label: "Overall",
    icon: "⭐",
    description: "General quality and completeness",
  },
  {
    key: "impactAndResultsScore",
    setter: "setImpactAndResultsScore",
    label: "Impact & Results",
    icon: "📈",
    description: "Quantified achievements and outcomes",
  },
  {
    key: "roleFitScore",
    setter: "setRoleFitScore",
    label: "Role Fit",
    icon: "🎯",
    description: "Alignment with target role requirements",
  },
  {
    key: "atsClarityScore",
    setter: "setAtsClarityScore",
    label: "ATS Clarity",
    icon: "🤖",
    description: "Keyword optimization and ATS compatibility",
  },
];

const SCORE_LABELS = {
  1: "Needs Major Work",
  2: "Below Expectations",
  3: "Meets Expectations",
  4: "Above Expectations",
  5: "Exceptional",
};

const SUGGESTION_CHIPS = {
  strengths: [
    "Strong use of action verbs",
    "Quantified achievements with metrics",
    "Clear and concise bullet points",
    "Relevant technical skills highlighted",
    "Professional summary is compelling",
    "Consistent formatting throughout",
  ],
  improvements: [
    "Add measurable results to bullet points",
    "Tailor keywords to job description",
    "Strengthen the professional summary",
    "Remove outdated or irrelevant experience",
    "Use stronger action verbs",
    "Improve ATS keyword density",
    "Add missing industry-standard tools",
    "Clarify role scope and team size",
  ],
};

export default function ResumeReviewPanel({ podId, user, isAdmin = false }) {
  // ── existing state ──────────────────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [activeRequestId, setActiveRequestId] = useState("");
  const [activeRequest, setActiveRequest] = useState(null);
  const [myFeedback, setMyFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewingFile, setViewingFile] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [context, setContext] = useState("");
  const [resumeFile, setResumeFile] = useState(null);

  const [overallScore, setOverallScore] = useState(3);
  const [impactAndResultsScore, setImpactAndResultsScore] = useState(3);
  const [roleFitScore, setRoleFitScore] = useState(3);
  const [atsClarityScore, setAtsClarityScore] = useState(3);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [lineLevelSuggestions, setLineLevelSuggestions] = useState("");
  const [finalComments, setFinalComments] = useState("");
  const [recommendation, setRecommendation] = useState("YES_WITH_EDITS");

  // ── new state for User Story 3 ──────────────────────────────────────────────
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState("");
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);

  const scoreSetter = { setOverallScore, setImpactAndResultsScore, setRoleFitScore, setAtsClarityScore };
  const scoreValue = { overallScore, impactAndResultsScore, roleFitScore, atsClarityScore };

  const selectedRequest = useMemo(() => {
    const listMatch = requests.find((r) => r.id === activeRequestId) || null;
    if (activeRequest && activeRequest.id === activeRequestId) return activeRequest;
    return listMatch || activeRequest;
  }, [activeRequest, activeRequestId, requests]);

  useEffect(() => { loadRequests(); }, [podId]);
  useEffect(() => { if (activeRequestId) loadRequest(activeRequestId); }, [activeRequestId]);

  // ── reset AI state when switching requests ──────────────────────────────────
  useEffect(() => {
    setAiSuggestions(null);
    setSummaryPreview("");
    setShowSummaryPreview(false);
  }, [activeRequestId]);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const result = await getResumeReviewRequests(podId);
      setRequests(result.reviewRequests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRequest(requestId) {
    try {
      const result = await getResumeReviewRequest(podId, requestId);
      const reviewRequest = result.reviewRequest || null;
      setActiveRequest(reviewRequest);
      if (reviewRequest?.hasCurrentUserFeedback) {
        try {
          const feedbackResult = await getMyResumeReviewFeedback(podId, requestId);
          setMyFeedback(feedbackResult.feedback || null);
        } catch {
          setMyFeedback(null);
        }
      } else {
        setMyFeedback(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // ── AI suggestions fetch ────────────────────────────────────────────────────
  async function handleLoadAiSuggestions() {
    if (!selectedRequest) return;
    setLoadingAi(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/pods/${podId}/resume-reviews/${selectedRequest.id}/ai-suggestions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to load AI suggestions.");
      const data = await res.json();
      setAiSuggestions(data);
    } catch (err) {
      setError(err.message || "Could not load AI suggestions.");
    } finally {
      setLoadingAi(false);
    }
  }

  // ── suggestion chip handlers ────────────────────────────────────────────────
  function appendChip(setter, currentValue, chip) {
    setter(currentValue ? `${currentValue}\n• ${chip}` : `• ${chip}`);
  }

  // ── summary auto-generation ─────────────────────────────────────────────────
  console.log("Current Selected Request:", selectedRequest);
  async function handleGenerateSummary() {
    console.log("Button Clicked!")
    if (!selectedRequest) return;
    setLoadingAi(true);
    setShowSummaryPreview(false);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/pods/${podId}/resume-reviews/${selectedRequest.id}/ai-summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ strengths, improvements, overallScore }),
        }
      );
      if (!res.ok) throw new Error("Failed to generate summary.");
      const data = await res.json();
      setSummaryPreview(data.summary || "");
      setShowSummaryPreview(true);
    } catch (err) {
      setError(err.message || "Could not generate summary.");
    } finally {
      setLoadingAi(false);
    }
  }

  function useSummaryAsComments() {
    setFinalComments(summaryPreview);
    setShowSummaryPreview(false);
  }

  // ── existing handlers (unchanged) ──────────────────────────────────────────
  async function handleCreateRequest(event) {
    event.preventDefault();
    if (!resumeFile) { setError("Please attach a PDF before creating a request."); return; }
    if (resumeFile.type !== "application/pdf") { setError("Only PDF files are supported."); return; }
    if (resumeFile.size > 10 * 1024 * 1024) { setError("PDF must be 10 MB or smaller."); return; }
    setSaving(true);
    setError("");
    try {
      const base64 = await fileToBase64(resumeFile);
      const result = await createResumeReviewRequest(podId, {
        title, targetRole, context,
        fileName: resumeFile.name,
        mimeType: resumeFile.type,
        contentBase64: base64,
      });
      const reviewRequest = result.reviewRequest;
      setTitle(""); setTargetRole(""); setContext(""); setResumeFile(null);
      setRequests((current) => [reviewRequest, ...current]);
      setActiveRequestId(""); setActiveRequest(null); setMyFeedback(null);
      setMessage("Resume review request created with PDF and ready for feedback.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitFeedback(event) {
    event.preventDefault();
    if (!selectedRequest) return;
    setSaving(true);
    setError("");
    try {
      await submitResumeReviewFeedback(podId, selectedRequest.id, {
        overallScore: Number(overallScore),
        impactAndResultsScore: Number(impactAndResultsScore),
        roleFitScore: Number(roleFitScore),
        atsClarityScore: Number(atsClarityScore),
        strengths, improvements, lineLevelSuggestions, finalComments, recommendation,
      });
      setMyFeedback({
        overallScore: Number(overallScore),
        impactAndResultsScore: Number(impactAndResultsScore),
        roleFitScore: Number(roleFitScore),
        atsClarityScore: Number(atsClarityScore),
        strengths, improvements, lineLevelSuggestions, finalComments, recommendation,
      });
      setMessage("Feedback submitted.");
      await loadRequest(selectedRequest.id);
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseStatus(status) {
    if (!selectedRequest) return;
    setSaving(true);
    setError("");
    try {
      await updateResumeReviewStatus(podId, selectedRequest.id, status);
      setMessage(`Request ${status.toLowerCase()}.`);
      await loadRequest(selectedRequest.id);
      await loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRequest() {
    if (!selectedRequest) return;
    const confirmed = window.confirm("Delete this resume review request permanently?");
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      await deleteResumeReviewRequest(podId, selectedRequest.id);
      setMessage("Resume review request deleted.");
      setRequests(requests.filter((item) => item.id !== selectedRequest.id));
      setActiveRequest(null); setActiveRequestId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf() {
    if (!selectedRequest?.file) { setError("No PDF has been uploaded for this request."); return; }
    setViewingFile(true);
    setError("");
    try {
      const result = await getResumeReviewFileUrl(podId, selectedRequest.id);
      if (!result?.signedUrl) throw new Error("Could not get a secure PDF link.");
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Could not open resume PDF.");
    } finally {
      setViewingFile(false);
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  const isRequester = selectedRequest?.requesterId === user.id;
  const canReview = Boolean(selectedRequest?.canCurrentUserReview);
  const currentUserHasFeedback = Boolean(selectedRequest?.hasCurrentUserFeedback || myFeedback);

  function formatRequestDate(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function statusClass(status) {
    if (status === "OPEN") return "resume-status open";
    if (status === "CLOSED") return "resume-status closed";
    return "resume-status";
  }

  function hasCurrentUserReviewed(reviewRequest) {
    return Boolean(
      reviewRequest?.hasCurrentUserFeedback ||
      reviewRequest?.feedback?.some((fb) => fb.reviewerId === user.id)
    );
  }

  function feedbackCount(reviewRequest) {
    return reviewRequest?.feedbackCount ?? reviewRequest?.feedback?.length ?? 0;
  }

  function scoreOutOfFive(value) {
    return typeof value === "number" ? `${value}/5` : "Not provided";
  }

  function textOrFallback(value, fallback = "None") {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }

  function reviewStateClass(reviewRequest) {
    const isOwner = reviewRequest.requesterId === user.id;
    if (isOwner) return "resume-badge neutral";
    if (hasCurrentUserReviewed(reviewRequest)) return "resume-badge reviewed";
    if (reviewRequest.status === "OPEN") return "resume-badge pending-review";
    return "resume-badge neutral";
  }

  function reviewStateLabel(reviewRequest) {
    const isOwner = reviewRequest.requesterId === user.id;
    if (isOwner) return "Your request";
    if (hasCurrentUserReviewed(reviewRequest)) return "Reviewed by you";
    if (reviewRequest.status === "OPEN") return "Not reviewed";
    return "Closed";
  }

  function renderFormattedFeedback(feedback, key) {
    return (
      <div key={key} className="reflection-card">
        {/* Score summary row */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {RUBRIC_CATEGORIES.map((cat) => (
            <span key={cat.key} style={{ fontSize: "0.8rem", background: "var(--surface-alt, #f3f4f6)", borderRadius: 6, padding: "2px 8px" }}>
              {cat.icon} {cat.label}: <strong>{scoreOutOfFive(feedback?.[cat.key])}</strong>
            </span>
          ))}
        </div>
        {feedback?.recommendation && (
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>Recommendation:</strong>{" "}
            <span style={{ color: feedback.recommendation === "STRONG_YES" ? "#16a34a" : feedback.recommendation === "NEEDS_MAJOR_REVISION" ? "#dc2626" : "#d97706" }}>
              {feedback.recommendation === "STRONG_YES" ? "✅ Strong Yes"
                : feedback.recommendation === "YES_WITH_EDITS" ? "✏️ Yes with Edits"
                : "🔄 Needs Major Revision"}
            </span>
          </p>
        )}
        <p><strong>Strengths:</strong> {textOrFallback(feedback?.strengths)}</p>
        <p><strong>Improvements:</strong> {textOrFallback(feedback?.improvements)}</p>
        {feedback?.lineLevelSuggestions && (
          <p><strong>Line-level suggestions:</strong> {textOrFallback(feedback.lineLevelSuggestions)}</p>
        )}
        <p><strong>Final comments:</strong> {textOrFallback(feedback?.finalComments)}</p>
      </div>
    );
  }

  function renderAiInsightsPanel() {
    const atsScore = aiSuggestions?.atsResult?.atsScore;
    const hasAtsScore = Number.isFinite(atsScore);
    const atsPercent = hasAtsScore ? atsScore : 0;
    return (
      <div style={{
        background: "linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)",
        border: "1px solid #c4b5fd",
        borderRadius: 10,
        padding: "1rem",
        marginBottom: "1rem",
      }}>
        <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>✨ AI Resume Insights</p>
        <p className="helper-copy" style={{ marginBottom: "0.75rem" }}>
          Generate AI feedback for this resume request, including ATS score and suggested strengths/improvements.
        </p>
        <button
          type="button"
          className="secondary-action"
          onClick={handleLoadAiSuggestions}
          disabled={loadingAi}
        >
          {loadingAi ? "Generating..." : aiSuggestions ? "🔄 Refresh AI Insights" : "✨ Get AI Insights"}
        </button>

        {aiSuggestions && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <strong>ATS Score:</strong>
              <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 99, height: 8, maxWidth: 180 }}>
                <div
                  style={{
                    width: `${atsPercent}%`,
                    background:
                      atsPercent >= 70
                        ? "#16a34a"
                        : atsPercent >= 40
                          ? "#d97706"
                          : "#dc2626",
                    borderRadius: 99,
                    height: "100%",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{hasAtsScore ? `${atsScore}%` : "N/A"}</span>
            </div>

            {aiSuggestions?.atsResult?.insufficientContext && (
              <p className="helper-copy" style={{ marginBottom: "0.5rem" }}>
                ATS score needs more resume context text. Add more details in the request context for a stronger estimate.
              </p>
            )}

            {aiSuggestions.aiSuggestions?.clarityTips?.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <strong>Strengths:</strong>
                <ul style={{ margin: "0.35rem 0 0 1.1rem", padding: 0 }}>
                  {aiSuggestions.aiSuggestions.clarityTips.map((tip) => (
                    <li key={tip} style={{ marginBottom: "0.2rem" }}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiSuggestions.aiSuggestions?.impactTips?.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <strong>Weaknesses:</strong>
                <ul style={{ margin: "0.35rem 0 0 1.1rem", padding: 0 }}>
                  {aiSuggestions.aiSuggestions.impactTips.map((tip) => (
                    <li key={tip} style={{ marginBottom: "0.2rem" }}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiSuggestions.aiSuggestions?.summaryDraft && (
              <p><strong>Summary:</strong> {aiSuggestions.aiSuggestions.summaryDraft}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────────
  if (loading) return <div className="helper-copy">Loading resume reviews...</div>;

  return (
    <section className="detail-card">
      <h2>Resume Review</h2>
      {message && <p className="success-toast">{message}</p>}
      {error && <p className="error-banner">{error}</p>}

      {/* ── Create request form (unchanged) ── */}
      <form className="rituals-form" onSubmit={handleCreateRequest}>
        <label>
          Request title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Portfolio resume review" required />
        </label>
        <label>
          Target role
          <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Frontend Engineer" />
        </label>
        <label>
          Context
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} placeholder="Tell reviewers what kind of feedback you want." />
        </label>
        <label>
          Resume PDF (required)
          <input type="file" accept="application/pdf" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} required />
        </label>
        {resumeFile && (
          <p className="helper-copy">Selected: {resumeFile.name} ({(resumeFile.size / (1024 * 1024)).toFixed(2)} MB)</p>
        )}
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving..." : "Create Resume Review"}
        </button>
      </form>

      {/* ── Request list (unchanged) ── */}
      <div className="reflections-list">
        <h3>Requests in this pod</h3>
        {requests.length === 0 ? (
          <p className="helper-copy">No resume reviews yet.</p>
        ) : (
          <div className="resume-request-list">
            {requests.map((reviewRequest) => (
              <button
                key={reviewRequest.id}
                type="button"
                className={reviewRequest.id === activeRequestId ? "resume-request-item active" : "resume-request-item"}
                onClick={() => setActiveRequestId(reviewRequest.id)}
              >
                <span className="resume-request-title">{reviewRequest.title}</span>
                <span className="resume-request-meta">
                  <span className={statusClass(reviewRequest.status)}>{reviewRequest.status}</span>
                  <span className={reviewRequest.file ? "resume-badge ready" : "resume-badge missing"}>
                    {reviewRequest.file ? "PDF attached" : "No PDF"}
                  </span>
                  <span className={reviewStateClass(reviewRequest)}>{reviewStateLabel(reviewRequest)}</span>
                  <span className="resume-badge neutral">{feedbackCount(reviewRequest)} feedback</span>
                  <span className="resume-badge neutral">Updated {formatRequestDate(reviewRequest.updatedAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Selected request detail ── */}
      {selectedRequest ? (
        <div className="reflections-list">
          <h3>{selectedRequest.title}</h3>
          <p className="helper-copy">{selectedRequest.context || "No context provided."}</p>
          <p className="helper-copy">Target role: {selectedRequest.targetRole || "Not set"}</p>
          <p className="helper-copy">Status: {selectedRequest.status}</p>
          <p className="helper-copy">File: {selectedRequest.file?.originalFileName || "Not uploaded yet"}</p>

          {selectedRequest.file && (
            <button type="button" className="secondary-action" disabled={viewingFile} onClick={handleViewPdf}>
              {viewingFile ? "Opening PDF..." : "View Resume PDF"}
            </button>
          )}

          {selectedRequest.status === "CLOSED" && (
            <p className="helper-copy">This request is closed. Existing feedback remains visible, and no new feedback can be submitted.</p>
          )}

          {/* ── Feedback display (owner / admin) ── */}
          {isRequester || isAdmin ? (
            <>
              {isRequester && renderAiInsightsPanel()}
              <h4>Feedback from reviewers</h4>
              {selectedRequest.feedback?.length ? (
                selectedRequest.feedback.map((fb) => renderFormattedFeedback(fb, fb.id))
              ) : feedbackCount(selectedRequest) > 0 ? (
                <p className="helper-copy">Loading feedback...</p>
              ) : (
                <p className="helper-copy">No feedback yet.</p>
              )}
            </>
          ) : currentUserHasFeedback ? (
            /* ── Already submitted ── */
            <>
              <h4>Your feedback</h4>
              {myFeedback ? (
                renderFormattedFeedback(myFeedback, `mine-${selectedRequest.id}`)
              ) : (
                <p className="helper-copy">Feedback was submitted, but it could not be loaded right now.</p>
              )}
            </>
          ) : canReview ? (
            /* ══════════════════════════════════════════════════════════════════
               USER STORY 3 — STRUCTURED FEEDBACK FORM
            ══════════════════════════════════════════════════════════════════ */
            <form className="rituals-form" onSubmit={handleSubmitFeedback}>

              {/* ── AI Suggestions Panel ── */}
              <div style={{
                background: "linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)",
                border: "1px solid #c4b5fd",
                borderRadius: 10,
                padding: "1rem",
                marginBottom: "1rem",
              }}>
                {(() => {
                  const atsScore = aiSuggestions?.atsResult?.atsScore;
                  const hasAtsScore = Number.isFinite(atsScore);
                  const atsPercent = hasAtsScore ? atsScore : 0;
                  return (
                    <>
                <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>✨ AI-Powered Feedback Assistance</p>
                <p className="helper-copy" style={{ marginBottom: "0.75rem" }}>
                  Get structured suggestions based on the resume context and target role, then click any chip to add it to your feedback.
                </p>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleLoadAiSuggestions}
                  disabled={loadingAi}
                >
                  {loadingAi ? "Generating..." : aiSuggestions ? "🔄 Refresh AI Suggestions" : "✨ Get AI Feedback Prompts"}
                </button>

                {/* ── AI keyword scan results ── */}
                {aiSuggestions && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <strong>ATS Score:</strong>
                      <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 99, height: 8, maxWidth: 180 }}>
                        <div style={{
                          width: `${atsPercent}%`,
                          background: atsPercent >= 70 ? "#16a34a" : atsPercent >= 40 ? "#d97706" : "#dc2626",
                          borderRadius: 99,
                          height: "100%",
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{hasAtsScore ? `${atsScore}%` : "N/A"}</span>
                    </div>

                    {aiSuggestions?.atsResult?.insufficientContext && (
                      <p className="helper-copy" style={{ marginBottom: "0.5rem" }}>
                        ATS score needs more resume context text. Add more details in the request context for a stronger estimate.
                      </p>
                    )}

                    {aiSuggestions.atsResult?.missing?.length > 0 && (
                      <>
                        <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "0.35rem" }}>
                          🔍 Missing ATS keywords — click to add to Improvements:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "0.5rem" }}>
                          {aiSuggestions.atsResult.missing.map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => appendChip(setImprovements, improvements, `Add keyword: "${kw}"`)}
                              style={{
                                background: "#fee2e2",
                                border: "1px solid #fca5a5",
                                borderRadius: 6,
                                padding: "2px 10px",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                                color: "#991b1b",
                              }}
                            >
                              + {kw}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {aiSuggestions.atsResult?.found?.length > 0 && (
                      <>
                        <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "0.35rem" }}>
                          ✅ Detected keywords:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {aiSuggestions.atsResult.found.map((kw) => (
                            <span
                              key={kw}
                              style={{
                                background: "#dcfce7",
                                border: "1px solid #86efac",
                                borderRadius: 6,
                                padding: "2px 10px",
                                fontSize: "0.8rem",
                                color: "#166534",
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                    </>
                  );
                })()}
              </div>

              {/* ── Feedback Rubric — Rating Sliders ── */}
              <div style={{
                background: "#f8faff",
                border: "1px solid #e0e7ff",
                borderRadius: 10,
                padding: "1rem",
                marginBottom: "1rem",
              }}>
                <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>📋 Feedback Rubric</p>
                {RUBRIC_CATEGORIES.map((cat) => {
                  const val = scoreValue[cat.key];
                  return (
                    <div key={cat.key} style={{ marginBottom: "0.85rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                        <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                          {cat.icon} {cat.label}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "#6366f1", fontWeight: 700 }}>
                          {val}/5 — {SCORE_LABELS[val]}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0 0 0.3rem" }}>{cat.description}</p>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={val}
                        onChange={(e) => scoreSetter[cat.setter](Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#6366f1" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#9ca3af" }}>
                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Strengths with pre-written chips ── */}
              <label>
                Strengths
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "0.4rem", marginTop: "0.3rem" }}>
                  {SUGGESTION_CHIPS.strengths.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => appendChip(setStrengths, strengths, chip)}
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #86efac",
                        borderRadius: 6,
                        padding: "2px 10px",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        color: "#166534",
                      }}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
                {/* AI-generated strength tips */}
                {aiSuggestions?.aiSuggestions?.clarityTips && (
                  <div style={{ marginBottom: "0.4rem" }}>
                    <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.25rem" }}>✨ AI suggestions:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {aiSuggestions.aiSuggestions.clarityTips.map((tip) => (
                        <button
                          key={tip}
                          type="button"
                          onClick={() => appendChip(setStrengths, strengths, tip)}
                          style={{
                            background: "#ede9fe",
                            border: "1px solid #c4b5fd",
                            borderRadius: 6,
                            padding: "2px 10px",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            color: "#6d28d9",
                          }}
                        >
                          + {tip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  rows={3}
                  required
                  placeholder="What does this resume do well?"
                />
              </label>

              {/* ── Improvements with pre-written chips ── */}
              <label>
                Improvements
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "0.4rem", marginTop: "0.3rem" }}>
                  {SUGGESTION_CHIPS.improvements.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => appendChip(setImprovements, improvements, chip)}
                      style={{
                        background: "#fff7ed",
                        border: "1px solid #fdba74",
                        borderRadius: 6,
                        padding: "2px 10px",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        color: "#9a3412",
                      }}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
                {/* AI-generated improvement tips */}
                {aiSuggestions?.aiSuggestions?.impactTips && (
                  <div style={{ marginBottom: "0.4rem" }}>
                    <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.25rem" }}>✨ AI suggestions:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[...( aiSuggestions.aiSuggestions.impactTips || []), ...(aiSuggestions.aiSuggestions.formattingTips || [])].map((tip) => (
                        <button
                          key={tip}
                          type="button"
                          onClick={() => appendChip(setImprovements, improvements, tip)}
                          style={{
                            background: "#ede9fe",
                            border: "1px solid #c4b5fd",
                            borderRadius: 6,
                            padding: "2px 10px",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            color: "#6d28d9",
                          }}
                        >
                          + {tip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  rows={3}
                  required
                  placeholder="What should be improved?"
                />
              </label>

              {/* ── Line-level suggestions ── */}
              <label>
                Line-level suggestions
                <textarea
                  value={lineLevelSuggestions}
                  onChange={(e) => setLineLevelSuggestions(e.target.value)}
                  rows={2}
                  placeholder='e.g. "Bullet 3 under Experience — replace "responsible for" with a strong action verb"'
                />
              </label>

              {/* ── Final comments with AI summary generator ── */}
              <label>
                Final comments
                <div style={{ display: "flex", gap: 8, marginBottom: "0.4rem", marginTop: "0.3rem" }}>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={handleGenerateSummary}
                    disabled={loadingAi || !strengths.trim() || !improvements.trim()}
                    title={(!strengths.trim() || !improvements.trim()) ? "Please add strengths and improvements first" : "Generate AI Summary"}
                    style={{ fontSize: "0.82rem" }}
                  >
                    {loadingAi ? "Generating..." : "✨ Generate Summary"}
                  </button>
                </div>
                {showSummaryPreview && (
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: 8,
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.88rem",
                  }}>
                    <p style={{ fontWeight: 600, marginBottom: "0.3rem" }}>📝 AI-generated summary preview:</p>
                    <p style={{ color: "#374151" }}>{summaryPreview}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: "0.5rem" }}>
                      <button
                        type="button"
                        className="primary"
                        style={{ fontSize: "0.82rem", padding: "4px 12px" }}
                        onClick={useSummaryAsComments}
                      >
                        Use this
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        style={{ fontSize: "0.82rem" }}
                        onClick={() => setShowSummaryPreview(false)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                <textarea
                  value={finalComments}
                  onChange={(e) => setFinalComments(e.target.value)}
                  rows={3}
                  placeholder="Overall summary for the resume author..."
                />
              </label>

              {/* ── Recommendation selector ── */}
              <label>
                Recommendation
                <div style={{ display: "flex", gap: 8, marginTop: "0.3rem", flexWrap: "wrap" }}>
                  {[
                    { value: "STRONG_YES", label: "✅ Strong Yes", color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
                    { value: "YES_WITH_EDITS", label: "✏️ Yes with Edits", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
                    { value: "NEEDS_MAJOR_REVISION", label: "🔄 Needs Major Revision", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRecommendation(opt.value)}
                      style={{
                        background: recommendation === opt.value ? opt.bg : "#f9fafb",
                        border: `2px solid ${recommendation === opt.value ? opt.border : "#e5e7eb"}`,
                        borderRadius: 8,
                        padding: "6px 14px",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        color: recommendation === opt.value ? opt.color : "#6b7280",
                        fontWeight: recommendation === opt.value ? 700 : 400,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </label>

              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Submitting..." : "Submit Feedback"}
              </button>
            </form>
          ) : (
            <p className="helper-copy">You can view this request, but you are not eligible to submit feedback on it.</p>
          )}

          {/* ── Owner/admin actions (unchanged) ── */}
          {(isRequester || isAdmin) && selectedRequest.status === "OPEN" && (
            <div className="hero-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="secondary-action danger-action" disabled={saving} onClick={handleDeleteRequest}>
                Delete Request
              </button>
              <button type="button" className="secondary-action" disabled={saving} onClick={() => handleCloseStatus("CLOSED")}>
                Close Request
              </button>
            </div>
          )}
          {(isRequester || isAdmin) && selectedRequest.status === "OPEN" && (
            <p className="helper-copy">Close Request keeps it visible but stops new feedback. Delete Request removes it.</p>
          )}
        </div>
      ) : (
        <div className="reflections-list">
          <p className="helper-copy">Select a resume review card to open details and the feedback form.</p>
        </div>
      )}
    </section>
  );
}