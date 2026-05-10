const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const withApiPrefix = (value) => {
  const baseUrl = trimTrailingSlash(value);
  return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
};

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.VITE_BACKEND_URL
    ? withApiPrefix(import.meta.env.VITE_BACKEND_URL)
    : import.meta.env.DEV
      ? "http://localhost:3000/api"
      : "/api");

