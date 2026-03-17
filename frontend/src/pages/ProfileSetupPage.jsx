import { useState } from "react";
import { setupProfile } from "../api/client";

const stages = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Career Switcher"];
const timelines = ["3 months", "6 months", "12 months", "18+ months"];

export default function ProfileSetupPage({ user, onSaved }) {
  const [fieldOfStudy, setFieldOfStudy] = useState(user.fieldOfStudy || "");
  const [careerStage, setCareerStage] = useState(user.careerStage || "");
  const [targetTimeline, setTargetTimeline] = useState(user.targetTimeline || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [avatarUploadData, setAvatarUploadData] = useState("");
  const [avatarUploadContentType, setAvatarUploadContentType] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(user.avatarImageUrl || user.avatarUrl || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleAvatarFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const supportedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

    if (!supportedTypes.includes(file.type)) {
      setError("Unsupported image type. Use PNG, JPEG, WEBP, or GIF.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar file must be 2MB or smaller.");
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read selected avatar file."));
      reader.readAsDataURL(file);
    });

    setError("");
    setAvatarUrl("");
    setAvatarUploadData(dataUrl);
    setAvatarUploadContentType(file.type);
    setAvatarPreviewUrl(dataUrl);
  }

  function handleAvatarUrlChange(event) {
    const value = event.target.value;
    setAvatarUrl(value);

    if (value.trim()) {
      setAvatarUploadData("");
      setAvatarUploadContentType("");
      setAvatarPreviewUrl(value.trim());
    } else if (!avatarUploadData) {
      setAvatarPreviewUrl("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const result = await setupProfile({
        fieldOfStudy,
        careerStage,
        targetTimeline,
        avatarUrl,
        avatarUploadData,
        avatarUploadContentType,
      });
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

          <label>
            Upload profile picture (recommended)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarFileChange}
            />
          </label>

          <label>
            Profile picture URL (optional fallback)
            <input
              type="url"
              value={avatarUrl}
              onChange={handleAvatarUrlChange}
              placeholder="https://example.com/avatar.jpg"
              maxLength={500}
            />
          </label>

          {avatarPreviewUrl && (
            <div className="profile-avatar-preview">
              <img src={avatarPreviewUrl} alt="Profile preview" />
              <p className="helper-copy">Avatar preview</p>
            </div>
          )}

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Saving..." : "Complete setup"}
          </button>
        </form>
      </section>
    </main>
  );
}
