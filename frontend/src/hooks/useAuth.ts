import { useCallback } from "react";
import { getAccessToken } from "@/lib/auth-client";
import { useAuthContext, type AuthState } from "@/context/auth";

export type { AuthState };

export function useAuth(): AuthState {
  return useAuthContext();
}

export function useAuthToken() {
  return useCallback(async () => getAccessToken(), []);
}
