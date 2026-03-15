import { useEffect, useMemo, useState } from "react";
import { getPods } from "../api/client";

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
    description: "Temporary placeholder while we shape the first qwyse onboarding flow.",
  },
  home: {
    eyebrow: "Home",
    title: "Home overview",
    description: "Temporary placeholder for the qwyse home experience.",
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

const POD_METADATA = {
  "internship-accelerator": {
    category: "Product",
    size: "Small",
    activity: "Weekly",
    members: 18,
    badge: "IA",
    tags: ["Internships", "Product", "Momentum"],
  },
  "grad-school-strategy": {
    category: "Education",
    size: "Mid",
    activity: "Focused",
    members: 34,
    badge: "GS",
    tags: ["Research", "Applications", "Graduate"],
  },
  "career-switch-lab": {
    category: "Career",
    size: "Small",
    activity: "Active",
    members: 22,
    badge: "CS",
    tags: ["Career", "Transition", "Support"],
  },
};

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
    const metadata = POD_METADATA[pod.slug] || {};

    return {
      ...pod,
      badge: metadata.badge || pod.name.slice(0, 2).toUpperCase(),
      members: metadata.members || 12,
      size: metadata.size || "Small",
      activity: metadata.activity || "Active",
      category: metadata.category || pod.focusArea || "General",
      tags: metadata.tags || [pod.focusArea || "General"],
    };
  });
}

export default function DashboardPage({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState("groups");
  const [activeTab, setActiveTab] = useState("discover");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [activityFilter, setActivityFilter] = useState("All");
  const [pods, setPods] = useState([]);
  const [podsLoading, setPodsLoading] = useState(true);
  const [podsError, setPodsError] = useState("");

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

  const userInitial = (user.fullName || user.email || "Q").charAt(0).toUpperCase();

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

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="brand-block">
          <div className="brand-mark">Q</div>
          <div>
            <p className="brand-name">qwyse</p>
            <p className="brand-subtitle">Career intelligence</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeSection ? "sidebar-link active" : "sidebar-link"}
              onClick={() => setActiveSection(item.id)}
            >
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="sidebar-logout" onClick={onLogout}>
          Sign out
        </button>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="status-chip">Workspace</div>
          <div className="user-chip">
            <div className="user-avatar">{userInitial}</div>
            <div>
              <p className="user-name">{user.fullName || user.email}</p>
              <p className="user-meta">{user.careerStage || "Member"}</p>
            </div>
          </div>
        </header>

        {activeSection === "groups" ? (
          <section className="content-shell groups-shell">
            <header className="content-header">
              <p className="eyebrow">qwyse groups</p>
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
                  <button type="button" className="secondary-action">
                    Search
                  </button>
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
                      <article key={group.id} className="group-card">
                        <div className="group-emblem">{group.badge}</div>
                        <div className="group-card-content">
                          <h2>{group.name}</h2>
                          <p>{group.description}</p>

                          <div className="group-tags">
                            {group.tags.map((tag) => (
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
              <div className="empty-state">
                <h2>No joined groups yet</h2>
                <p>
                  Join flow comes next. For now, use Discover Groups to browse the starter qwyse communities.
                </p>
              </div>
            )}
          </section>
        ) : (
          renderPlaceholderSection(activeSection)
        )}
      </div>
    </main>
  );
}
