import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Zustand persist default key
    const raw = localStorage.getItem("aat-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && token !== "demo-access-token") {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Surface structured error for services
    return Promise.reject(error);
  }
);

export default apiClient;
export { getAccessToken };
