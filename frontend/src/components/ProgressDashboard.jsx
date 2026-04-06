import { useEffect, useState } from "react";
import { getPodStats } from "../api/client";

export default function ProgressDashboard({ podId }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadStats() {
            setLoading(true);
            try {
                const result = await getPodStats(podId);
                setStats(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, [podId]);

    if (loading) return <div className="helper-copy">Loading stats...</div>;
    if (error) return <div className="error-banner">{error}</div>;

    const current = stats?.currentWeek || {};
    const historical = stats?.historicalStats || [];

    return (
        <div className="progress-dashboard">
            <h3>📊 Pod Progress Dashboard</h3>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{current.active_members || 0}</div>
                    <div className="stat-label">Active Members</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{current.total_checkins || 0}</div>
                    <div className="stat-label">Check-Ins</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{current.total_reflections || 0}</div>
                    <div className="stat-label">Reflections</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{current.total_celebrations || 0}</div>
                    <div className="stat-label">🎉 Wins</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{Math.round(current.completion_rate || 0)}%</div>
                    <div className="stat-label">Completion Rate</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{Math.round(current.on_track_percentage || 0)}%</div>
                    <div className="stat-label">On Track</div>
                </div>
            </div>

            {historical.length > 0 && (
                <div className="historical-stats">
                    <h4>Previous Weeks</h4>
                    <div className="historical-grid">
                        {historical.slice(0, 3).map((week, idx) => (
                            <div key={idx} className="historical-card">
                                <div className="week-date">
                                    {new Date(week.week_start).toLocaleDateString()}
                                </div>
                                <div className="week-stats">
                                    <span>📝 {week.total_checkins}</span>
                                    <span>💭 {week.total_reflections}</span>
                                    <span>🎉 {week.total_celebrations}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}