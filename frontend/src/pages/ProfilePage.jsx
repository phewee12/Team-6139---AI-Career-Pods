import { useEffect, useState } from "react";
import { getCurrentUser } from "../api/client";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getCurrentUser();
        setUser(data.user);
      } catch (err) {
        setError("Failed to load profile.");
      }
    }
    loadProfile();
  }, []);

  if (error) return <p className="error-banner">{error}</p>;
  if (!user) return <p>Loading...</p>;

  const initials = user.fullName
    ? user.fullName.split(" ").map(n => n[0]).join("").toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <main className="profile-shell">
      <div className="content-shell" style={{ maxWidth: "48rem", margin: "2rem auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div className="user-avatar" style={{
            width: "4rem", height: "4rem", borderRadius: "1rem",
            fontSize: "1.4rem", background: "linear-gradient(135deg, var(--lavender-soft), var(--lavender-deep))",
            color: "white", display: "grid", placeItems: "center",
            fontFamily: "Space Grotesk", fontWeight: 700
          }}>
            {initials}
          </div>
          <div>
            <p className="eyebrow">Your Profile</p>
            <h1 style={{ fontSize: "clamp(1.4rem, 2vw, 1.9rem)" }}>
              {user.fullName || "No name set"}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{user.email}</p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--line)" }} />

        {/* Details */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "1rem" }}>
          <div className="detail-card">
            <p className="eyebrow">Field of Study</p>
            <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>{user.fieldOfStudy || "—"}</p>
          </div>
          <div className="detail-card">
            <p className="eyebrow">Career Stage</p>
            <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>{user.careerStage || "—"}</p>
          </div>
          <div className="detail-card">
            <p className="eyebrow">Target Timeline</p>
            <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>{user.targetTimeline || "—"}</p>
          </div>
        </div>

        {/* Footer meta */}
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>

      </div>
    </main>
  );
}