import { useEffect, useState } from "react";
import { getPodCelebrations } from "../api/client";

export default function CelebrationFeed({ podId }) {
    const [celebrations, setCelebrations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadCelebrations() {
            try {
                const result = await getPodCelebrations(podId);
                setCelebrations(result.celebrations || []);
            } catch (err) {
                console.error("Failed to load celebrations:", err);
            } finally {
                setLoading(false);
            }
        }
        loadCelebrations();
    }, [podId]);

    if (loading) return null;

    if (celebrations.length === 0) return null;

    return (
        <div className="celebration-feed">
            <div className="celebration-feed-header">
                <h3>🎉 Recent Pod Wins 🎉</h3>
            </div>
            <div className="celebration-timeline">
                {celebrations.slice(0, 5).map(celeb => (
                    <div key={celeb.id} className="celebration-feed-item">
                        <div className="celebration-icon">🏆</div>
                        <div className="celebration-content">
                            <p className="celebration-title">{celeb.title}</p>
                            {celeb.description && (
                                <p className="celebration-description">{celeb.description}</p>
                            )}
                            <small>— {celeb.user?.fullName || celeb.user?.email}</small>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}