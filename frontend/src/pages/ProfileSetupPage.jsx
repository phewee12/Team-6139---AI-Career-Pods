import { useState } from "react";
import { setupProfile } from "../api/client";
import {
  CITY_OPTIONS,
  FIELD_OF_STUDY_OPTIONS,
  PREFERRED_GROUP_SIZE_OPTIONS,
} from "../constants/recommendationOptions";

const stages = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Career Switcher"];
const timelines = ["3 months", "6 months", "12 months", "18+ months"];

export default function ProfileSetupPage({ user, onSaved }) {
  const [fieldOfStudy, setFieldOfStudy] = useState(user.fieldOfStudy || "");
  const [careerStage, setCareerStage] = useState(user.careerStage || "");
  const [targetTimeline, setTargetTimeline] = useState(user.targetTimeline || "");
  const [locationCity, setLocationCity] = useState(user.locationCity || "");
  const [preferredGroupSize, setPreferredGroupSize] = useState(user.preferredGroupSize || "ANY");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [avatarUploadData, setAvatarUploadData] = useState("");
  const [avatarUploadContentType, setAvatarUploadContentType] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(user.avatarImageUrl || user.avatarUrl || "");
  const profileInitial = (user.fullName || user.email || "Q").charAt(0).toUpperCase();
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
      const payload = {
        fieldOfStudy,
        careerStage,
        targetTimeline,
        locationCity,
        preferredGroupSize,
      };

      if (avatarUrl.trim()) {
        payload.avatarUrl = avatarUrl.trim();
      }

      if (avatarUploadData.trim() && avatarUploadContentType.trim()) {
        payload.avatarUploadData = avatarUploadData;
        payload.avatarUploadContentType = avatarUploadContentType;
      }

      const result = await setupProfile(payload);
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
            <select
              value={fieldOfStudy}
              onChange={(event) => setFieldOfStudy(event.target.value)}
              required
            >
              <option value="">Select field of study</option>
              {FIELD_OF_STUDY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            Nearest city or metro area (optional)
            <select
              value={locationCity}
              onChange={(event) => setLocationCity(event.target.value)}
            >
              <option value="">Select city</option>
              {CITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Preferred group size
            <select
              value={preferredGroupSize}
              onChange={(event) => setPreferredGroupSize(event.target.value)}
              required
            >
              {PREFERRED_GROUP_SIZE_OPTIONS.map((groupSize) => (
                <option key={groupSize.value} value={groupSize.value}>
                  {groupSize.label}
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

          <div className="profile-avatar-preview">
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Profile preview" />
            ) : (
              <div className="profile-avatar-fallback" aria-hidden="true">
                {profileInitial}
              </div>
            )}
            <p className="helper-copy">Avatar preview</p>
          </div>

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Saving..." : "Complete setup"}
          </button>
        </form>
      </section>
    </main>
  );
}
