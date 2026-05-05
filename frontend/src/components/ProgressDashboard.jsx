import { useEffect, useState } from "react";
import { getPodStats } from "../api/client";

function HeartIcon({ filled }) {
  return filled ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RepeatIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#1D9E75" : "currentColor"} strokeWidth="2">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function WeekCard({ week }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [reposts, setReposts] = useState(0);
  const [commentCount] = useState(0);

  function handleLike() {
    setLiked((prev) => !prev);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
  }

  function handleRepost() {
    setReposted((prev) => !prev);
    setReposts((prev) => (reposted ? prev - 1 : prev + 1));
  }

  const dateLabel = week.week_start
    ? new Date(week.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Unknown";

  return (
    <div style={s.weekCard}>
      <div style={s.weekCardBody}>
        <p style={s.weekDate}>{dateLabel}</p>
        <div style={s.chips}>
          <div style={s.chip}>
            <div style={{ ...s.dot, background: "#378ADD" }} />
            {week.total_checkins ?? 0} check-ins
          </div>
          <div style={s.chip}>
            <div style={{ ...s.dot, background: "#1D9E75" }} />
            {week.total_reflections ?? 0} reflections
          </div>
          <div style={s.chip}>
            <div style={{ ...s.dot, background: "#BA7517" }} />
            {week.total_celebrations ?? 0} wins
          </div>
        </div>
      </div>

      <div style={s.actionBar}>
        <button
          type="button"
          style={{ ...s.actionBtn, ...(liked ? s.likedBtn : {}) }}
          onClick={handleLike}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <HeartIcon filled={liked} />
          {likes > 0 && <span>{likes}</span>}
        </button>

        <button type="button" style={s.actionBtn} aria-label="Comment">
          <ChatIcon />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>

        <button
          type="button"
          style={{ ...s.actionBtn, ...(reposted ? s.repostedBtn : {}) }}
          onClick={handleRepost}
          aria-label={reposted ? "Undo repost" : "Repost"}
        >
          <RepeatIcon active={reposted} />
          {reposts > 0 && <span>{reposts}</span>}
        </button>
      </div>
    </div>
  );
}

const s = {
  dashboard: {
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  title: {
    fontSize: "16px",
    fontWeight: 500,
    color: "inherit",
    margin: 0,
  },
  badge: {
    fontSize: "11px",
    fontWeight: 500,
    background: "#EAF3DE",
    color: "#3B6D11",
    padding: "3px 10px",
    borderRadius: "99px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: "12px",
    marginTop: 0,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginBottom: "28px",
  },
  statCard: {
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.1)",
    borderRadius: "8px",
    padding: "14px 16px",
  },
  statValue: {
    fontSize: "22px",
    fontWeight: 500,
    lineHeight: 1.2,
    color: "inherit",
  },
  statLabel: {
    fontSize: "12px",
    color: "#888",
    marginTop: "4px",
  },
  weekCards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  weekCard: {
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.1)",
    borderRadius: "12px",
    overflow: "hidden",
  },
  weekCardBody: {
    padding: "14px 16px",
  },
  weekDate: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#555",
    marginBottom: "10px",
    marginTop: 0,
  },
  chips: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#666",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  actionBar: {
    borderTop: "0.5px solid rgba(0,0,0,0.08)",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    gap: "2px",
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "5px 8px",
    borderRadius: "6px",
    color: "#999",
    fontSize: "12px",
    transition: "background 0.15s, color 0.15s",
  },
  likedBtn: {
    color: "#E24B4A",
  },
  repostedBtn: {
    color: "#1D9E75",
  },
};

export default function ProgressDashboard({ podId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError("");
      try {
        const result = await getPodStats(podId);
        if (!cancelled) setStats(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load stats.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
    return () => { cancelled = true; };
  }, [podId]);

  if (loading) return <p style={{ color: "#888", fontSize: "14px" }}>Loading stats...</p>;
  if (error) return <p style={{ color: "#E24B4A", fontSize: "14px" }}>{error}</p>;

  const current = stats?.currentWeek || {};
  const historical = stats?.historicalStats || [];

  const statCards = [
    { value: current.active_members ?? 0, label: "Active members" },
    { value: current.total_checkins ?? 0, label: "Check-ins" },
    { value: current.total_reflections ?? 0, label: "Reflections" },
    { value: current.total_celebrations ?? 0, label: "Wins" },
    { value: `${Math.round(current.completion_rate ?? 0)}%`, label: "Completion rate" },
    { value: `${Math.round(current.on_track_percentage ?? 0)}%`, label: "On track" },
  ];

  return (
    <div style={s.dashboard}>
      <div style={s.titleRow}>
        <h3 style={s.title}>Pod Progress</h3>
        <span style={s.badge}>This week</span>
      </div>

      <p style={s.sectionLabel}>Current week</p>
      <div style={s.statsGrid}>
        {statCards.map((card) => (
          <div key={card.label} style={s.statCard}>
            <div style={s.statValue}>{card.value}</div>
            <div style={s.statLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      {historical.length > 0 && (
        <>
          <p style={s.sectionLabel}>Previous weeks</p>
          <div style={s.weekCards}>
            {historical.slice(0, 3).map((week, idx) => (
              <WeekCard key={idx} week={week} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}