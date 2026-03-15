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

export function getGoogleAuthUrl() {
  return `${SERVER_URL}/api/auth/google`;
}
