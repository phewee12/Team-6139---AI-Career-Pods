import { useState } from "react";
import { setupProfile } from "../api/client";

const stages = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Career Switcher"];
const timelines = ["3 months", "6 months", "12 months", "18+ months"];

export default function ProfileSetupPage({ user, onSaved }) {
  const [fieldOfStudy, setFieldOfStudy] = useState(user.fieldOfStudy || "");
  const [careerStage, setCareerStage] = useState(user.careerStage || "");
  const [targetTimeline, setTargetTimeline] = useState(user.targetTimeline || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const result = await setupProfile({ fieldOfStudy, careerStage, targetTimeline });
      onSaved(result.user);
    } catch (requestError) {
      setError(requestError.message || "Could not save profile details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <p className="eyebrow">Qwyse profile</p>
        <h1>Tell Qwyse who you are</h1>
        <p>
          This information helps Qwyse match you with groups aligned to your stage and goals.
        </p>

        <form className="setup-form" onSubmit={handleSubmit}>
          <label>
            Field of study
            <input
              value={fieldOfStudy}
              onChange={(event) => setFieldOfStudy(event.target.value)}
              placeholder="Computer Science"
              maxLength={100}
              required
            />
          </label>

          <label>
            Career stage
            <select
              value={careerStage}
              onChange={(event) => setCareerStage(event.target.value)}
              required
            >
              <option value="">Select stage</option>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <label>
            Target timeline
            <select
              value={targetTimeline}
              onChange={(event) => setTargetTimeline(event.target.value)}
              required
            >
              <option value="">Select timeline</option>
              {timelines.map((timeline) => (
                <option key={timeline} value={timeline}>
                  {timeline}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Saving..." : "Complete setup"}
          </button>
        </form>
      </section>
    </main>
  );
}
