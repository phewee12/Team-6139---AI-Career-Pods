const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

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
  return request("/pods");
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
  return request(`/pods/${podId}/members`);
}

export async function getUserPods() {
  return request("/pods/user/mypods");
}

export async function joinPod(podId) {
  return request(`/pods/${podId}/join`, { method: "POST" });
}

export async function leavePod(podId) {
  return request(`/pods/${podId}/leave`, { method: "POST" });
}

export async function getPodPosts(podId) {
  return request(`/pods/${podId}/posts`);
}

export async function createPodPost(podId, input) {
  return request(`/pods/${podId}/posts`, { method: "POST", body: input });
}

export async function deletePodPost(podId, postId) {
  return request(`/pods/${podId}/posts/${postId}`, { method: "DELETE" });
}

export function getGoogleAuthUrl() {
  return `${SERVER_URL}/api/auth/google`;
}

export async function getCurrentRituals(podId) {
  return request(`/pods/${podId}/checkin/current`);
}

export async function submitCheckIn(podId, notes, goals) {
  return request(`/pods/${podId}/checkin`, {
    method: "POST",
    body: { notes, goals },
  });
}

export async function submitReflection(podId, content) {
  return request(`/pods/${podId}/reflection`, {
    method: "POST",
    body: { content },
  });
}

export async function addCelebration(podId, title, description) {
  return request(`/pods/${podId}/celebrations`, {
    method: "POST",
    body: { title, description },
  });
}

export async function getPodCheckIns(podId) {
  return request(`/pods/${podId}/checkins`);
}

export async function getPodReflections(podId) {
  return request(`/pods/${podId}/reflections`);
}

export async function getPodPhase(podId) {
  return request(`/pods/${podId}/phase`);
}

export async function getPodStats(podId) {
  return request(`/pods/${podId}/stats`);
}

export async function getPodCelebrations(podId) {
  return request(`/pods/${podId}/celebrations/all`);
}

export async function getNotifications() {
  return request(`/pods/notifications`);
}

export async function markNotificationRead(notificationId) {
  return request(`/pods/notifications/${notificationId}/read`, { method: "PATCH" });
}