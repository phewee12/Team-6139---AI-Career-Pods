import { useEffect, useMemo, useState } from "react";
import {
  createResumeReviewRequest,
  getMyResumeReviewFeedback,
  getResumeReviewFeedback,
  getResumeReviewRequest,
  getResumeReviewRequests,
  submitResumeReviewFeedback,
  updateResumeReviewStatus,
  uploadResumeReviewFile,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [recommendation, setRecommendation] = useState("YES_WITH_EDITS");

  const selectedRequest = useMemo(
    () => requests.find((reviewRequest) => reviewRequest.id === activeRequestId) || activeRequest,
    [activeRequest, activeRequestId, requests],
  );

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
      if (!activeRequestId && result.reviewRequests?.length > 0) {
        setActiveRequestId(result.reviewRequests[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRequest(requestId) {
    try {
      const result = await getResumeReviewRequest(podId, requestId);
      setActiveRequest(result.reviewRequest || null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateRequest(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await createResumeReviewRequest(podId, {
        title,
        targetRole,
        context,
      });

      const reviewRequest = result.reviewRequest;
      setTitle("");
      setTargetRole("");
      setContext("");
      setResumeFile(null);
      setRequests((current) => [reviewRequest, ...current]);
      setActiveRequestId(reviewRequest.id);
      setMessage("Resume review request created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadFile(requestId) {
    if (!resumeFile) {
      setError("Choose a PDF first.");
      return;
    }

    if (resumeFile.type !== "application/pdf") {
      setError("Resume must be a PDF.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const base64 = await fileToBase64(resumeFile);
      await uploadResumeReviewFile(podId, requestId, {
        fileName: resumeFile.name,
        mimeType: resumeFile.type,
        contentBase64: base64,
      });

      setMessage("Resume uploaded.");
      await loadRequest(requestId);
      await loadRequests();
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

      setMessage("Feedback submitted.");
      await loadRequest(selectedRequest.id);
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

  async function loadMyFeedback() {
    if (!selectedRequest) {
      return;
    }

    try {
      const result = await getMyResumeReviewFeedback(podId, selectedRequest.id);
      return result.feedback;
    } catch {
      return null;
    }
  }

  const isRequester = selectedRequest?.requesterId === user.id;
  const canReview = Boolean(selectedRequest) && !isRequester && !selectedRequest?.feedback?.some((feedback) => feedback.reviewerId === user.id);

  useEffect(() => {
    if (selectedRequest && isRequester) {
      loadMyFeedback();
    }
  }, [selectedRequest, isRequester]);

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
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving..." : "Create Resume Review"}
        </button>
      </form>

      <div className="rituals-form">
        <label>
          Upload PDF
          <input type="file" accept="application/pdf" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} />
        </label>
        <button type="button" className="secondary-action" disabled={!selectedRequest || !resumeFile || saving} onClick={() => handleUploadFile(selectedRequest.id)}>
          Upload Resume PDF
        </button>
      </div>

      <div className="reflections-list">
        <h3>Requests in this pod</h3>
        {requests.length === 0 ? (
          <p className="helper-copy">No resume reviews yet.</p>
        ) : (
          requests.map((reviewRequest) => (
            <button
              key={reviewRequest.id}
              type="button"
              className={reviewRequest.id === activeRequestId ? "related-item active" : "related-item"}
              onClick={() => setActiveRequestId(reviewRequest.id)}
            >
              {reviewRequest.title} · {reviewRequest.status}
            </button>
          ))
        )}
      </div>

      {selectedRequest && (
        <div className="reflections-list">
          <h3>{selectedRequest.title}</h3>
          <p className="helper-copy">{selectedRequest.context || "No context provided."}</p>
          <p className="helper-copy">Target role: {selectedRequest.targetRole || "Not set"}</p>
          <p className="helper-copy">Status: {selectedRequest.status}</p>
          <p className="helper-copy">File: {selectedRequest.file?.originalFileName || "Not uploaded yet"}</p>

          {isRequester || isAdmin ? (
            <>
              <h4>Feedback for requester</h4>
              {selectedRequest.feedback?.length ? (
                selectedRequest.feedback.map((feedback) => (
                  <div key={feedback.id} className="reflection-card">
                    <p>{feedback.strengths}</p>
                    <p>{feedback.improvements}</p>
                    {feedback.finalComments && <p>{feedback.finalComments}</p>}
                  </div>
                ))
              ) : (
                <p className="helper-copy">No feedback yet.</p>
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

          {(isRequester || isAdmin) && (
            <div className="hero-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="secondary-action danger-action" disabled={saving} onClick={() => handleCloseStatus("WITHDRAWN")}>
                Withdraw
              </button>
              <button type="button" className="secondary-action" disabled={saving} onClick={() => handleCloseStatus("CLOSED")}>
                Close Review
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}