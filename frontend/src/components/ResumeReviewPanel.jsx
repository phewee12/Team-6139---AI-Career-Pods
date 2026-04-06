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

export default function ResumeReviewPanel({ podId, user, isAdmin = false }) {
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

  const [overallScore, setOverallScore] = useState(5);
  const [impactAndResultsScore, setImpactAndResultsScore] = useState(5);
  const [roleFitScore, setRoleFitScore] = useState(5);
  const [atsClarityScore, setAtsClarityScore] = useState(5);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [lineLevelSuggestions, setLineLevelSuggestions] = useState("");
  const [finalComments, setFinalComments] = useState("");
  const [recommendation] = useState("YES_WITH_EDITS");

  const selectedRequest = useMemo(() => {
    const listMatch = requests.find((reviewRequest) => reviewRequest.id === activeRequestId) || null;
    if (activeRequest && activeRequest.id === activeRequestId) {
      return activeRequest;
    }
    return listMatch || activeRequest;
  }, [activeRequest, activeRequestId, requests]);

  useEffect(() => {
    loadRequests();
  }, [podId]);

  useEffect(() => {
    if (activeRequestId) {
      loadRequest(activeRequestId);
    }
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

  async function handleCreateRequest(event) {
    event.preventDefault();

    if (!resumeFile) {
      setError("Please attach a PDF before creating a request.");
      return;
    }

    if (resumeFile.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }

    if (resumeFile.size > 10 * 1024 * 1024) {
      setError("PDF must be 10 MB or smaller.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const base64 = await fileToBase64(resumeFile);
      const result = await createResumeReviewRequest(podId, {
        title,
        targetRole,
        context,
        fileName: resumeFile.name,
        mimeType: resumeFile.type,
        contentBase64: base64,
      });

      const reviewRequest = result.reviewRequest;
      setTitle("");
      setTargetRole("");
      setContext("");
      setResumeFile(null);
      setRequests((current) => [reviewRequest, ...current]);
      setActiveRequestId("");
      setActiveRequest(null);
      setMyFeedback(null);
      setMessage("Resume review request created with PDF and ready for feedback.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitFeedback(event) {
    event.preventDefault();

    if (!selectedRequest) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await submitResumeReviewFeedback(podId, selectedRequest.id, {
        overallScore: Number(overallScore),
        impactAndResultsScore: Number(impactAndResultsScore),
        roleFitScore: Number(roleFitScore),
        atsClarityScore: Number(atsClarityScore),
        strengths,
        improvements,
        lineLevelSuggestions,
        finalComments,
        recommendation,
      });

      setMyFeedback({
        overallScore: Number(overallScore),
        impactAndResultsScore: Number(impactAndResultsScore),
        roleFitScore: Number(roleFitScore),
        atsClarityScore: Number(atsClarityScore),
        strengths,
        improvements,
        lineLevelSuggestions,
        finalComments,
        recommendation,
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
    if (!selectedRequest) {
      return;
    }

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
    if (!selectedRequest) {
      return;
    }

    const confirmed = window.confirm("Delete this resume review request permanently?");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await deleteResumeReviewRequest(podId, selectedRequest.id);
      setMessage("Resume review request deleted.");
      const remaining = requests.filter((item) => item.id !== selectedRequest.id);
      setRequests(remaining);
      setActiveRequest(null);
      setActiveRequestId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf() {
    if (!selectedRequest?.file) {
      setError("No PDF has been uploaded for this request.");
      return;
    }

    setViewingFile(true);
    setError("");

    try {
      const result = await getResumeReviewFileUrl(podId, selectedRequest.id);
      if (!result?.signedUrl) {
        throw new Error("Could not get a secure PDF link.");
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Could not open resume PDF.");
    } finally {
      setViewingFile(false);
    }
  }

  const isRequester = selectedRequest?.requesterId === user.id;
  const canReview = Boolean(selectedRequest?.canCurrentUserReview);
  const currentUserHasFeedback = Boolean(selectedRequest?.hasCurrentUserFeedback || myFeedback);

  function formatRequestDate(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function statusClass(status) {
    if (status === "OPEN") return "resume-status open";
    if (status === "CLOSED") return "resume-status closed";
    return "resume-status";
  }

  function hasCurrentUserReviewed(reviewRequest) {
    return Boolean(reviewRequest?.hasCurrentUserFeedback || reviewRequest?.feedback?.some((feedback) => feedback.reviewerId === user.id));
  }

  function feedbackCount(reviewRequest) {
    return reviewRequest?.feedbackCount ?? reviewRequest?.feedback?.length ?? 0;
  }

  function scoreOutOfFive(value) {
    return typeof value === "number" ? `${value}/5` : "Not provided";
  }

  function textOrFallback(value, fallback = "None") {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }

  function renderFormattedFeedback(feedback, key) {
    return (
      <div key={key} className="reflection-card">
        <p><strong>Score:</strong> {scoreOutOfFive(feedback?.overallScore)}</p>
        <p><strong>Strengths:</strong> {textOrFallback(feedback?.strengths)}</p>
        <p><strong>Weaknesses:</strong> {textOrFallback(feedback?.improvements)}</p>
        <p><strong>Comments:</strong> {textOrFallback(feedback?.finalComments)}</p>
      </div>
    );
  }

  function reviewStateClass(reviewRequest) {
    const isRequestOwner = reviewRequest.requesterId === user.id;
    if (isRequestOwner) return "resume-badge neutral";
    if (hasCurrentUserReviewed(reviewRequest)) return "resume-badge reviewed";
    if (reviewRequest.status === "OPEN") return "resume-badge pending-review";
    return "resume-badge neutral";
  }

  function reviewStateLabel(reviewRequest) {
    const isRequestOwner = reviewRequest.requesterId === user.id;
    if (isRequestOwner) return "Your request";
    if (hasCurrentUserReviewed(reviewRequest)) return "Reviewed by you";
    if (reviewRequest.status === "OPEN") return "Not reviewed";
    return "Closed";
  }

  if (loading) {
    return <div className="helper-copy">Loading resume reviews...</div>;
  }

  return (
    <section className="detail-card">
      <h2>Resume Review</h2>
      {message && <p className="success-toast">{message}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="rituals-form" onSubmit={handleCreateRequest}>
        <label>
          Request title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Portfolio resume review" required />
        </label>
        <label>
          Target role
          <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Frontend Engineer" />
        </label>
        <label>
          Context
          <textarea value={context} onChange={(event) => setContext(event.target.value)} rows={3} placeholder="Tell reviewers what kind of feedback you want." />
        </label>
        <label>
          Resume PDF (required)
          <input type="file" accept="application/pdf" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} required />
        </label>
        {resumeFile && (
          <p className="helper-copy">
            Selected: {resumeFile.name} ({(resumeFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        )}
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving..." : "Create Resume Review"}
        </button>
      </form>

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
                <span className="resume-badge neutral">
                  {feedbackCount(reviewRequest)} feedback
                </span>
                <span className="resume-badge neutral">Updated {formatRequestDate(reviewRequest.updatedAt)}</span>
              </span>
            </button>
            ))}
          </div>
        )}
      </div>

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

          {isRequester || isAdmin ? (
            <>
              <h4>Feedback from reviewers</h4>
              {selectedRequest.feedback?.length ? (
                selectedRequest.feedback.map((feedback) => renderFormattedFeedback(feedback, feedback.id))
              ) : feedbackCount(selectedRequest) > 0 ? (
                <p className="helper-copy">Loading feedback...</p>
              ) : (
                <p className="helper-copy">No feedback yet.</p>
              )}
            </>
          ) : currentUserHasFeedback ? (
            <>
              <h4>Your feedback</h4>
              {myFeedback ? (
                renderFormattedFeedback(myFeedback, `mine-${selectedRequest.id}`)
              ) : (
                <p className="helper-copy">Feedback was submitted, but it could not be loaded right now.</p>
              )}
            </>
          ) : canReview ? (
            <form className="rituals-form" onSubmit={handleSubmitFeedback}>
              <label>
                Overall score
                <input type="number" min="1" max="5" value={overallScore} onChange={(event) => setOverallScore(event.target.value)} />
              </label>
              <label>
                Strengths
                <textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} rows={3} required />
              </label>
              <label>
                Improvements
                <textarea value={improvements} onChange={(event) => setImprovements(event.target.value)} rows={3} required />
              </label>
              <label>
                Final comments
                <textarea value={finalComments} onChange={(event) => setFinalComments(event.target.value)} rows={3} />
              </label>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Submitting..." : "Submit Feedback"}
              </button>
            </form>
          ) : (
            <p className="helper-copy">You can view this request, but you are not eligible to submit feedback on it.</p>
          )}

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