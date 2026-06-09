import { useEffect, useState, useCallback } from "react";
import { getSession, getAccessToken, type AuthUser } from "@/lib/auth-client";

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((u) => setUser(u))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

export function useAuthToken() {
  return useCallback(async () => getAccessToken(), []);
}