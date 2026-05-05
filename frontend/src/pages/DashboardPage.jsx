import { useEffect, useMemo, useState } from "react";
import {
  createPod,
  createPodPost,
  deletePodPost,
  getPodOnboarding,
  getPodPosts,
  getPods,
  joinPod,
  leavePod,
  prefetchPodFeatureData,
  resetTestDatabase,
  updatePodSettings,
} from "../api/client";
import PodOnboardingModal from "../components/PodOnboardingModel";
import MembersFeatureSection from "../components/MembersFeatureSection";
import WorkspaceSidebar from "../components/WorkspaceSidebar";
import BiWeeklyRituals from "../components/BiWeeklyRituals";
import ProgressDashboard from "../components/ProgressDashboard";
import CelebrationFeed from "../components/CelebrationFeed";
import NotificationBell from "../components/NotificationBell";
import ResumeReviewPanel from "../components/ResumeReviewPanel";
import EngagementScore from "../components/EngagementScore";
import BiweeklySummaryPanel from "../components/BiweeklySummaryPanel";
import { CITY_OPTIONS, FIELD_OF_STUDY_OPTIONS } from "../constants/recommendationOptions";

const NAV_ITEMS = [
  { id: "onboarding", label: "Onboarding", icon: "sparkles" },
  { id: "home", label: "Home", icon: "home" },
  { id: "career", label: "Career Assist", icon: "briefcase" },
  { id: "jobs", label: "Job Assist", icon: "search" },
  { id: "groups", label: "Groups", icon: "users" },
];

const SECTION_COPY = {
  onboarding: {
    eyebrow: "Onboarding",
    title: "Onboarding workspace",
    description: "Temporary placeholder while we shape the first Qwyse onboarding flow.",
  },
  home: {
    eyebrow: "Home",
    title: "Home overview",
    description: "Temporary placeholder for the Qwyse home experience.",
  },
  career: {
    eyebrow: "Career Assist",
    title: "Career Assist",
    description: "Temporary placeholder for resume, networking, and strategy tools.",
  },
  jobs: {
    eyebrow: "Job Assist",
    title: "Job Assist",
    description: "Temporary placeholder for search, outreach, and application workflows.",
  },
};

function formatMonthYear(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function deriveGroupSize(memberCount) {
  if (memberCount === 0) return "New";
  if (memberCount < 25) return "Small";
  if (memberCount < 100) return "Mid";
  return "Large";
}

function AppIcon({ name }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "sparkles":
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.2 3.2L16.5 7.5l-3.3 1.3L12 12l-1.2-3.2L7.5 7.5l3.3-1.3Z" />
          <path d="m18.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
          <path d="m5.5 14 .9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z" />
        </svg>
      );
    case "home":
      return (
        <svg {...commonProps}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.5 9.5V20h11V9.5" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...commonProps}>
          <path d="M8 6V4.8C8 3.8 8.8 3 9.8 3h4.4c1 0 1.8.8 1.8 1.8V6" />
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M3 11h18" />
        </svg>
      );
    case "search":
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "users":
      return (
        <svg {...commonProps}>
          <path d="M16.5 20a4.5 4.5 0 0 0-9 0" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 20a3.5 3.5 0 0 0-3.1-3.5" />
          <path d="M7.1 16.5A3.5 3.5 0 0 0 4 20" />
        </svg>
      );
    case "tag":
      return (
        <svg {...commonProps}>
          <path d="m11 3 8 8-5 5-8-8V3Z" />
          <circle cx="8" cy="8" r="1" />
        </svg>
      );
    case "filter":
      return (
        <svg {...commonProps}>
          <path d="M4 5h16l-6.2 7.1v5.1l-3.6 1.8v-6.9Z" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg {...commonProps}>
          <path d="m15 6-6 6 6 6" />
          <path d="M9 12h10" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M8 3.5V7" />
          <path d="M16 3.5V7" />
          <path d="M3.5 9.5h17" />
        </svg>
      );
    case "lock":
      return (
        <svg {...commonProps}>
          <rect x="4.5" y="10" width="15" height="10" rx="2" />
          <path d="M8 10V7.8A4 4 0 0 1 12 4a4 4 0 0 1 4 3.8V10" />
        </svg>
      );
    case "thumbs-up":
      return (
        <svg {...commonProps}>
          <path d="M8 11V20H5.5A1.5 1.5 0 0 1 4 18.5v-6A1.5 1.5 0 0 1 5.5 11Z" />
          <path d="M8 20h6.5a2 2 0 0 0 1.9-1.4l1.6-5.5a1.8 1.8 0 0 0-1.7-2.3H12V6.5A2.5 2.5 0 0 0 9.5 4L8 11Z" />
        </svg>
      );
    case "message":
      return (
        <svg {...commonProps}>
          <path d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "share":
      return (
        <svg {...commonProps}>
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="m7.7 11 8-4" />
          <path d="m7.7 13 8 4" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      );
  }
}

function enrichPods(pods) {
  return pods.map((pod) => {
    const members = typeof pod.memberCount === "number" ? pod.memberCount : 0;
    const membershipStatus = pod.membershipStatus || null;
    const membershipRole = pod.membershipRole || null;
    const visibility = pod.visibility || "PUBLIC";
    const recommendationScore = typeof pod.recommendationScore === "number" ? pod.recommendationScore : null;
    const locationDistanceKm = typeof pod.locationDistanceKm === "number" ? pod.locationDistanceKm : null;
    const recommendationReasons = Array.isArray(pod.recommendationReasons) ? pod.recommendationReasons : [];

    return {
      ...pod,
      badge: pod.name.slice(0, 2).toUpperCase(),
      members,
      size: deriveGroupSize(members),
      activity: visibility === "PRIVATE" ? "Private" : "Public",
      fieldOfStudy: pod.fieldOfStudy || "",
      tags: pod.fieldOfStudy ? [pod.fieldOfStudy] : [],
      locationCity: pod.locationCity || "",
      membershipStatus,
      membershipRole,
      joinActionLabel:
        pod.joinActionLabel || (visibility === "PRIVATE" ? "Request To Join" : "Join Group"),
      createdAt: formatMonthYear(pod.createdAt),
      visibility,
      recommendationScore,
      locationDistanceKm,
      recommendationReasons,
      adminCount:
        pod.createdById || ((membershipRole === "OWNER" || membershipRole === "ADMIN") && membershipStatus === "ACTIVE")
          ? 1
          : 0,
      feedPosts: [],
    };
  });
}

function statusText(status) {
  if (status === "PENDING") return "Request Pending";
  if (status === "ACTIVE") return "Joined";
  if (status === "REJECTED") return "Rejected";
  return "Not Joined";
}

function formatPostTimestamp(value) {
  if (!value) return "Unknown time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AvatarBadge({ imageUrl, label, className }) {
  const [imageFailed, setImageFailed] = useState(false);

  const fallback = (label || "?").charAt(0).toUpperCase();
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <div className={className} title={label || "Member"}>
      {showImage ? (
        <img src={imageUrl} alt={`${label || "Member"} avatar`} onError={() => setImageFailed(true)} />
      ) : (
        fallback
      )}
    </div>
  );
}

function PostCard({ post, user, highlightedPostId, deletingPostId, onDelete }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [reposts, setReposts] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState([]);

  const isHighlighted = post.id === highlightedPostId;
  const isOwn = post.authorId === user.id;

  function handleLike() {
    setLiked((p) => !p);
    setLikes((p) => (liked ? p - 1 : p + 1));
  }

  function handleRepost() {
    setReposted((p) => !p);
    setReposts((p) => (reposted ? p - 1 : p + 1));
  }

  function handleAddComment() {
    const text = commentDraft.trim();
    if (!text) return;
    setComments((prev) => [
      ...prev,
      {
        id: Date.now(),
        author: user.fullName || user.email || "You",
        text,
        timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      },
    ]);
    setCommentDraft("");
  }

  return (
    <article
      id={`post-${post.id}`}
      style={{
        background: "#fff",
        border: isHighlighted ? "1.5px solid #378ADD" : "0.5px solid rgba(0,0,0,0.09)",
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "10px",
        transition: "border-color 0.3s",
      }}
    >
      {/* Post header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <AvatarBadge
            key={post.author?.id || post.id}
            className="feed-author-avatar"
            imageUrl={post.author?.avatarImageUrl || post.author?.avatarUrl || ""}
            label={post.author?.fullName || post.author?.email || "Member"}
          />
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, margin: 0, color: "inherit" }}>
              {post.author?.fullName || post.author?.email || "Member"}
            </p>
            <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>
              {formatPostTimestamp(post.createdAt)}
            </p>
          </div>
        </div>
        {isOwn && (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "11px",
              color: "#bbb",
              padding: "4px 8px",
              borderRadius: "6px",
            }}
            disabled={deletingPostId === post.id}
            onClick={() => onDelete(post.id)}
          >
            {deletingPostId === post.id ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>

      {/* Post body */}
      <p style={{ fontSize: "14px", lineHeight: 1.6, padding: "10px 16px 14px", margin: 0, color: "inherit" }}>
        {post.content}
      </p>

      {/* Action bar */}
      <div style={{
        borderTop: "0.5px solid rgba(0,0,0,0.07)",
        padding: "6px 10px",
        display: "flex",
        alignItems: "center",
        gap: "2px",
      }}>
        {/* Like */}
        <button
          type="button"
          onClick={handleLike}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            padding: "6px 10px", borderRadius: "8px",
            fontSize: "12px", color: liked ? "#E24B4A" : "#999",
            transition: "background 0.15s",
          }}
          aria-label={liked ? "Unlike" : "Like"}
        >
          {liked ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          )}
          {likes > 0 && <span>{likes}</span>}
        </button>

        {/* Comment */}
        <button
          type="button"
          onClick={() => setShowComments((p) => !p)}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            padding: "6px 10px", borderRadius: "8px",
            fontSize: "12px", color: showComments ? "#378ADD" : "#999",
            transition: "background 0.15s",
          }}
          aria-label="Comment"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {comments.length > 0 && <span>{comments.length}</span>}
        </button>

        {/* Repost */}
        <button
          type="button"
          onClick={handleRepost}
          style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "none", border: "none", cursor: "pointer",
            padding: "6px 10px", borderRadius: "8px",
            fontSize: "12px", color: reposted ? "#1D9E75" : "#999",
            transition: "background 0.15s",
          }}
          aria-label={reposted ? "Undo repost" : "Repost"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={reposted ? "#1D9E75" : "currentColor"} strokeWidth="2">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          {reposts > 0 && <span>{reposts}</span>}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.07)", padding: "12px 16px", background: "rgba(0,0,0,0.015)" }}>
          {comments.length > 0 && (
            <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: "8px" }}>
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: "#E6F1FB", color: "#185FA5",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 500, flexShrink: 0,
                  }}>
                    {c.author.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: "8px", padding: "6px 10px", flex: 1 }}>
                    <p style={{ fontSize: "12px", fontWeight: 500, margin: "0 0 2px", color: "inherit" }}>{c.author}</p>
                    <p style={{ fontSize: "12px", margin: 0, color: "inherit" }}>{c.text}</p>
                    <p style={{ fontSize: "10px", color: "#bbb", margin: "3px 0 0" }}>{c.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              placeholder="Write a comment..."
              style={{
                flex: 1, fontSize: "13px", padding: "7px 12px",
                border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "20px",
                background: "#fff", outline: "none", color: "inherit",
              }}
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={!commentDraft.trim()}
              style={{
                background: "#378ADD", color: "#fff", border: "none",
                borderRadius: "20px", padding: "7px 14px", fontSize: "12px",
                cursor: commentDraft.trim() ? "pointer" : "default",
                opacity: commentDraft.trim() ? 1 : 0.5,
              }}
            >
              Post
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function DashboardPage({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState("groups");
  const [activeTab, setActiveTab] = useState("discover");
  const [groupView, setGroupView] = useState("discover");
  const [activeGroupFeature, setActiveGroupFeature] = useState("feed");
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [fieldOfStudyFilter, setFieldOfStudyFilter] = useState("All");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [activityFilter, setActivityFilter] = useState("All");
  const [feedTagFilter, setFeedTagFilter] = useState("All Posts");
  const [joinStatusByGroup, setJoinStatusByGroup] = useState({});
  const [joiningPodId, setJoiningPodId] = useState(null);
  const [joinActionError, setJoinActionError] = useState("");
  const [postDraft, setPostDraft] = useState("");
  const [postingPodId, setPostingPodId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [leavingPodId, setLeavingPodId] = useState(null);
  const [postActionError, setPostActionError] = useState("");
  const [postSuccessMessage, setPostSuccessMessage] = useState("");
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [scrollToPostId, setScrollToPostId] = useState(null);
  const [scrollToPostGroupId, setScrollToPostGroupId] = useState(null);
  const [postsLoadingByGroup, setPostsLoadingByGroup] = useState({});
  const [postsByGroup, setPostsByGroup] = useState({});
  const [pods, setPods] = useState([]);
  const [podsLoading, setPodsLoading] = useState(true);
  const [podsError, setPodsError] = useState("");
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [resetDbError, setResetDbError] = useState("");
  const [groupFormMode, setGroupFormMode] = useState(null);
  const [groupFormValues, setGroupFormValues] = useState({
    name: "",
    description: "",
    fieldOfStudy: "",
    locationCity: "",
    visibility: "PUBLIC",
  });
  const [groupFormError, setGroupFormError] = useState("");
  const [groupFormSaving, setGroupFormSaving] = useState(false);

  async function checkOnboardingStatus(groupId) {
    try {
      const result = await getPodOnboarding(groupId);
      if (!result.onboarded && result.canOnboard) {
        setShowOnboardingModal(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to check onboarding:", error);
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPods() {
      setPodsLoading(true);
      setPodsError("");

      try {
        const result = await getPods();
        if (!cancelled) {
          setPods(result.pods || []);
        }
      } catch (error) {
        if (!cancelled) {
          setPods([]);
          setPodsError(error.message || "Could not load pods right now.");
        }
      } finally {
        if (!cancelled) {
          setPodsLoading(false);
        }
      }
    }

    loadPods();

    return () => {
      cancelled = true;
    };
  }, []);

  const discoverGroups = useMemo(() => enrichPods(pods), [pods]);

  useEffect(() => {
    setJoinStatusByGroup((current) => {
      const next = {...current};

      discoverGroups.forEach((group) => {
        if (!next[group.id] && group.membershipStatus) {
          next[group.id] = group.membershipStatus;
        }
      });

      return next;
    });
  }, [discoverGroups]);

    const fieldOfStudyOptions = useMemo(
      () => ["All", ...new Set(discoverGroups.map((group) => group.fieldOfStudy).filter(Boolean))],
      [discoverGroups],
  );

  const sizeOptions = useMemo(
      () => ["All", ...new Set(discoverGroups.map((group) => group.size))],
      [discoverGroups],
  );

  const activityOptions = useMemo(
      () => ["All", ...new Set(discoverGroups.map((group) => group.activity))],
      [discoverGroups],
  );

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return discoverGroups.filter((group) => {
      const matchesSearch =
          normalizedSearch.length === 0 ||
          [group.name, group.description, group.fieldOfStudy]
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearch);

        const matchesCategory = fieldOfStudyFilter === "All" || group.fieldOfStudy === fieldOfStudyFilter;
      const matchesSize = sizeFilter === "All" || group.size === sizeFilter;
      const matchesActivity = activityFilter === "All" || group.activity === activityFilter;

      return matchesSearch && matchesCategory && matchesSize && matchesActivity;
    });
  }, [activityFilter, discoverGroups, fieldOfStudyFilter, searchTerm, sizeFilter]);

  const myGroups = useMemo(
      () =>
          discoverGroups.filter((group) => {
            const status = joinStatusByGroup[group.id] || group.membershipStatus;
            return status === "ACTIVE" || status === "PENDING";
          }),
      [discoverGroups, joinStatusByGroup],
  );

  const activeGroup = useMemo(
      () => discoverGroups.find((group) => group.id === activeGroupId) || null,
      [activeGroupId, discoverGroups],
  );

  const relatedGroups = useMemo(() => {
    if (!activeGroup) return [];
    return discoverGroups.filter((group) => group.id !== activeGroup.id).slice(0, 3);
  }, [activeGroup, discoverGroups]);

  const feedTagOptions = useMemo(() => {
    return ["All Posts"];
  }, []);

  const activeGroupPosts = useMemo(() => {
    if (!activeGroup) return [];
    return postsByGroup[activeGroup.id] || [];
  }, [activeGroup, postsByGroup]);

  const filteredFeedPosts = useMemo(() => {
    if (!activeGroup) return [];
    if (feedTagFilter === "All Posts") return activeGroupPosts;

    return activeGroupPosts.filter((post) => (post.tags || []).includes(feedTagFilter));
  }, [activeGroup, activeGroupPosts, feedTagFilter]);

  useEffect(() => {
    if (!postSuccessMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setPostSuccessMessage("");
    }, 2400);

    return () => clearTimeout(timeoutId);
  }, [postSuccessMessage]);

  useEffect(() => {
    if (!scrollToPostId || !activeGroup || activeGroup.id !== scrollToPostGroupId) {
      return;
    }

    const postElement = document.getElementById(`post-${scrollToPostId}`);
    if (!postElement) {
      return;
    }

    postElement.scrollIntoView({behavior: "smooth", block: "center"});
    setHighlightedPostId(scrollToPostId);
    setScrollToPostId(null);
  }, [activeGroup, activeGroupPosts, scrollToPostGroupId, scrollToPostId]);

  useEffect(() => {
    if (!highlightedPostId) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setHighlightedPostId(null);
    }, 1400);

    return () => clearTimeout(timeoutId);
  }, [highlightedPostId]);

  const userInitial = (user.fullName || user.email || "Q").charAt(0).toUpperCase();
  const userAvatarUrl = user.avatarImageUrl || user.avatarUrl || "";

  function isSettingsManager(group) {
    if (!group) return false;
    return group.membershipRole === "OWNER" || group.membershipRole === "ADMIN";
  }

  function openCreateGroupForm() {
    setGroupFormMode("create");
    setGroupFormError("");
    setGroupFormValues({
      name: "",
      description: "",
      fieldOfStudy: "",
      locationCity: "",
      visibility: "PUBLIC",
    });
  }

  function openGroupSettingsForm() {
    if (!activeGroup || !isSettingsManager(activeGroup)) {
      return;
    }

    setGroupFormMode("settings");
    setGroupFormError("");
    setGroupFormValues({
      name: activeGroup.name || "",
      description: activeGroup.description || "",
      fieldOfStudy: activeGroup.fieldOfStudy || "",
      locationCity: activeGroup.locationCity || "",
      visibility: activeGroup.visibility || "PUBLIC",
    });
  }

  function closeGroupForm() {
    if (groupFormSaving) return;
    setGroupFormMode(null);
    setGroupFormError("");
  }

  function updateGroupFormValue(field, value) {
    setGroupFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleGroupFormSubmit(event) {
    event.preventDefault();
    setGroupFormError("");

    const payload = {
      name: groupFormValues.name.trim(),
      description: groupFormValues.description.trim(),
      fieldOfStudy: groupFormValues.fieldOfStudy.trim(),
      locationCity: groupFormValues.locationCity.trim(),
      visibility: groupFormValues.visibility,
    };

    if (!payload.name || !payload.description) {
      setGroupFormError("Please fill out name and description.");
      return;
    }

    setGroupFormSaving(true);
    try {
      if (groupFormMode === "create") {
        const result = await createPod(payload);
        const createdPod = result.pod;

        setPods((current) => [createdPod, ...current]);
        setActiveTab("mine");
        setActiveGroupId(createdPod.id);
        setGroupView("detail");
      } else if (groupFormMode === "settings" && activeGroup) {
        const result = await updatePodSettings(activeGroup.id, payload);
        const updatedPod = result.pod;

        setPods((current) =>
          current.map((pod) => (pod.id === updatedPod.id ? { ...pod, ...updatedPod } : pod)),
        );
      }

      setGroupFormMode(null);
    } catch (error) {
      setGroupFormError(error.message || "Could not save group settings.");
    } finally {
      setGroupFormSaving(false);
    }
  }

  function renderPlaceholderSection(sectionId) {
    const section = SECTION_COPY[sectionId];

    return (
        <section className="content-shell placeholder-shell">
          <header className="content-header">
            <p className="eyebrow">{section.eyebrow}</p>
            <h1>{section.title}</h1>
            <p>{section.description}</p>
          </header>

          <div className="placeholder-grid">
            <article className="placeholder-card">
              <h2>Coming next</h2>
              <p>This panel is intentionally lightweight while we focus on the groups workflow first.</p>
            </article>
            <article className="placeholder-card muted">
              <h2>Profile signal</h2>
              <p>
                {user.fieldOfStudy || "Field not set"} · {user.careerStage || "Stage not set"} · {user.targetTimeline || "Timeline not set"}
              </p>
            </article>
          </div>
        </section>
    );
  }

  function openGroup(groupId) {
    setJoinActionError("");
    setActiveGroupId(groupId);
    setGroupView("detail");
    prefetchPodFeatureData(groupId);
  }

  async function openFeed(groupId) {
    await openGroupFeature("feed", groupId);
  }

  async function openGroupFeature(featureId, groupId = activeGroupId) {
    if (!groupId) {
      return;
    }

    const group = discoverGroups.find((item) => item.id === groupId);
    const membershipStatus = group ? getGroupMembershipStatus(group) : null;
    if (membershipStatus === "ACTIVE") {
      const isOnboarded = await checkOnboardingStatus(groupId);
      if (!isOnboarded) {
        setActiveGroupId(groupId);
        setGroupView("detail");
        return;
      }
    }

    setJoinActionError("");
    setPostActionError("");
    setActiveGroupId(groupId);
    setActiveGroupFeature(featureId);
    setGroupView("feed");
    prefetchPodFeatureData(groupId);

    if (featureId === "feed") {
      setFeedTagFilter("All Posts");
      setPostDraft("");
      loadGroupPosts(groupId);
    }
  }

  function getGroupMembershipStatus(group) {
    return joinStatusByGroup[group.id] || group.membershipStatus || null;
  }

  function handleGroupCardClick(group) {
    const membershipStatus = getGroupMembershipStatus(group);

    if (membershipStatus === "ACTIVE") {
      void openFeed(group.id);
      return;
    }

    openGroup(group.id);
  }

  function handleGroupCardKeyDown(event, group) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleGroupCardClick(group);
    }
  }

  async function requestToJoin(groupId) {
    setJoiningPodId(groupId);
    setJoinActionError("");

    try {
      const result = await joinPod(groupId);
      const membershipStatus = result.membership?.status || null;

      if (membershipStatus) {
        setJoinStatusByGroup((current) => ({
          ...current,
          [groupId]: membershipStatus,
        }));
      }

      setPods((current) =>
          current.map((pod) => {
            if (pod.id !== groupId) {
              return pod;
            }

            const becameActive = membershipStatus === "ACTIVE" && pod.membershipStatus !== "ACTIVE";

            return {
              ...pod,
              membershipStatus,
              memberCount: becameActive ? (pod.memberCount || 0) + 1 : pod.memberCount,
            };
          }),
      );

      if (membershipStatus === "ACTIVE") {
        const isOnboarded = await checkOnboardingStatus(groupId);
        if (isOnboarded) {
          await openFeed(groupId);
        } else {
          setActiveGroupId(groupId);
          setGroupView("detail");
        }
      }
    } catch (error) {
      setJoinActionError(error.message || "Could not update membership.");
    } finally {
      setJoiningPodId(null);
    }
  }

  async function loadGroupPosts(groupId) {
    setPostsLoadingByGroup((current) => ({
      ...current,
      [groupId]: true,
    }));
    setPostActionError("");

    try {
      const result = await getPodPosts(groupId);
      setPostsByGroup((current) => ({
        ...current,
        [groupId]: result.posts || [],
      }));
    } catch (error) {
      setPostActionError(error.message || "Could not load posts.");
    } finally {
      setPostsLoadingByGroup((current) => ({
        ...current,
        [groupId]: false,
      }));
    }
  }

  async function handleCreatePost() {
    if (!activeGroup || !postDraft.trim()) {
      return;
    }

    const content = postDraft.trim();
    setPostingPodId(activeGroup.id);
    setPostActionError("");

    try {
      const result = await createPodPost(activeGroup.id, {content});
      setPostsByGroup((current) => ({
        ...current,
        [activeGroup.id]: [result.post, ...(current[activeGroup.id] || [])],
      }));
      setPostDraft("");
      setPostSuccessMessage("Post published.");
      setScrollToPostGroupId(activeGroup.id);
      setScrollToPostId(result.post.id);
    } catch (error) {
      setPostActionError(error.message || "Could not create post.");
      setPostSuccessMessage("");
    } finally {
      setPostingPodId(null);
    }
  }

  async function handleDeletePost(postId) {
    if (!activeGroup || !postId) {
      return;
    }

    setDeletingPostId(postId);
    setPostActionError("");

    try {
      await deletePodPost(activeGroup.id, postId);
      setPostsByGroup((current) => ({
        ...current,
        [activeGroup.id]: (current[activeGroup.id] || []).filter((post) => post.id !== postId),
      }));
    } catch (error) {
      setPostActionError(error.message || "Could not delete post.");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function handleLeaveGroup(groupId) {
    if (!groupId) {
      return;
    }

    setLeavingPodId(groupId);
    setJoinActionError("");

    try {
      await leavePod(groupId);

      setJoinStatusByGroup((current) => {
        const next = {...current};
        delete next[groupId];
        return next;
      });

      setPods((current) =>
          current.map((pod) => {
            if (pod.id !== groupId) {
              return pod;
            }

            const wasActive = pod.membershipStatus === "ACTIVE";
            const nextMemberCount = wasActive
                ? Math.max(0, (typeof pod.memberCount === "number" ? pod.memberCount : 0) - 1)
                : pod.memberCount;

            return {
              ...pod,
              membershipStatus: null,
              membershipRole: null,
              memberCount: nextMemberCount,
            };
          }),
      );

      if (activeGroupId === groupId) {
        setGroupView("discover");
        setActiveGroupId(null);
      }
    } catch (error) {
      setJoinActionError(error.message || "Could not leave group.");
    } finally {
      setLeavingPodId(null);
    }
  }

  function renderDiscoverView() {
    return (
        <>
          <header className="content-header">
            <p className="eyebrow">Qwyse groups</p>
            <h1>Discover Groups</h1>
            <p>Find and join professional communities that match your current direction.</p>
          </header>

          <div className="tab-strip" role="tablist" aria-label="Group views">
            <button
                type="button"
                className={activeTab === "discover" ? "tab active" : "tab"}
                onClick={() => setActiveTab("discover")}
            >
              Discover Groups
            </button>
            <button
                type="button"
                className={activeTab === "mine" ? "tab active" : "tab"}
                onClick={() => setActiveTab("mine")}
            >
              My Groups
            </button>
          </div>

          {activeTab === "discover" ? (
              <>
                <div className="search-row">
                  <label className="search-input">
                    <AppIcon name="search"/>
                    <input
                        type="search"
                        placeholder="Search groups..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </label>
                </div>

                <div className="filter-row">
                  <div className="filter-label">
                    <AppIcon name="filter"/>
                    <span>Filters:</span>
                  </div>
                  <select value={fieldOfStudyFilter} onChange={(event) => setFieldOfStudyFilter(event.target.value)}>
                    {fieldOfStudyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                    ))}
                  </select>
                  <select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}>
                    {sizeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                    ))}
                  </select>
                  <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
                    {activityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                    ))}
                  </select>
                </div>

                <p className="results-count">{filteredGroups.length} groups found</p>

                {podsLoading && <p className="helper-copy">Loading groups...</p>}
                {!podsLoading && podsError && <p className="error-banner">{podsError}</p>}

                {!podsLoading && !podsError && (
                    <div className="group-grid">
                      {filteredGroups.map((group) => (
                          <article
                              key={group.id}
                              className="group-card group-card-clickable"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleGroupCardClick(group)}
                              onKeyDown={(event) => handleGroupCardKeyDown(event, group)}
                          >
                            <div className="group-emblem">{group.badge}</div>
                            <div className="group-card-content">
                              <h2>{group.name}</h2>
                              <p>{group.description}</p>

                              {group.fieldOfStudy && (
                                  <div className="group-tags">
                                    <span className="group-tag">
                                      <AppIcon name="tag"/>
                                      {group.fieldOfStudy}
                                    </span>
                                  </div>
                              )}

                              <div className="group-footer">
                        <span className="member-pill">
                          <AppIcon name="users"/>
                          {group.members.toLocaleString()} members
                        </span>
                                <span className="activity-pill">{group.activity}</span>
                                {group.locationCity && <span className="activity-pill">{group.locationCity}</span>}
                                {typeof group.locationDistanceKm === "number" && (
                                  <span className="activity-pill">{group.locationDistanceKm} km away</span>
                                )}
                                {typeof group.recommendationScore === "number" && (
                                  <span className="activity-pill">Fit {Math.round(group.recommendationScore * 100)}%</span>
                                )}
                              </div>
                            </div>
                          </article>
                      ))}
                    </div>
                )}

                <button type="button" className="floating-action" onClick={openCreateGroupForm}>
                  + Create Group
                </button>
              </>
          ) : (
              <>
                {myGroups.length > 0 ? (
                    <div className="group-grid my-groups-grid">
                      {myGroups.map((group) => (
                          <article
                              key={group.id}
                              className="group-card group-card-clickable"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleGroupCardClick(group)}
                              onKeyDown={(event) => handleGroupCardKeyDown(event, group)}
                          >
                            <div className="group-emblem">{group.badge}</div>
                            <div className="group-card-content">
                              <h2>{group.name}</h2>
                              <p>{group.description}</p>

                              {group.fieldOfStudy && (
                                  <div className="group-tags">
                                    <span className="group-tag">
                                      <AppIcon name="tag"/>
                                      {group.fieldOfStudy}
                                    </span>
                                  </div>
                              )}

                              <div className="group-footer">
                                <span className="member-pill">
                          <AppIcon name="users"/>
                          {group.members.toLocaleString()} members
                        </span>
                                <span className="activity-pill">{statusText(getGroupMembershipStatus(group))}</span>
                              </div>
                            </div>
                          </article>
                      ))}
                    </div>
                ) : (
                    <div className="empty-state">
                      <h2>No joined groups yet</h2>
                      <p>
                        Open a group and request to join. Your requested groups will show up here while you
                        wait for approval.
                      </p>
                    </div>
                )}
              </>
          )}
        </>
    );
  }

  function renderGroupDetailView() {
    if (!activeGroup) {
      return (
          <div className="empty-state">
            <h2>Group not available</h2>
            <p>Please return to discovery and select a group again.</p>
          </div>
      );
    }

    const status = joinStatusByGroup[activeGroup.id] || "none";
    const effectiveStatus = status === "none" ? activeGroup.membershipStatus : status;
    const joinDisabled =
        joiningPodId === activeGroup.id || effectiveStatus === "PENDING" || effectiveStatus === "ACTIVE";
    const joinLabel =
        effectiveStatus === "PENDING"
            ? "Request Pending"
            : effectiveStatus === "ACTIVE"
                ? "Joined"
                : activeGroup.joinActionLabel;
    const canLeave = effectiveStatus === "ACTIVE" || effectiveStatus === "PENDING";
    const leaveLabel = effectiveStatus === "PENDING" ? "Cancel Request" : "Leave Group";

    return (
        <>
          <button type="button" className="inline-back" onClick={() => setGroupView("discover")}>
            <AppIcon name="arrow-left"/>
            Back to Discovery
          </button>

          <section className="group-detail-hero">
            <div className="group-emblem large">{activeGroup.badge}</div>
            <div className="group-detail-main">
              <h1 className="group-title">{activeGroup.name}</h1>
              <div className="group-meta-row">
              <span>
                <AppIcon name="users"/>
                {activeGroup.members > 0
                    ? `${activeGroup.members.toLocaleString()} members`
                    : "No members yet"}
              </span>
                <span>
                <AppIcon name="calendar"/>
                Created {activeGroup.createdAt}
              </span>
                <span>
                <AppIcon name="lock"/>
                  {activeGroup.visibility === "PRIVATE" ? "Private" : "Public"}
              </span>
              </div>
              <p className="group-description">{activeGroup.description}</p>
              <div className="hero-actions">
                <button
                    type="button"
                    className="floating-action detail-join"
                    disabled={joinDisabled}
                    onClick={() => requestToJoin(activeGroup.id)}
                >
                  {joinLabel.toUpperCase()}
                </button>
                <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      void openGroupFeature("feed", activeGroup.id);
                    }}
                >
                  Open Group Features
                </button>
                {canLeave && (
                    <button
                        type="button"
                        className="secondary-action danger-action"
                        disabled={leavingPodId === activeGroup.id}
                        onClick={() => handleLeaveGroup(activeGroup.id)}
                    >
                      {leavingPodId === activeGroup.id ? "Leaving..." : leaveLabel}
                    </button>
                )}
              </div>
              {joinActionError && <p className="error-banner">{joinActionError}</p>}
            </div>
          </section>

          <section className="group-detail-grid">
            <div className="group-detail-left">
              <article className="detail-card">
                <h2>Group Details</h2>
                <ul className="detail-list">
                  <li>Field of Study: {activeGroup.fieldOfStudy || "Optional"}</li>
                  <li>Visibility: {activeGroup.visibility === "PRIVATE" ? "Private" : "Public"}</li>
                  <li>Membership Status: {statusText(effectiveStatus)}</li>
                </ul>
              </article>

              <article className="detail-card">
                <h2>Posts</h2>
                <p className="helper-copy">No posts yet.</p>
              </article>
            </div>

            <div className="group-detail-right">
              <article className="detail-card compact">
                <h2>Members</h2>
                <p className="stat-line">
                  {activeGroup.members > 0
                      ? `${activeGroup.members.toLocaleString()} member${activeGroup.members === 1 ? "" : "s"}`
                      : "No members yet."}
                </p>
              </article>

              <article className="detail-card compact">
                <h2>Admins</h2>
                <p className="stat-line">
                  {activeGroup.adminCount > 0
                      ? `${activeGroup.adminCount} admin${activeGroup.adminCount === 1 ? "" : "s"}`
                      : "No admins yet."}
                </p>
              </article>

              <article className="detail-card compact">
                <h2>Related Groups</h2>
                <div className="related-list">
                  {relatedGroups.length > 0 ? (
                      relatedGroups.map((group) => (
                          <button key={group.id} type="button" className="related-item"
                                  onClick={() => openGroup(group.id)}>
                            {group.name}
                          </button>
                      ))
                  ) : (
                      <p className="stat-line">No related groups yet.</p>
                  )}
                </div>
              </article>
            </div>
          </section>
        </>
    );
  }

  function renderGroupFeedView() {
    if (!activeGroup) {
      return (
          <div className="empty-state">
            <h2>Feed not available</h2>
            <p>Please return to the group page and open the feed again.</p>
          </div>
      );
    }

    const membershipStatus = getGroupMembershipStatus(activeGroup);
    const canPost = membershipStatus === "ACTIVE";
    const postsLoading = postsLoadingByGroup[activeGroup.id] === true;
    const canLeaveGroup = membershipStatus === "ACTIVE" || membershipStatus === "PENDING";
    const featureNavItems = [
      { id: "feed", label: "Feed", icon: "message" },
      { id: "biweekly", label: "Bi-Weekly Progress", icon: "calendar" },
      { id: "summary", label: "Bi-Weekly AI Summary", icon: "sparkles" },
      { id: "resume", label: "Resume Review", icon: "briefcase" },
      { id: "members", label: "Members", icon: "users" },
    ];

    function renderFeatureContent() {
      if (activeGroupFeature === "biweekly") {
        return (
          <>
            <header className="feature-page-header">
              <h2>Bi-Weekly Progress</h2>
              <p className="helper-copy">Track rituals, accountability, and momentum for this pod.</p>
            </header>
            <ProgressDashboard podId={activeGroup.id}/>
            <CelebrationFeed podId={activeGroup.id}/>
            <BiWeeklyRituals podId={activeGroup.id} user={user}/>
          </>
        );
      }

      if (activeGroupFeature === "resume") {
        return (
          <ResumeReviewPanel
            podId={activeGroup.id}
            user={user}
            isAdmin={activeGroup.membershipRole === "ADMIN" || activeGroup.membershipRole === "OWNER"}
          />
        );
      }

      if (activeGroupFeature === "summary") {
        return <BiweeklySummaryPanel podId={activeGroup.id} />;
      }

      if (activeGroupFeature === "members") {
        return (
          <article className="detail-card members-feature-card">
            <header className="feature-page-header">
              <h2>Members & accountability</h2>
              <p className="helper-copy">
                Supportive nudges, a private scorecard, and quiet mode—without pressure or shame.
              </p>
            </header>
            <MembersFeatureSection
              podId={activeGroup.id}
              user={user}
              currentMembershipRole={activeGroup.membershipRole}
            />
          </article>
        );
      }

      return (
        <>
          {postSuccessMessage && (
              <p className="success-toast" role="status" aria-live="polite">
                {postSuccessMessage}
              </p>
          )}

          <article className="detail-card composer-card">
            {canPost ? (
                <>
              <textarea
                  className="composer-input"
                  value={postDraft}
                  onChange={(event) => setPostDraft(event.target.value)}
                  placeholder="Share an update with this group..."
                  rows={4}
                  maxLength={2000}
              />
                  <div className="composer-actions">
                    <small>{postDraft.trim().length}/2000</small>
                    <button
                        type="button"
                        className="secondary-action"
                        disabled={postingPodId === activeGroup.id || postDraft.trim().length === 0}
                        onClick={handleCreatePost}
                    >
                      {postingPodId === activeGroup.id ? "Posting..." : "Create Post"}
                    </button>
                  </div>
                </>
            ) : (
                <p className="helper-copy">Join this group as an active member to create posts.</p>
            )}
            {postActionError && <p className="error-banner">{postActionError}</p>}
          </article>

          {feedTagOptions.length > 1 && (
              <article className="detail-card">
                <div className="filter-label">
                  <AppIcon name="filter"/>
                  <span>Filter by tag:</span>
                </div>
                <div className="feed-tag-row">
                  {feedTagOptions.map((tag) => (
                      <button
                          key={tag}
                          type="button"
                          className={feedTagFilter === tag ? "feed-tag active" : "feed-tag"}
                          onClick={() => setFeedTagFilter(tag)}
                      >
                        {tag}
                      </button>
                  ))}
                </div>
              </article>
          )}

          {postsLoading ? (
              <article className="detail-card">
                <p className="helper-copy">Loading posts...</p>
              </article>
          ) : filteredFeedPosts.length > 0 ? (
              filteredFeedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  highlightedPostId={highlightedPostId}
                  deletingPostId={deletingPostId}
                  onDelete={handleDeletePost}
                />
              ))
          ) : (
              <article className="detail-card">
                <h2>No posts yet</h2>
                <p className="helper-copy">This group has no posts yet.</p>
              </article>
          )}
        </>
      );
    }

    return (
        <>
          <button type="button" className="inline-back" onClick={() => setGroupView("detail")}>
            <AppIcon name="arrow-left"/>
            Back to Group
          </button>

          <header className="feed-header">
            <div>
              <h1 className="group-title">{activeGroup.name}</h1>
              <p className="helper-copy">Group features</p>
            </div>
            <div className="feed-actions">
              {canLeaveGroup && (
                  <button
                      type="button"
                      className="secondary-action danger-action"
                      disabled={leavingPodId === activeGroup.id}
                      onClick={() => handleLeaveGroup(activeGroup.id)}
                  >
                    {leavingPodId === activeGroup.id
                        ? "Leaving..."
                        : membershipStatus === "PENDING"
                            ? "Cancel Request"
                            : "Leave Group"}
                  </button>
              )}
              <button
                type="button"
                className="secondary-action"
                disabled={!isSettingsManager(activeGroup)}
                onClick={openGroupSettingsForm}
              >
                Group Settings
              </button>
            </div>
          </header>

          <section className="feed-layout">
            <div className="feed-main-column">
              {renderFeatureContent()}
            </div>

            <aside className="feed-sidebar-column">
              <EngagementScore podId={activeGroup.id} />
              
              <article className="detail-card compact feature-nav-card">
                <h2>Group Features</h2>
                <div className="feature-list">
                  {featureNavItems.map((feature) => (
                    <button
                      key={feature.id}
                      type="button"
                      className={activeGroupFeature === feature.id ? "feature-pill active" : "feature-pill"}
                      onClick={() => {
                        void openGroupFeature(feature.id, activeGroup.id);
                      }}
                    >
                      <AppIcon name={feature.icon}/>
                      {feature.label}
                    </button>
                  ))}
                </div>
              </article>

              <article className="detail-card compact">
                <h2>This Week</h2>
                <p className="stat-line split">
                  <span>Members</span>
                  <span>{activeGroup.members}</span>
                </p>
                <p className="stat-line split">
                  <span>Admins</span>
                  <span>{activeGroup.adminCount}</span>
                </p>
                <p className="stat-line split">
                  <span>Posts</span>
                  <span>{activeGroupPosts.length}</span>
                </p>
              </article>

              <article className="detail-card compact group-about-card">
                <h2>About Group</h2>
                <p>
                  {activeGroup.members > 0
                      ? `${activeGroup.members.toLocaleString()} members`
                      : "No members yet."}
                </p>
                <p>{activeGroup.visibility === "PRIVATE" ? "Private group" : "Public group"}</p>
                <p>Created {activeGroup.createdAt}</p>
              </article>

              <button
                type="button"
                className="secondary-action"
                disabled={!isSettingsManager(activeGroup)}
                onClick={openGroupSettingsForm}
              >
                Group Settings
              </button>
            </aside>
          </section>
        </>
    );
  }

  function renderGroupsContent() {
    if (groupView === "detail") return renderGroupDetailView();
    if (groupView === "feed") return renderGroupFeedView();
    return renderDiscoverView();
  }

  function handleSidebarSectionSelect(sectionId) {
    setActiveSection(sectionId);
    if (sectionId === "groups") {
      setGroupView("discover");
    }
  }

  async function handleResetDatabaseClick() {
    const confirmation = window.prompt(
      "This will permanently clear all app data (users, memberships, posts, rituals, resume reviews). Type RESET DATABASE to continue.",
      "",
    );

    if (confirmation === null) {
      return;
    }

    setResetDbError("");
    setResettingDb(true);

    try {
      await resetTestDatabase(confirmation);
      window.alert("Database reset completed. You will now be signed out.");
      await onLogout();
    } catch (error) {
      setResetDbError(error.message || "Failed to reset database.");
    } finally {
      setResettingDb(false);
    }
  }

  return (
      <main className="workspace-shell">
        <WorkspaceSidebar
            navItems={NAV_ITEMS}
            activeSection={activeSection}
            onSelectSection={handleSidebarSectionSelect}
            onLogout={onLogout}
            renderIcon={(name) => <AppIcon name={name}/>}
        />

        <div className="workspace-main">
          <header className="workspace-topbar">
            <div className="status-chip">Workspace</div>
            <div style={{display: "flex", alignItems: "center", gap: "1rem"}}>
              <button
                  type="button"
                  className="secondary-action danger-action"
                  disabled={resettingDb}
                  onClick={handleResetDatabaseClick}
              >
                {resettingDb ? "Resetting..." : "Reset Test DB"}
              </button>
              <NotificationBell/>
              <div className="user-chip">
                <AvatarBadge
                    key={userAvatarUrl || user.id}
                    className="user-avatar"
                    imageUrl={userAvatarUrl}
                    label={user.fullName || user.email || userInitial}
                />
                <div>
                  <p className="user-name">{user.fullName || user.email}</p>
                  <p className="user-meta">{user.careerStage || "Member"}</p>
                </div>
              </div>
            </div>
          </header>
          {resetDbError && <p className="error-banner">{resetDbError}</p>}

          {activeSection === "groups" ? (
              <section className="content-shell groups-shell">{renderGroupsContent()}</section>
          ) : (
              renderPlaceholderSection(activeSection)
          )}
        </div>

        {showOnboardingModal && activeGroup && (
            <PodOnboardingModal
                pod={activeGroup}
                user={user}
                onComplete={() => {
                  setShowOnboardingModal(false);
                  void openGroupFeature("feed", activeGroup.id);
                }}
                onClose={() => setShowOnboardingModal(false)}
            />
        )}

        {groupFormMode && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Group form">
            <div className="modal-content group-form-modal">
              <div className="members-view-header">
                <h2>{groupFormMode === "create" ? "Create Group" : "Group Settings"}</h2>
                <button
                  type="button"
                  className="close-button"
                  onClick={closeGroupForm}
                  aria-label="Close group form"
                  disabled={groupFormSaving}
                >
                  ×
                </button>
              </div>

              <form className="group-settings-form" onSubmit={handleGroupFormSubmit}>
                <label>
                  Group Name
                  <input
                    type="text"
                    value={groupFormValues.name}
                    onChange={(event) => updateGroupFormValue("name", event.target.value)}
                    maxLength={120}
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    className="intro-textarea"
                    rows={4}
                    value={groupFormValues.description}
                    onChange={(event) => updateGroupFormValue("description", event.target.value)}
                    maxLength={500}
                    required
                  />
                </label>

                <label>
                  Field of Study (optional)
                  <select
                    value={groupFormValues.fieldOfStudy}
                    onChange={(event) => updateGroupFormValue("fieldOfStudy", event.target.value)}
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
                  City or metro area (optional)
                  <select
                    value={groupFormValues.locationCity}
                    onChange={(event) => updateGroupFormValue("locationCity", event.target.value)}
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
                  Visibility
                  <select
                    value={groupFormValues.visibility}
                    onChange={(event) => updateGroupFormValue("visibility", event.target.value)}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </label>

                {groupFormError && <p className="error-banner">{groupFormError}</p>}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={closeGroupForm}
                    disabled={groupFormSaving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="floating-action" disabled={groupFormSaving}>
                    {groupFormSaving
                      ? "Saving..."
                      : groupFormMode === "create"
                        ? "Create Group"
                        : "Save Settings"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
  );
}