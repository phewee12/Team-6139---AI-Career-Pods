import { useState, useEffect } from "react";
import { getPodMembers } from "../api/client";

function MemberProfileModal({ member, onClose }) {
  const initial = (member.fullName || member.email || "?").charAt(0).toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="eyebrow">Member Profile</p>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Avatar + Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0" }}>
          <div className="member-avatar" style={{
            width: "4rem", height: "4rem", borderRadius: "1rem",
            fontSize: "1.4rem", background: "linear-gradient(135deg, var(--lavender-soft), var(--lavender-deep))",
            color: "white", display: "grid", placeItems: "center",
            fontFamily: "Space Grotesk", fontWeight: 700, flexShrink: 0,
            position: "relative"
          }}>
            {initial}
            {member.role === "ADMIN" && (
              <span className="admin-badge" title="Admin">👑</span>
            )}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{member.fullName || "No name set"}</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>{member.email}</p>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div className="detail-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <p className="eyebrow">Career Stage</p>
              <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>{member.careerStage || "—"}</p>
            </div>
            <div>
              <p className="eyebrow">Field of Study</p>
              <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>{member.fieldOfStudy || "—"}</p>
            </div>
          </div>

          <div className="detail-card">
            <p className="eyebrow">Target Timeline</p>
            <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>{member.targetTimeline || "—"}</p>
          </div>

          {member.introMessage && (
            <div className="detail-card">
              <p className="eyebrow">Intro</p>
              <p style={{ marginTop: "0.3rem", lineHeight: 1.6 }}>{member.introMessage}</p>
            </div>
          )}

          <div className="detail-card">
            <p className="eyebrow">Role</p>
            <p style={{ fontWeight: 600, marginTop: "0.3rem" }}>
              {member.role === "ADMIN" ? "👑 Admin" : "Member"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberAvatar({ member, onClick }) {
  const initial = (member.fullName || member.email || "?").charAt(0).toUpperCase();

  return (
    <div
      className="member-avatar"
      title={member.fullName || member.email}
      onClick={onClick}
      style={{ cursor: "pointer", transition: "transform 140ms ease, box-shadow 140ms ease" }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {initial}
      {member.role === "ADMIN" && (
        <span className="admin-badge" title="Admin">👑</span>
      )}
    </div>
  );
}

export default function PodMembersList({ podId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      setError("");

      try {
        const result = await getPodMembers(podId);
        if (!cancelled) {
          setMembers(result.members || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load members.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMembers();
    return () => { cancelled = true; };
  }, [podId]);

  if (loading) return <p className="helper-copy">Loading members...</p>;
  if (error) return <p className="error-banner">{error}</p>;

  const admins = members.filter(m => m.role === "ADMIN");
  const regularMembers = members.filter(m => m.role !== "ADMIN");

  return (
    <>
      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      <div className="members-list">
        {admins.length > 0 && (
          <div className="member-section">
            <h3>Admins</h3>
            <div className="member-grid">
              {admins.map(member => (
                <div key={member.id} className="member-card">
                  <MemberAvatar member={member} onClick={() => setSelectedMember(member)} />
                  <div className="member-info">
                    <p className="member-name">{member.fullName || member.email}</p>
                    <p className="member-meta">{member.careerStage || "Member"}</p>
                    {member.introMessage && (
                      <p className="member-intro">{member.introMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {regularMembers.length > 0 && (
          <div className="member-section">
            <h3>Members</h3>
            <div className="member-grid">
              {regularMembers.map(member => (
                <div key={member.id} className="member-card">
                  <MemberAvatar member={member} onClick={() => setSelectedMember(member)} />
                  <div className="member-info">
                    <p className="member-name">{member.fullName || member.email}</p>
                    <p className="member-meta">{member.careerStage || "Member"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}