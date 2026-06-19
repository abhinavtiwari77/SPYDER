const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "")

export const withApiBase = (path = "") => {
  if (!path) return API_BASE_URL
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
}