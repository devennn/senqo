export type ApiKeyRecord = {
  id: string;
  workspace_id: string;
  label: string;
  key_hash: string;
  key_prefix: string;
  created_by_user_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CreateApiKeyInput = {
  workspaceId: string;
  label: string;
  keyHash: string;
  keyPrefix: string;
  createdByUserId: string | null;
  expiresAt: string | null;
};

export type ApiKeyPublicItem = {
  id: string;
  label: string;
  keyPrefix: string;
  expiresAt: string | null;
  createdAt: string;
};

export type VerifyApiKeyResult =
  | { ok: true; workspaceId: string }
  | { ok: false; reason: "invalid_api_key" | "api_key_expired" };
