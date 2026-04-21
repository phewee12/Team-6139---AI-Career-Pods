const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const TEST_DB_RESET_TOKEN = import.meta.env.VITE_TEST_DB_RESET_TOKEN || "";
const CACHE_PREFIX = "qwyse-cache:";

const memoryCache = new Map();

function nowMs() {
  return Date.now();
}

function getCacheKey(path) {
  return `${CACHE_PREFIX}${path}`;
}

function readSessionCache(cacheKey) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expiresAt !== "number") {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    if (parsed.expiresAt <= nowMs()) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(cacheKey, data, ttlMs) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        expiresAt: nowMs() + ttlMs,
      }),
    );
  } catch {
    // Ignore storage quota or serialization errors.
  }
}

function setCache(path, data, ttlMs) {
  const cacheKey = getCacheKey(path);
  const expiresAt = nowMs() + ttlMs;
  memoryCache.set(cacheKey, { data, expiresAt });
  writeSessionCache(cacheKey, data, ttlMs);
}

function getCache(path) {
  const cacheKey = getCacheKey(path);
  const cached = memoryCache.get(cacheKey);

  if (cached && cached.expiresAt > nowMs()) {
    return cached.data;
  }

  if (cached) {
    memoryCache.delete(cacheKey);
  }

  const sessionCached = readSessionCache(cacheKey);
  if (sessionCached) {
    memoryCache.set(cacheKey, { data: sessionCached, expiresAt: nowMs() + 1000 });
    return sessionCached;
  }

  return null;
}

function clearCache(path) {
  const cacheKey = getCacheKey(path);
  memoryCache.delete(cacheKey);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(cacheKey);
  }
}

function clearPodCache(podId) {
  [
    `/pods/${podId}/members`,
    `/pods/${podId}/checkin/current`,
    `/pods/${podId}/checkins`,
    `/pods/${podId}/phase`,
    `/pods/${podId}/resume-reviews`,
    `/pods/${podId}/stats`,
    `/pods/${podId}/celebrations/all`,
    `/pods/${podId}/posts`,
    `/pods/${podId}/accountability`,
    "/pods",
  ].forEach(clearCache);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const hasJson = contentType.includes("application/json");
  const payload = hasJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message || "Request failed.";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function requestCached(path, ttlMs = 45000) {
  const cached = getCache(path);
  if (cached) {
    return cached;
  }

  const payload = await request(path);
  setCache(path, payload, ttlMs);
  return payload;
}

export async function registerUser(input) {
  return request("/auth/register", { method: "POST", body: input });
}

export async function loginUser(input) {
  return request("/auth/login", { method: "POST", body: input });
}

export async function logoutUser() {
  return request("/auth/logout", { method: "POST" });
}

export async function getCurrentUser() {
  return request("/auth/me");
}

export async function setupProfile(input) {
  return request("/users/profile", { method: "PUT", body: input });
}

export async function getPods() {
  return requestCached("/pods", 30000);
}

export async function createPod(input) {
  const result = await request("/pods", { method: "POST", body: input });
  clearCache("/pods");
  return result;
}

export async function updatePodSettings(podId, input) {
  const result = await request(`/pods/${podId}`, {
    method: "PATCH",
    body: input,
  });
  clearPodCache(podId);
  return result;
}

export async function promotePodMemberToAdmin(podId, membershipId) {
  const result = await request(`/pods/${podId}/members/${membershipId}/role`, {
    method: "PATCH",
    body: { role: "ADMIN" },
  });
  clearCache(`/pods/${podId}/members`);
  return result;
}

export async function getPodOnboarding(podId) {
  return request(`/pods/${podId}/onboarding`);
}

export async function completePodOnboarding(podId, introMessage) {
  return request(`/pods/${podId}/onboarding`, {
    method: "POST",
    body: { introMessage },
  });
}

export async function getPodMembers(podId) {
  return requestCached(`/pods/${podId}/members`, 45000);
}

/** Accountability & nudges — backend may return 404 until implemented. */
export async function getPodAccountability(podId) {
  return request(`/pods/${podId}/accountability`);
}

export async function sendPodNudge(podId, body) {
  const result = await request(`/pods/${podId}/nudges`, {
    method: "POST",
    body,
  });
  clearCache(`/pods/${podId}/accountability`);
  return result;
}

export async function respondToPodNudge(podId, nudgeId, body) {
  const result = await request(`/pods/${podId}/nudges/${nudgeId}/respond`, {
    method: "POST",
    body,
  });
  clearCache(`/pods/${podId}/accountability`);
  return result;
}

export async function setPodQuietMode(podId, body) {
  const result = await request(`/pods/${podId}/accountability/quiet-mode`, {
    method: "PUT",
    body,
  });
  clearCache(`/pods/${podId}/accountability`);
  return result;
}

export async function getUserPods() {
  return request("/pods/user/mypods");
}

export async function joinPod(podId) {
  const result = await request(`/pods/${podId}/join`, { method: "POST" });
  clearPodCache(podId);
  return result;
}

export async function leavePod(podId) {
  const result = await request(`/pods/${podId}/leave`, { method: "POST" });
  clearPodCache(podId);
  return result;
}

export async function getPodPosts(podId) {
  return requestCached(`/pods/${podId}/posts`, 20000);
}

export async function createPodPost(podId, input) {
  const result = await request(`/pods/${podId}/posts`, { method: "POST", body: input });
  clearCache(`/pods/${podId}/posts`);
  return result;
}

export async function deletePodPost(podId, postId) {
  const result = await request(`/pods/${podId}/posts/${postId}`, { method: "DELETE" });
  clearCache(`/pods/${podId}/posts`);
  return result;
}

export function getGoogleAuthUrl() {
  return `${SERVER_URL}/api/auth/google`;
}

export async function getCurrentRituals(podId) {
  return requestCached(`/pods/${podId}/checkin/current`, 45000);
}

export async function submitCheckIn(podId, notes, goals) {
  const result = await request(`/pods/${podId}/checkin`, {
    method: "POST",
    body: { notes, goals },
  });
  clearCache(`/pods/${podId}/checkin/current`);
  clearCache(`/pods/${podId}/checkins`);
  clearCache(`/pods/${podId}/stats`);
  return result;
}

export async function submitReflection(podId, content) {
  const result = await request(`/pods/${podId}/reflection`, {
    method: "POST",
    body: { content },
  });
  clearCache(`/pods/${podId}/checkin/current`);
  clearCache(`/pods/${podId}/checkins`);
  clearCache(`/pods/${podId}/reflections`);
  clearCache(`/pods/${podId}/stats`);
  return result;
}

export async function addCelebration(podId, title, description) {
  const result = await request(`/pods/${podId}/celebrations`, {
    method: "POST",
    body: { title, description },
  });
  clearCache(`/pods/${podId}/checkin/current`);
  clearCache(`/pods/${podId}/celebrations/all`);
  clearCache(`/pods/${podId}/stats`);
  return result;
}

export async function getPodCheckIns(podId) {
  return requestCached(`/pods/${podId}/checkins`, 45000);
}

export async function getPodReflections(podId) {
  return requestCached(`/pods/${podId}/reflections`, 45000);
}

export async function getPodPhase(podId) {
  return requestCached(`/pods/${podId}/phase`, 45000);
}

export async function getPodStats(podId) {
  return requestCached(`/pods/${podId}/stats`, 30000);
}

export async function getPodCelebrations(podId) {
  return requestCached(`/pods/${podId}/celebrations/all`, 45000);
}

export async function getNotifications() {
  return request(`/pods/notifications`);
}

export async function markNotificationRead(notificationId) {
  return request(`/pods/notifications/${notificationId}/read`, { method: "PATCH" });
}

export async function markNotificationUnread(notificationId) {
  return request(`/pods/notifications/${notificationId}/unread`, { method: "PATCH" });
}

export async function createResumeReviewRequest(podId, input) {
  const result = await request(`/pods/${podId}/resume-reviews`, {
    method: "POST",
    body: input,
  });
  clearCache(`/pods/${podId}/resume-reviews`);
  return result;
}

export async function uploadResumeReviewFile(podId, requestId, input) {
  const result = await request(`/pods/${podId}/resume-reviews/${requestId}/file`, {
    method: "POST",
    body: input,
  });
  clearCache(`/pods/${podId}/resume-reviews`);
  clearCache(`/pods/${podId}/resume-reviews/${requestId}`);
  return result;
}

export async function getResumeReviewRequests(podId) {
  return requestCached(`/pods/${podId}/resume-reviews`, 45000);
}

export async function getResumeReviewRequest(podId, requestId) {
  return requestCached(`/pods/${podId}/resume-reviews/${requestId}`, 30000);
}

export async function getResumeReviewFileUrl(podId, requestId) {
  return request(`/pods/${podId}/resume-reviews/${requestId}/file-url`);
}

export async function submitResumeReviewFeedback(podId, requestId, input) {
  const result = await request(`/pods/${podId}/resume-reviews/${requestId}/feedback`, {
    method: "POST",
    body: input,
  });
  clearCache(`/pods/${podId}/resume-reviews`);
  clearCache(`/pods/${podId}/resume-reviews/${requestId}`);
  clearCache(`/pods/${podId}/resume-reviews/${requestId}/feedback`);
  clearCache(`/pods/${podId}/resume-reviews/${requestId}/my-feedback`);
  return result;
}

export async function getResumeReviewFeedback(podId, requestId) {
  return requestCached(`/pods/${podId}/resume-reviews/${requestId}/feedback`, 30000);
}

export async function getMyResumeReviewFeedback(podId, requestId) {
  return requestCached(`/pods/${podId}/resume-reviews/${requestId}/my-feedback`, 30000);
}

export async function updateResumeReviewStatus(podId, requestId, status) {
  const result = await request(`/pods/${podId}/resume-reviews/${requestId}/status`, {
    method: "PATCH",
    body: { status },
  });
  clearCache(`/pods/${podId}/resume-reviews`);
  clearCache(`/pods/${podId}/resume-reviews/${requestId}`);
  return result;
}

export async function deleteResumeReviewRequest(podId, requestId) {
  const result = await request(`/pods/${podId}/resume-reviews/${requestId}`, {
    method: "DELETE",
  });
  clearCache(`/pods/${podId}/resume-reviews`);
  clearCache(`/pods/${podId}/resume-reviews/${requestId}`);
  return result;
}

export function prefetchPodFeatureData(podId) {
  if (!podId) {
    return;
  }

  const tasks = [
    getCurrentRituals(podId),
    getPodCheckIns(podId),
    getPodPhase(podId),
    getPodStats(podId),
    getPodCelebrations(podId),
    getPodPosts(podId),
    getResumeReviewRequests(podId),
    getPodMembers(podId),
  ];

  tasks.forEach((task) => {
    Promise.resolve(task).catch(() => {
      // Ignore prefetch errors; components will handle user-facing errors on demand.
    });
  });
}

export async function resetTestDatabase(confirmText) {
  const headers = TEST_DB_RESET_TOKEN
    ? {
        "x-reset-token": TEST_DB_RESET_TOKEN,
      }
    : undefined;

  return request(`/admin/test/reset-db`, {
    method: "POST",
    headers,
    body: { confirmText },
  });
}