/**
 * Local fallback when the accountability API is not deployed yet.
 * Persists in sessionStorage so refreshes keep state during a demo session.
 */

const KEY = (podId) => `qwyse-accountability:${podId}`;

function read(podId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY(podId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function write(podId, data) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY(podId), JSON.stringify(data));
  } catch {
    // ignore quota
  }
}

export function loadLocalAccountability(podId) {
  return (
    read(podId) || {
      quietMode: { enabled: false, until: null, announcedToPod: true },
      history: { sent: [], received: [] },
    }
  );
}

export function saveLocalAccountability(podId, data) {
  write(podId, data);
}

export function appendLocalSentNudge(podId, entry) {
  const state = loadLocalAccountability(podId);
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const row = {
    id,
    toUserId: entry.toUserId,
    toName: entry.toName,
    preview: entry.preview.slice(0, 120),
    sentAt: new Date().toISOString(),
    templateId: entry.templateId || null,
  };
  state.history.sent = [row, ...(state.history.sent || [])].slice(0, 50);
  saveLocalAccountability(podId, state);
  return { ...row };
}

export function recordLocalNudgeResponse(podId, nudgeId, quickReplyId, label) {
  const state = loadLocalAccountability(podId);
  const received = state.history.received || [];
  const next = received.map((r) =>
    r.id === nudgeId
      ? {
          ...r,
          respondedAt: new Date().toISOString(),
          quickReply: label,
          quickReplyId,
        }
      : r,
  );
  state.history.received = next;
  saveLocalAccountability(podId, state);
}

export function setLocalQuietMode(podId, quietMode) {
  const state = loadLocalAccountability(podId);
  state.quietMode = {
    enabled: Boolean(quietMode.enabled),
    until: quietMode.until || null,
    announcedToPod: quietMode.announcedToPod !== false,
  };
  saveLocalAccountability(podId, state);
}

/** Demo eligibility when API is absent: first other member can be nudged (missed goals). */
export function buildDemoEligibility(members, currentUserId) {
  const eligibility = {};
  const others = (members || []).filter((m) => m.id !== currentUserId);
  others.forEach((m, index) => {
    if (index === 0) {
      eligibility[m.id] = {
        canNudge: true,
        reasons: ["MISSED_GOALS"],
        nudgesPaused: false,
      };
    } else {
      eligibility[m.id] = {
        canNudge: false,
        reasons: [],
        nudgesPaused: false,
      };
    }
  });
  return eligibility;
}
