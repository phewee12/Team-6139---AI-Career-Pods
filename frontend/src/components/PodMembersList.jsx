import { useState, useEffect } from "react";
import { getPodMembers } from "../api/client";

function MemberAvatar({ member }) {
    const initial = (member.fullName || member.email || "?").charAt(0).toUpperCase();

    return (
        <div className="member-avatar" title={member.fullName || member.email}>
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

    const admins = members.filter(m => m.role === "ADMIN");
    const regularMembers = members.filter(m => m.role !== "ADMIN");

    return (
        <div className="members-list">
            {admins.length > 0 && (
                <div className="member-section">
                    <h3>Admins</h3>
                    <div className="member-grid">
                        {admins.map(member => (
                            <div key={member.id} className="member-card">
                                <MemberAvatar member={member} />
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
                                <MemberAvatar member={member} />
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
    );
}