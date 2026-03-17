import { useEffect, useMemo, useState } from "react";
import { createPodPost, getPodPosts, getPods, joinPod, getPodOnboarding } from "../api/client";
import PodOnboardingModal from "../components/PodOnboardingModel";
import PodMembersList from "../components/PodMembersList";
import WorkspaceSidebar from "../components/WorkspaceSidebar";

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

    return {
      ...pod,
      badge: pod.name.slice(0, 2).toUpperCase(),
      members,
      size: deriveGroupSize(members),
      activity: visibility === "PRIVATE" ? "Private" : "Public",
      category: pod.focusArea || "General",
      tags: pod.focusArea ? [pod.focusArea] : [],
      membershipStatus,
      membershipRole,
      joinActionLabel:
        pod.joinActionLabel || (visibility === "PRIVATE" ? "Request To Join" : "Join Group"),
      createdAt: formatMonthYear(pod.createdAt),
      visibility,
      adminCount:
        pod.createdById || (membershipRole === "ADMIN" && membershipStatus === "ACTIVE") ? 1 : 0,
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

export default function DashboardPage({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState("groups");
  const [activeTab, setActiveTab] = useState("discover");
  const [groupView, setGroupView] = useState("discover");
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [activityFilter, setActivityFilter] = useState("All");
  const [feedTagFilter, setFeedTagFilter] = useState("All Posts");
  const [joinStatusByGroup, setJoinStatusByGroup] = useState({});
  const [joiningPodId, setJoiningPodId] = useState(null);
  const [joinActionError, setJoinActionError] = useState("");
  const [postDraft, setPostDraft] = useState("");
  const [postingPodId, setPostingPodId] = useState(null);
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
  const [showMembersView, setShowMembersView] = useState(false);

  async function checkOnboardingStatus(groupId) {
    try {
      const result = await getPodOnboarding(groupId);
      console.log("2. Onboarding API result:", result);

      // Show modal if not onboarded
      if (!result.onboarded && result.canOnboard) {
        console.log("3. Conditions met, showing modal");
        setShowOnboardingModal(true);
      } else {
        console.log("3. Conditions not met:", { onboarded: result.onboarded, canOnboard: result.canOnboard });
      }
    } catch (error) {
      console.error("Failed to check onboarding:", error);
    }
  }

  function toggleMembersView() {
    setShowMembersView(!showMembersView);
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
      const next = { ...current };

      discoverGroups.forEach((group) => {
        if (!next[group.id] && group.membershipStatus) {
          next[group.id] = group.membershipStatus;
        }
      });

      return next;
    });
  }, [discoverGroups]);

  const categoryOptions = useMemo(
    () => ["All", ...new Set(discoverGroups.map((group) => group.category))],
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
        [group.name, group.description, group.category, ...group.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesCategory = categoryFilter === "All" || group.category === categoryFilter;
      const matchesSize = sizeFilter === "All" || group.size === sizeFilter;
      const matchesActivity = activityFilter === "All" || group.activity === activityFilter;

      return matchesSearch && matchesCategory && matchesSize && matchesActivity;
    });
  }, [activityFilter, categoryFilter, discoverGroups, searchTerm, sizeFilter]);

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

    postElement.scrollIntoView({ behavior: "smooth", block: "center" });
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
  }

  function openFeed(groupId) {
    setJoinActionError("");
    setPostActionError("");
    setActiveGroupId(groupId);
    setFeedTagFilter("All Posts");
    setGroupView("feed");
    setPostDraft("");
    loadGroupPosts(groupId);
  }

  function getGroupMembershipStatus(group) {
    return joinStatusByGroup[group.id] || group.membershipStatus || null;
  }

  function handleGroupCardClick(group) {
    const membershipStatus = getGroupMembershipStatus(group);

    if (membershipStatus === "ACTIVE") {
      openFeed(group.id);
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
        await checkOnboardingStatus(groupId);
        openFeed(groupId);
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
      const result = await createPodPost(activeGroup.id, { content });
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
                <AppIcon name="search" />
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
                <AppIcon name="filter" />
                <span>Filters:</span>
              </div>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                {categoryOptions.map((option) => (
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

                      <div className="group-tags">
                        {group.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="group-tag">
                            <AppIcon name="tag" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="group-footer">
                        <span className="member-pill">
                          <AppIcon name="users" />
                          {group.members.toLocaleString()} members
                        </span>
                        <span className="activity-pill">{group.activity}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <button type="button" className="floating-action">
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
                      <div className="group-footer">
                        <span className="member-pill">{statusText(getGroupMembershipStatus(group))}</span>
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

    return (
      <>
        <button type="button" className="inline-back" onClick={() => setGroupView("discover")}>
          <AppIcon name="arrow-left" />
          Back to Discovery
        </button>

        <section className="group-detail-hero">
          <div className="group-emblem large">{activeGroup.badge}</div>
          <div className="group-detail-main">
            <h1 className="group-title">{activeGroup.name}</h1>
            <div className="group-meta-row">
              <span>
                <AppIcon name="users" />
                {activeGroup.members > 0
                  ? `${activeGroup.members.toLocaleString()} members`
                  : "No members yet"}
              </span>
              <span>
                <AppIcon name="calendar" />
                Created {activeGroup.createdAt}
              </span>
              <span>
                <AppIcon name="lock" />
                {activeGroup.visibility === "PRIVATE" ? "Private" : "Public"}
              </span>
            </div>
            <p className="group-description">{activeGroup.description}</p>
            {activeGroup.tags.length > 0 && (
              <div className="group-tags">
                {activeGroup.tags.map((tag) => (
                  <span key={tag} className="group-tag">
                    <AppIcon name="tag" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="hero-actions">
              <button
                type="button"
                className="floating-action detail-join"
                disabled={joinDisabled}
                onClick={() => requestToJoin(activeGroup.id)}
              >
                {joinLabel.toUpperCase()}
              </button>
              <button type="button" className="secondary-action" onClick={() => openFeed(activeGroup.id)}>
                View Feed
              </button>
            </div>
            {joinActionError && <p className="error-banner">{joinActionError}</p>}
          </div>
        </section>

        <section className="group-detail-grid">
          <div className="group-detail-left">
            <article className="detail-card">
              <h2>Group Details</h2>
              <ul className="detail-list">
                <li>Focus Area: {activeGroup.category}</li>
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
                    <button key={group.id} type="button" className="related-item" onClick={() => openGroup(group.id)}>
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

    return (
        <>
          <button type="button" className="inline-back" onClick={() => setGroupView("detail")}>
            <AppIcon name="arrow-left" />
            Back to Group
          </button>

          <header className="feed-header">
            <div>
              <h1 className="group-title">{activeGroup.name}</h1>
              <p className="helper-copy">Group Feed</p>
            </div>
            <div className="feed-actions">
              <button
                  type="button"
                  className="secondary-action"
                  onClick={toggleMembersView}
              >
                View Members
              </button>
              <button type="button" className="secondary-action">
                Group Settings
              </button>
            </div>
          </header>

        <section className="feed-layout">
          <div className="feed-main-column">
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
                  <AppIcon name="filter" />
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
              <article
                id={`post-${post.id}`}
                key={post.id}
                className={
                  post.id === highlightedPostId
                    ? "detail-card post-card post-card-highlight"
                    : "detail-card post-card"
                }
              >
                <header className="post-header">
                  <AvatarBadge
                    key={post.author?.id || post.id}
                    className="feed-author-avatar"
                    imageUrl={post.author?.avatarImageUrl || post.author?.avatarUrl || ""}
                    label={post.author?.fullName || post.author?.email || "Member"}
                  />
                  <div>
                    <p className="post-author">{post.author?.fullName || post.author?.email || "Member"}</p>
                    <small>{formatPostTimestamp(post.createdAt)}</small>
                  </div>
                </header>
                <p>{post.content}</p>
              </article>
              ))
            ) : (
              <article className="detail-card">
                <h2>No posts yet</h2>
                <p className="helper-copy">This group has no posts yet.</p>
              </article>
            )}
          </div>

          <aside className="feed-sidebar-column">
            <article className="detail-card compact">
              <h2>Group Stats</h2>
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

            <article className="detail-card compact">
              <h2>About Group</h2>
              <p>
                {activeGroup.members > 0
                  ? `${activeGroup.members.toLocaleString()} members`
                  : "No members yet."}
              </p>
              <p>{activeGroup.visibility === "PRIVATE" ? "Private group" : "Public group"}</p>
              <p>Created {activeGroup.createdAt}</p>
            </article>
          </aside>
        </section>
        {showMembersView && (
            <section className="members-view-section">
              <div className="members-view-header">
                <h2>Pod Members</h2>
                <button
                    type="button"
                    className="close-button"
                    onClick={toggleMembersView}
                >
                  ×
                </button>
              </div>
              <PodMembersList podId={activeGroup.id} />
            </section>
        )}
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

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar
        navItems={NAV_ITEMS}
        activeSection={activeSection}
        onSelectSection={handleSidebarSectionSelect}
        onLogout={onLogout}
        renderIcon={(name) => <AppIcon name={name} />}
      />

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="status-chip">Workspace</div>
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
        </header>

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
                // Refresh onboarding status
                checkOnboardingStatus(activeGroup.id);
                loadGroupPosts(activeGroup.id);
              }}
              onClose={() => setShowOnboardingModal(false)}
          />
      )}
    </main>
  );
}
