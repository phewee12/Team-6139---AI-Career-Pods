import { useEffect, useState } from "react";
import { getPodMembers } from "../api/client";

function MemberAvatar({ member }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (member.fullName || member.email || "?").charAt(0).toUpperCase();
  const avatarSrc = member.avatarImageUrl || member.avatarUrl;
  const shouldShowImage = Boolean(avatarSrc) && !imageFailed;

  return (
    <div className="member-avatar" title={member.fullName || member.email}>
      {shouldShowImage ? (
        <img
          src={avatarSrc}
          alt={`${member.fullName || member.email} avatar`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        initial
      )}
      {member.role === "ADMIN" && (
        <span className="admin-badge" title="Admin">
          👑
        </span>
      )}
    </div>
  );
}

function NudgeIcon() {
  return (
    <svg
      className="nudge-icon-svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v3" />
      <path d="M8.5 5.5c-3 1.8-4 5.2-2.2 8.2 1.2 2 3.4 3.1 5.7 3.1s4.5-1.1 5.7-3.1c1.8-3 .8-6.4-2.2-8.2" />
      <path d="M9 18h6" />
      <path d="M10 21h4" />
    </svg>
  );
}

function MemberRow({ member, currentUserId, eligibilityEntry, accountabilityLoading, onRequestNudge, onOpenProfile }) {
  const isSelf = currentUserId && member.id === currentUserId;
  const showNudge = Boolean(currentUserId) && !isSelf && !accountabilityLoading && eligibilityEntry !== undefined;

  let nudgeTitle = "Send a supportive nudge";
  let nudgeDisabled = false;
  if (showNudge) {
    if (eligibilityEntry?.nudgesPaused) {
      nudgeDisabled = true;
      nudgeTitle = "This podmate has paused nudges for now";
    } else if (!eligibilityEntry?.canNudge) {
      nudgeDisabled = true;
      nudgeTitle = "Available when someone misses goals or a check-in";
    }
  }

  return (
    <div className="member-card member-card-with-actions">
      <button type="button" className="member-card-main member-card-button" onClick={() => onOpenProfile(member)}>
        <MemberAvatar member={member} />
        <div className="member-info">
          <p className="member-name">{member.fullName || member.email}</p>
          <p className="member-meta">{member.careerStage || "Member"}</p>
          {member.introMessage && (
            <p className="member-intro">{member.introMessage}</p>
          )}
        </div>
      </button>
      {showNudge && (
        <button
          type="button"
          className={`nudge-icon-button ${nudgeDisabled ? "disabled" : ""}`}
          title={nudgeTitle}
          aria-label={nudgeTitle}
          disabled={nudgeDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!nudgeDisabled) onRequestNudge(member);
          }}
        >
          <NudgeIcon />
        </button>
      )}
    </div>
  );
}

function formatJoinedDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function profileValue(value, fallback = "Not provided") {
  return value?.trim() ? value : fallback;
}

export default function PodMembersList({
  podId,
  currentUser,
  eligibility,
  accountabilityLoading,
  onRequestNudge,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const currentUserId = currentUser?.id;

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

    return () => {
      cancelled = true;
    };
  }, [podId]);

  if (loading) {
    return <p className="helper-copy">Loading members...</p>;
  }

  if (error) {
    return <p className="error-banner">{error}</p>;
  }

  const admins = members.filter((m) => m.role === "ADMIN");
  const regularMembers = members.filter((m) => m.role !== "ADMIN");

  return (
    <div className="members-list">
      <p className="helper-copy member-click-hint">
        Click a member card for profile details. When someone misses goals or a check-in, a gentle nudge option
        appears.
      </p>

      {admins.length > 0 && (
        <div className="member-section">
          <h3>Admins</h3>
          <div className="member-grid">
            {admins.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                eligibilityEntry={eligibility?.[member.id]}
                accountabilityLoading={accountabilityLoading}
                onRequestNudge={onRequestNudge}
                onOpenProfile={setSelectedMember}
              />
            ))}
          </div>
        </div>
      )}

      {regularMembers.length > 0 && (
        <div className="member-section">
          <h3>Members</h3>
          <div className="member-grid">
            {regularMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                currentUserId={currentUserId}
                eligibilityEntry={eligibility?.[member.id]}
                accountabilityLoading={accountabilityLoading}
                onRequestNudge={onRequestNudge}
                onOpenProfile={setSelectedMember}
              />
            ))}
          </div>
        </div>
      )}

      {selectedMember && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Member profile details">
          <div className="modal-content member-profile-modal">
            <div className="members-view-header">
              <h2>Member Profile</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setSelectedMember(null)}
                aria-label="Close member profile"
              >
                ×
              </button>
            </div>

            <div className="member-profile-header">
              <MemberAvatar member={selectedMember} />
              <div>
                <p className="member-name member-name-large">{selectedMember.fullName || selectedMember.email}</p>
                <p className="member-meta">{selectedMember.role === "ADMIN" ? "Admin" : "Member"}</p>
              </div>
            </div>

            <dl className="member-profile-grid">
              <div>
                <dt>Major / Field of Study</dt>
                <dd>{profileValue(selectedMember.fieldOfStudy)}</dd>
              </div>
              <div>
                <dt>Career Stage</dt>
                <dd>{profileValue(selectedMember.careerStage)}</dd>
              </div>
              <div>
                <dt>Target Timeline</dt>
                <dd>{profileValue(selectedMember.targetTimeline)}</dd>
              </div>
              <div>
                <dt>Joined Pod</dt>
                <dd>{formatJoinedDate(selectedMember.joinedAt)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selectedMember.email}</dd>
              </div>
              <div>
                <dt>Onboarding Intro</dt>
                <dd>{profileValue(selectedMember.introMessage)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
