/**
 * Auth API — real backend JWT via AuthService._issue_tokens / create_access_token.
 */

import apiClient from "@/lib/api-client";
import type { AuthUser } from "@/stores/auth-store";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthMeResponse {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export function mapMeToUser(me: AuthMeResponse): AuthUser {
  return {
    id: String(me.id),
    email: me.email,
    name: me.full_name,
  };
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const ax = err as {
      response?: { status?: number; data?: { detail?: unknown; message?: string } };
      message?: string;
    };
    const detail = ax.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
    if (ax.response?.data?.message) return ax.response.data.message;
    if (ax.response?.status === 401) return "Invalid email or password";
    if (ax.response?.status === 409) return "Email already registered";
    if (ax.message) return ax.message;
  }
  if (err instanceof Error) return err.message;
  return "Authentication failed";
}

/**
 * POST /auth/login → JWT from create_access_token → GET /auth/me with Bearer.
 */
export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  try {
    const { data: tokens } = await apiClient.post<TokenPair>("/auth/login", {
      email,
      password,
    });

    if (!tokens?.access_token || tokens.access_token === "demo-access-token") {
      throw new Error("Backend did not return a valid access token");
    }

    const { data: me } = await apiClient.get<AuthMeResponse>("/auth/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    return { user: mapMeToUser(me), tokens };
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * POST /auth/register → JWT → GET /auth/me.
 */
export async function registerWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ user: AuthUser; tokens: TokenPair }> {
  try {
    const { data: tokens } = await apiClient.post<TokenPair>("/auth/register", {
      email: input.email,
      password: input.password,
      full_name: input.fullName,
    });

    if (!tokens?.access_token || tokens.access_token === "demo-access-token") {
      throw new Error("Backend did not return a valid access token");
    }

    const { data: me } = await apiClient.get<AuthMeResponse>("/auth/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    return { user: mapMeToUser(me), tokens };
  } catch (err) {
    throw new Error(extractErrorMessage(err));
  }
}

export async function fetchCurrentUser(accessToken?: string): Promise<AuthUser> {
  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;
  const { data: me } = await apiClient.get<AuthMeResponse>("/auth/me", { headers });
  return mapMeToUser(me);
}
