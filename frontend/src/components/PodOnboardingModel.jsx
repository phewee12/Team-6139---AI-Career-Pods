import { useState } from "react";
import { completePodOnboarding } from "../api/client";

const POD_RULES = [
    "Be respectful and supportive of all members",
    "Share weekly progress and challenges",
    "Provide constructive feedback when requested",
    "Attend weekly check-ins or notify the group if you can't make it",
    "Keep shared information confidential within the pod"
];

export default function PodOnboardingModal({ pod, user, onComplete, onClose }) {
    const [introMessage, setIntroMessage] = useState(
        `Hi everyone! I'm ${user.fullName || user.email}, studying ${user.fieldOfStudy} and currently at the ${user.careerStage} stage. I'm looking forward to connecting with you all!`
    );
    const [acknowledged, setAcknowledged] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();

        if (!acknowledged) {
            setError("Please acknowledge the pod rules to continue.");
            return;
        }

        setPending(true);
        setError("");

        try {
            await completePodOnboarding(pod.id, introMessage);
            onComplete();
        } catch (err) {
            setError(err.message || "Failed to complete onboarding.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content onboarding-modal">
                <h2>Welcome to {pod.name}!</h2>
                <p className="helper-copy">Let's get you set up in your new pod.</p>

                <div className="pod-rules">
                    <h3>Pod Guidelines</h3>
                    <ul className="rule-list">
                        {POD_RULES.map((rule, index) => (
                            <li key={index} className="rule-item">
                                <span className="rule-bullet">•</span>
                                {rule}
                            </li>
                        ))}
                    </ul>
                    <label className="acknowledge-checkbox">
                        <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(e) => setAcknowledged(e.target.checked)}
                        />
                        <span>I acknowledge and agree to follow these guidelines</span>
                    </label>
                </div>

                <div className="intro-section">
                    <h3>Introduce Yourself</h3>
                    <p className="helper-copy">Share a brief introduction with your pod members.</p>
                    <textarea
                        className="intro-textarea"
                        value={introMessage}
                        onChange={(e) => setIntroMessage(e.target.value)}
                        placeholder="Hi everyone! I'm..."
                        rows={4}
                        maxLength={500}
                    />
                    <div className="char-count">{introMessage.length}/500</div>
                </div>

                {error && <p className="error-banner">{error}</p>}

                <div className="modal-actions">
                    <button
                        type="button"
                        className="secondary-action"
                        onClick={onClose}
                        disabled={pending}
                    >
                        Later
                    </button>
                    <button
                        type="button"
                        className="primary"
                        onClick={handleSubmit}
                        disabled={pending || !introMessage.trim()}
                    >
                        {pending ? "Completing..." : "Complete Onboarding"}
                    </button>
                </div>
            </div>
        </div>
    );
}