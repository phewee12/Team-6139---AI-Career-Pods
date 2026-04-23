import { useEffect, useState } from "react";
import { getEngagementScore } from "../api/client";

const LEVEL_CONFIG = {
    LOW: { label: "Getting Started", color: "#f59e0b", icon: "🌱", description: "You're just getting started! Engage more to grow your score." },
    MEDIUM: { label: "Active Contributor", color: "#3b82f6", icon: "📈", description: "Great momentum! Keep building on your progress." },
    HIGH: { label: "Power User", color: "#10b981", icon: "⚡", description: "Outstanding engagement! You're crushing it!" },
};

const TREND_ICONS = {
    UP: "↑",
    DOWN: "↓",
    STABLE: "→",
};

const TREND_COLORS = {
    UP: "#10b981",
    DOWN: "#ef4444",
    STABLE: "#6b7280",
};

export default function EngagementScore({ podId }) {
    const [engagement, setEngagement] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showTooltip, setShowTooltip] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadEngagement() {
            setLoading(true);
            try {
                const result = await getEngagementScore(podId);
                setEngagement(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadEngagement();
    }, [podId]);

    if (loading) {
        return (
            <div className="engagement-card">
                <div className="engagement-skeleton">Loading engagement score...</div>
            </div>
        );
    }

    if (error || !engagement) {
        return (
            <div className="engagement-card">
                <p className="helper-copy">Complete more activities to see your engagement score.</p>
            </div>
        );
    }

    const levelConfig = LEVEL_CONFIG[engagement.current.level];
    const trendIcon = TREND_ICONS[engagement.current.trend];
    const trendColor = TREND_COLORS[engagement.current.trend];
    const scorePercent = (engagement.current.score / 100) * 100;

    return (
        <div className="engagement-card">
            <div className="engagement-header">
                <div className="engagement-title">
                    <span className="engagement-icon">{levelConfig.icon}</span>
                    <h3>Your Engagement Score</h3>
                    <button
                        className="info-button"
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        aria-label="How engagement score is calculated"
                    >
                        ⓘ
                    </button>
                </div>
                {engagement.current.trend && (
                    <span
                        className="engagement-trend"
                        style={{ color: trendColor }}
                        title={`${engagement.current.trend === 'UP' ? 'Increased' : engagement.current.trend === 'DOWN' ? 'Decreased' : 'Stayed the same'} from last week`}
                    >
            {trendIcon} {Math.abs(engagement.current.score - (engagement.current.previousScore || 0))} pts
          </span>
                )}
            </div>

            {showTooltip && (
                <div className="engagement-tooltip">
                    <p><strong>How it's calculated:</strong></p>
                    <ul>
                        <li>📝 Messages posted (15%)</li>
                        <li>🎯 Goals completed (20%)</li>
                        <li>📄 Applications submitted (15%)</li>
                        <li>✅ Weekly check-ins (15%)</li>
                        <li>💭 Weekly reflections (10%)</li>
                        <li>🎉 Celebrations shared (5%)</li>
                        <li>👥 Resume reviews given (10%)</li>
                        <li>💬 Nudges sent/replied (10%)</li>
                    </ul>
                    <p className="helper-copy">Scores are normalized on a 0-100 scale and updated weekly.</p>
                </div>
            )}

            <div className="score-container">
                <div className="score-value">
                    <span className="score-number">{engagement.current.score}</span>
                    <span className="score-max">/100</span>
                </div>
                <div className="score-label" style={{ color: levelConfig.color }}>
                    {levelConfig.label}
                </div>
            </div>

            <div className="progress-bar-container">
                <div
                    className="progress-bar-fill"
                    style={{
                        width: `${scorePercent}%`,
                        backgroundColor: levelConfig.color,
                    }}
                />
            </div>

            <p className="score-description">{levelConfig.description}</p>

            {engagement.podAverage > 0 && (
                <div className="pod-comparison">
                    <span className="comparison-label">Pod average:</span>
                    <span className="comparison-value">{engagement.podAverage}</span>
                </div>
            )}

            <details className="score-breakdown">
                <summary>View detailed breakdown</summary>
                <div className="breakdown-grid">
                    <div className="breakdown-item">
                        <span>📝 Messages</span>
                        <span>{engagement.breakdown.messageCount}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>🎯 Goals completed</span>
                        <span>{engagement.breakdown.goalsCompleted}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>📄 Applications</span>
                        <span>{engagement.breakdown.applicationsSubmitted}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>✅ Check-ins</span>
                        <span>{engagement.breakdown.checkinsCompleted}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>💭 Reflections</span>
                        <span>{engagement.breakdown.reflectionsCompleted}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>🎉 Celebrations</span>
                        <span>{engagement.breakdown.celebrationsCreated}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>👥 Resume reviews</span>
                        <span>{engagement.breakdown.resumeReviewsGiven}</span>
                    </div>
                </div>
            </details>
        </div>
    );
}