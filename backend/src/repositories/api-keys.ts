import {
  getApiKeyVerificationHashes,
  hashApiKey,
} from "../lib/api-keys.js";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceApiKeys } from "../db/schema/index.js";
import type {
  ApiKeyPublicItem,
  ApiKeyRecord,
  CreateApiKeyInput,
  VerifyApiKeyResult,
} from "../types/api-keys.js";

const scope = "ApiKeysRepository";

export async function createApiKey(
  input: CreateApiKeyInput,
): Promise<{ ok: boolean; id: string | null; message?: string }> {
  const insertPayload = {
    workspaceId: input.workspaceId,
    label: input.label,
    keyHash: input.keyHash,
    keyPrefix: input.keyPrefix,
    createdByUserId: input.createdByUserId,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  };
  try {
    let rows: { id: string }[] = [];
    try {
      rows = await db
        .insert(workspaceApiKeys)
        .values(insertPayload)
        .returning({ id: workspaceApiKeys.id });
    } catch (insertErr) {
      if (
        String(insertErr).includes("workspace_api_keys_created_by_user_id_fkey") &&
        input.createdByUserId
      ) {
        rows = await db
          .insert(workspaceApiKeys)
          .values({ ...insertPayload, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, createdByUserId: null })
          .returning({ id: workspaceApiKeys.id });
      } else {
        throw insertErr;
      }
    }
    if (!rows[0]?.id) {
      const message = "insert_failed";
      console.error(`[${scope}/createApiKey] Failed query: ${message}`);
      return { ok: false, id: null, message };
    }
    console.info(
      `[${scope}/createApiKey] Success: userId=${input.workspaceId} id=${String(rows[0].id)}`,
    );
    return { ok: true, id: String(rows[0].id) };
  } catch (error) {
    console.error(`[${scope}/createApiKey] Unexpected error: ${String(error)}`);
    return { ok: false, id: null, message: "unexpected_error" };
  }
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeyPublicItem[]> {
  try {
    const rows = await db
      .select({
        id: workspaceApiKeys.id,
        label: workspaceApiKeys.label,
        keyPrefix: workspaceApiKeys.keyPrefix,
        expiresAt: workspaceApiKeys.expiresAt,
        createdAt: workspaceApiKeys.createdAt,
      })
      .from(workspaceApiKeys)
      .where(eq(workspaceApiKeys.workspaceId, workspaceId))
      .orderBy(desc(workspaceApiKeys.createdAt));

    console.info(`[${scope}/listApiKeys] Success: userId=${workspaceId}`);
    return rows.map((row) => ({
      id: String(row.id),
      label: String(row.label),
      keyPrefix: String(row.keyPrefix),
      expiresAt: row.expiresAt ? String(row.expiresAt) : null,
      createdAt: String(row.createdAt),
    }));
  } catch (error) {
    console.error(`[${scope}/listApiKeys] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function deleteApiKey(
  workspaceId: string,
  apiKeyId: string,
): Promise<boolean> {
  try {
    const result = await db
      .delete(workspaceApiKeys)
      .where(
        and(
          eq(workspaceApiKeys.workspaceId, workspaceId),
          eq(workspaceApiKeys.id, apiKeyId),
        ),
      );
    if (result.rowCount === 0) {
      console.error(`[${scope}/deleteApiKey] Failed query: no rows deleted`);
      return false;
    }
    console.info(
      `[${scope}/deleteApiKey] Success: userId=${workspaceId} apiKeyId=${apiKeyId}`,
    );
    return true;
  } catch (error) {
    console.error(`[${scope}/deleteApiKey] Unexpected error: ${String(error)}`);
    return false;
  }
}

type ApiKeyVerificationRow = Pick<
  ApiKeyRecord,
  "id" | "workspace_id" | "expires_at" | "revoked_at"
>;

function validateApiKeyRow(row: ApiKeyVerificationRow): VerifyApiKeyResult {
  if (row.revoked_at) {
    console.error(`[${scope}/verifyApiKeyHash] Failed query: revoked`);
    return { ok: false, reason: "invalid_api_key" };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    console.error(`[${scope}/verifyApiKeyHash] Failed query: expired`);
    return { ok: false, reason: "api_key_expired" };
  }
  console.info(
    `[${scope}/verifyApiKeyHash] Success: userId=${String(row.workspace_id)} apiKeyId=${String(row.id)}`,
  );
  return { ok: true, workspaceId: String(row.workspace_id) };
}

async function upgradeApiKeyHash(apiKeyId: string, rawApiKey: string): Promise<void> {
  const newHash = hashApiKey(rawApiKey);
  try {
    await db
      .update(workspaceApiKeys)
      .set({ keyHash: newHash })
      .where(eq(workspaceApiKeys.id, apiKeyId));
    console.info(`[${scope}/upgradeApiKeyHash] Success: apiKeyId=${apiKeyId}`);
  } catch (error) {
    console.error(`[${scope}/upgradeApiKeyHash] Unexpected error: ${String(error)}`);
  }
}

async function verifyApiKeyHashOnce(
  keyHash: string,
): Promise<
  | { ok: true; row: ApiKeyVerificationRow }
  | { ok: false }
> {
  try {
    const rows = await db
      .select({
        id: workspaceApiKeys.id,
        workspaceId: workspaceApiKeys.workspaceId,
        expiresAt: workspaceApiKeys.expiresAt,
        revokedAt: workspaceApiKeys.revokedAt,
      })
      .from(workspaceApiKeys)
      .where(eq(workspaceApiKeys.keyHash, keyHash))
      .limit(1);

    if (rows.length === 0) {
      return { ok: false };
    }

    const data: ApiKeyVerificationRow = {
      id: rows[0].id,
      workspace_id: rows[0].workspaceId,
      expires_at: rows[0].expiresAt ? String(rows[0].expiresAt) : null,
      revoked_at: rows[0].revokedAt ? String(rows[0].revokedAt) : null,
    };
    return { ok: true, row: data };
  } catch {
    return { ok: false };
  }
}

export async function verifyApiKey(rawApiKey: string): Promise<VerifyApiKeyResult> {
  const hashes = getApiKeyVerificationHashes(rawApiKey);
  const currentHash = hashes[0];
  try {
    for (const keyHash of hashes) {
      const lookup = await verifyApiKeyHashOnce(keyHash);
      if (!lookup.ok) {
        continue;
      }
      const result = validateApiKeyRow(lookup.row);
      if (!result.ok) {
        return result;
      }
      if (keyHash !== currentHash) {
        void upgradeApiKeyHash(String(lookup.row.id), rawApiKey);
      }
      return result;
    }
    console.error(`[${scope}/verifyApiKey] Failed query: not found`);
    return { ok: false, reason: "invalid_api_key" };
  } catch (error) {
    console.error(`[${scope}/verifyApiKey] Unexpected error: ${String(error)}`);
    return { ok: false, reason: "invalid_api_key" };
  }
}
