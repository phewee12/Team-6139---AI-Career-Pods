import { useState, useEffect } from "react";
import { getCurrentRituals, submitCheckIn, submitReflection, addCelebration, getPodCheckIns, getPodPhase } from "../api/client";

export default function BiWeeklyRituals({ podId, userId }) {
    const [rituals, setRituals] = useState(null);
    const [checkInNotes, setCheckInNotes] = useState("");
    const [checkInGoals, setCheckInGoals] = useState("");
    const [reflectionContent, setReflectionContent] = useState("");
    const [celebrationTitle, setCelebrationTitle] = useState("");
    const [celebrationDesc, setCelebrationDesc] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("checkin");
    const [podCheckIns, setPodCheckIns] = useState([]);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        loadRituals();
        loadPodCheckIns();
    }, [podId]);

    async function loadRituals() {
        setLoading(true);
        try {
            const result = await getCurrentRituals(podId);
            setRituals(result);
            if (result.checkIn) {
                setCheckInNotes(result.checkIn.notes || "");
                setCheckInGoals(result.checkIn.goals || "");
            }
            if (result.reflection) {
                setReflectionContent(result.reflection.content || "");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function loadPodCheckIns() {
        try {
            const result = await getPodCheckIns(podId);
            setPodCheckIns(result.checkIns || []);
        } catch (err) {
            console.error("Failed to load pod check-ins:", err);
        }
    }

    async function handleSubmitCheckIn(e) {
        e.preventDefault();
        setSubmitting(true);
        setError("");
        try {
            await submitCheckIn(podId, checkInNotes, checkInGoals);
            setMessage("Check-in saved successfully!");
            loadRituals();
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSubmitReflection(e) {
        e.preventDefault();
        setSubmitting(true);
        setError("");
        try {
            await submitReflection(podId, reflectionContent);
            setMessage("Reflection saved successfully!");
            loadRituals();
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleAddCelebration(e) {
        e.preventDefault();
        if (!celebrationTitle.trim()) return;
        setSubmitting(true);
        setError("");
        try {
            await addCelebration(podId, celebrationTitle, celebrationDesc);
            setMessage("Celebration added!");
            setCelebrationTitle("");
            setCelebrationDesc("");
            loadRituals();
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    const [phase, setPhase] = useState(null);
    const [phasePrompt, setPhasePrompt] = useState(null);

    async function loadPhase() {
        try {
            const result = await getPodPhase(podId);
            setPhase(result.phase);
            setPhasePrompt(result.prompt);
        } catch (err) {
            console.error("Failed to load phase:", err);
        }
    }

    useEffect(() => {
        loadRituals();
        loadPodCheckIns();
        loadPhase();
    }, [podId]);

    if (loading) {
        return <div className="helper-copy">Loading rituals...</div>;
    }

    const weekRange = rituals?.weekStartDate
        ? `${new Date(rituals.weekStartDate).toLocaleDateString()} - ${new Date(new Date(rituals.weekStartDate).getTime() + 13 * 24 * 60 * 60 * 1000).toLocaleDateString()}`
        : "Current bi-weekly period";

    return (
        <div className="rituals-container">
            <div className="rituals-header">
                <h2>Bi-Weekly Rituals</h2>
                <p className="helper-copy">{weekRange}</p>
            </div>

            {message && <div className="success-toast">{message}</div>}
            {error && <div className="error-banner">{error}</div>}

            <div className="rituals-tabs">
                <button className={activeTab === "checkin" ? "tab active" : "tab"} onClick={() => setActiveTab("checkin")}>
                    📋 Check-In
                </button>
                <button className={activeTab === "reflection" ? "tab active" : "tab"} onClick={() => setActiveTab("reflection")}>
                    💭 Reflection
                </button>
                <button className={activeTab === "celebrations" ? "tab active" : "tab"} onClick={() => setActiveTab("celebrations")}>
                    🎉 Celebrations
                </button>
                <button className={activeTab === "members" ? "tab active" : "tab"} onClick={() => setActiveTab("members")}>
                    👥 Pod Progress
                </button>
            </div>

            {activeTab === "checkin" && (
                <form onSubmit={handleSubmitCheckIn} className="rituals-form">
                    <label>
                        What did you accomplish this bi-weekly period?
                        <textarea
                            value={checkInNotes}
                            onChange={(e) => setCheckInNotes(e.target.value)}
                            placeholder="e.g., Submitted 5 applications, had 2 interviews..."
                            rows={4}
                            required
                        />
                    </label>
                    <label>
                        Goals for next bi-weekly period:
                        <textarea
                            value={checkInGoals}
                            onChange={(e) => setCheckInGoals(e.target.value)}
                            placeholder="e.g., Apply to 3 more jobs, complete portfolio project..."
                            rows={3}
                        />
                    </label>
                    <button type="submit" className="primary" disabled={submitting}>
                        {submitting ? "Saving..." : "Save Check-In"}
                    </button>
                </form>
            )}

            {activeTab === "reflection" && (
                <div>
                    {phasePrompt && (
                        <div className="prompt-card">
                            <h3>{phasePrompt.title}</h3>
                            {phasePrompt.questions && phasePrompt.questions.map((q, i) => (
                                <p key={i}>📌 {q}</p>
                            ))}
                            <p className="prompt-placeholder">{phasePrompt.placeholder}</p>
                            {phasePrompt.hasResponded && (
                                <div className="already-responded">
                                    ✅ You've already responded for this period
                                </div>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmitReflection} className="rituals-form">
      <textarea
          value={reflectionContent}
          onChange={(e) => setReflectionContent(e.target.value)}
          placeholder={phasePrompt?.placeholder || "Share your thoughts..."}
          rows={6}
          required
          disabled={phasePrompt?.hasResponded}
      />
                        <button
                            type="submit"
                            className="primary"
                            disabled={submitting || phasePrompt?.hasResponded}
                        >
                            {submitting ? "Saving..." : "Save Reflection"}
                        </button>
                    </form>

                    {rituals?.reflection && (
                        <div className="reflections-list">
                            <h3>Your Current Reflection</h3>
                            <div className="reflection-card">
                                <p>{rituals.reflection.content}</p>
                                <small>Saved for this period</small>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "celebrations" && (
                <div>
                    <form onSubmit={handleAddCelebration} className="rituals-form">
                        <label>
                            Celebration Title:
                            <input
                                value={celebrationTitle}
                                onChange={(e) => setCelebrationTitle(e.target.value)}
                                placeholder="e.g., Got a callback from Google!"
                                required
                            />
                        </label>
                        <label>
                            Tell us more (optional):
                            <textarea
                                value={celebrationDesc}
                                onChange={(e) => setCelebrationDesc(e.target.value)}
                                placeholder="Share the details of your win..."
                                rows={3}
                            />
                        </label>
                        <button type="submit" className="primary" disabled={submitting}>
                            Add Celebration 🎉
                        </button>
                    </form>

                    <div className="celebrations-list">
                        <h3>Pod Celebrations</h3>
                        {rituals?.celebrations?.length > 0 ? (
                            rituals.celebrations.map(celeb => (
                                <div key={celeb.id} className="celebration-card">
                                    <div className="celebration-emoji">🎉</div>
                                    <div>
                                        <p className="celebration-title">{celeb.title}</p>
                                        <p className="celebration-desc">{celeb.description}</p>
                                        <small>— {celeb.user?.fullName || celeb.user?.email}</small>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="helper-copy">No celebrations yet. Be the first to share a win!</p>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "members" && (
                <div className="pod-checkins">
                    <h3>Pod Member Check-Ins</h3>
                    {podCheckIns.length > 0 ? (
                        podCheckIns.map(checkIn => (
                            <div key={checkIn.id} className="member-checkin-card">
                                <div className="member-checkin-header">
                                    <strong>{checkIn.user?.fullName || checkIn.user?.email}</strong>
                                    <span className={`status-badge ${checkIn.status.toLowerCase()}`}>
              {checkIn.status}
            </span>
                                </div>
                                <p><strong>Accomplishments:</strong> {checkIn.notes || "Not provided"}</p>
                                {checkIn.goals && <p><strong>Goals:</strong> {checkIn.goals}</p>}
                            </div>
                        ))
                    ) : (
                        <p className="helper-copy">No check-ins submitted yet this bi-weekly period.</p>
                    )}

                    <h3 style={{ marginTop: "1.5rem" }}>Pod Member Reflections</h3>
                    {podCheckIns.length > 0 ? (
                        podCheckIns.map(checkIn => (
                            <div key={checkIn.id} className="member-checkin-card">
                                <div className="member-checkin-header">
                                    <strong>{checkIn.user?.fullName || checkIn.user?.email}</strong>
                                </div>
                                <p><strong>Reflection:</strong> {checkIn.reflection?.content || "Not submitted yet"}</p>
                            </div>
                        ))
                    ) : (
                        <p className="helper-copy">No reflections submitted yet this bi-weekly period.</p>
                    )}
                </div>
            )}
        </div>
    );
}