/** Extract user-facing message from Axios / FastAPI errors. */

export function extractApiError(err: unknown, fallback = "Request failed"): string {
  if (!err || typeof err !== "object") return fallback;

  const ax = err as {
    response?: {
      status?: number;
      data?: { detail?: unknown; message?: string; code?: string };
    };
    message?: string;
  };

  const status = ax.response?.status;
  const detail = ax.response?.data?.detail;

  if (status === 401) {
    return "You must sign in to access learning modules. Please log in first.";
  }
  if (status === 403) {
    return typeof detail === "string" ? detail : "You do not have permission for this action.";
  }
  if (status === 404) {
    return typeof detail === "string" ? detail : "Resource not found.";
  }
  if (status === 409) {
    return typeof detail === "string" ? detail : "Conflict — resource already exists.";
  }
  if (status === 429) {
    return typeof detail === "string" ? detail : "YouTube API quota exceeded. Try again later.";
  }

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  if (ax.response?.data?.message) return ax.response.data.message;
  if (ax.message && ax.message !== "Network Error") return ax.message;
  if (ax.message === "Network Error") {
    return "Cannot reach the API. Is FastAPI running on localhost:8000?";
  }
  return fallback;
}
