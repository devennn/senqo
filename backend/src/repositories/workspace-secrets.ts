import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceSecrets } from "../db/schema/index.js";
import {
  decryptWorkspaceSecret,
  encryptWorkspaceSecret,
} from "../lib/workspace-secrets-crypto.js";
import type { WorkspaceSecretListItem, WorkspaceSecretRecord } from "../types/repositories.js";

const scope = "WorkspaceSecretsRepository";

const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]*$/;

function toRecord(row: typeof workspaceSecrets.$inferSelect): WorkspaceSecretRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    name: row.name,
    description: row.description,
    ciphertext: row.ciphertext,
    iv: row.iv,
    tag: row.tag,
    value_hint: row.valueHint,
    created_at:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export function normalizeSecretName(name: string): string | null {
  const trimmed = name.trim().toUpperCase();
  if (!SECRET_NAME_RE.test(trimmed)) return null;
  return trimmed;
}

export async function listWorkspaceSecrets(
  workspaceId: string,
): Promise<WorkspaceSecretListItem[]> {
  try {
    const rows = await db
      .select({
        id: workspaceSecrets.id,
        name: workspaceSecrets.name,
        description: workspaceSecrets.description,
        value_hint: workspaceSecrets.valueHint,
        created_at: workspaceSecrets.createdAt,
        updated_at: workspaceSecrets.updatedAt,
      })
      .from(workspaceSecrets)
      .where(eq(workspaceSecrets.workspaceId, workspaceId))
      .orderBy(asc(workspaceSecrets.name));
    console.info(`[${scope}/listWorkspaceSecrets] Success: workspaceId=${workspaceId}`);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      value_hint: row.value_hint,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    }));
  } catch (error) {
    console.error(`[${scope}/listWorkspaceSecrets] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getWorkspaceSecretById(
  workspaceId: string,
  secretId: string,
): Promise<WorkspaceSecretRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(workspaceSecrets)
      .where(
        and(eq(workspaceSecrets.workspaceId, workspaceId), eq(workspaceSecrets.id, secretId)),
      );
    if (!row) {
      console.info(`[${scope}/getWorkspaceSecretById] Success: not found workspaceId=${workspaceId}`);
      return null;
    }
    console.info(`[${scope}/getWorkspaceSecretById] Success: workspaceId=${workspaceId}`);
    return toRecord(row);
  } catch (error) {
    console.error(`[${scope}/getWorkspaceSecretById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getWorkspaceSecretByName(
  workspaceId: string,
  name: string,
): Promise<WorkspaceSecretRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(workspaceSecrets)
      .where(
        and(eq(workspaceSecrets.workspaceId, workspaceId), eq(workspaceSecrets.name, name)),
      );
    if (!row) return null;
    console.info(`[${scope}/getWorkspaceSecretByName] Success: workspaceId=${workspaceId}`);
    return toRecord(row);
  } catch (error) {
    console.error(`[${scope}/getWorkspaceSecretByName] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function decryptWorkspaceSecretValue(
  record: WorkspaceSecretRecord,
): Promise<string | null> {
  try {
    const value = decryptWorkspaceSecret({
      ciphertext: record.ciphertext,
      iv: record.iv,
      tag: record.tag,
    });
    console.info(`[${scope}/decryptWorkspaceSecretValue] Success: workspaceId=${record.workspace_id}`);
    return value;
  } catch (error) {
    console.error(`[${scope}/decryptWorkspaceSecretValue] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createWorkspaceSecret(input: {
  workspaceId: string;
  name: string;
  description: string;
  value: string;
}): Promise<{ ok: boolean; message: string; secretId: string | null }> {
  const normalizedName = normalizeSecretName(input.name);
  if (!normalizedName) {
    console.error(`[${scope}/createWorkspaceSecret] Failed query: invalid name`);
    return { ok: false, message: "Invalid secret name", secretId: null };
  }
  if (!input.value.trim()) {
    console.error(`[${scope}/createWorkspaceSecret] Failed query: empty value`);
    return { ok: false, message: "Secret value required", secretId: null };
  }
  try {
    const encrypted = encryptWorkspaceSecret(input.value);
    const [inserted] = await db
      .insert(workspaceSecrets)
      .values({
        workspaceId: input.workspaceId,
        name: normalizedName,
        description: input.description.trim(),
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        valueHint: encrypted.valueHint,
      })
      .returning({ id: workspaceSecrets.id });
    console.info(`[${scope}/createWorkspaceSecret] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Secret created", secretId: inserted.id };
  } catch (error) {
    if (String(error).includes("workspace_secrets_workspace_id_name_unique")) {
      console.error(`[${scope}/createWorkspaceSecret] Failed query: duplicate name`);
      return { ok: false, message: "Secret name already exists", secretId: null };
    }
    console.error(`[${scope}/createWorkspaceSecret] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", secretId: null };
  }
}

export async function updateWorkspaceSecretValue(input: {
  workspaceId: string;
  secretId: string;
  description?: string;
  value: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!input.value.trim()) {
    console.error(`[${scope}/updateWorkspaceSecretValue] Failed query: empty value`);
    return { ok: false, message: "Secret value required" };
  }
  try {
    const current = await getWorkspaceSecretById(input.workspaceId, input.secretId);
    if (!current) {
      return { ok: false, message: "Secret not found" };
    }
    const encrypted = encryptWorkspaceSecret(input.value);
    await db
      .update(workspaceSecrets)
      .set({
        description: input.description ?? current.description,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        valueHint: encrypted.valueHint,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceSecrets.workspaceId, input.workspaceId),
          eq(workspaceSecrets.id, input.secretId),
        ),
      );
    console.info(`[${scope}/updateWorkspaceSecretValue] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Secret updated" };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceSecretValue] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceSecret(input: {
  workspaceId: string;
  secretId: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const deleted = await db
      .delete(workspaceSecrets)
      .where(
        and(
          eq(workspaceSecrets.workspaceId, input.workspaceId),
          eq(workspaceSecrets.id, input.secretId),
        ),
      )
      .returning({ id: workspaceSecrets.id });
    if (deleted.length === 0) {
      console.error(`[${scope}/deleteWorkspaceSecret] Failed query: not found`);
      return { ok: false, message: "Secret not found" };
    }
    console.info(`[${scope}/deleteWorkspaceSecret] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Secret deleted" };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceSecret] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function listWorkspaceSecretNames(
  workspaceId: string,
): Promise<Set<string>> {
  const rows = await listWorkspaceSecrets(workspaceId);
  return new Set(rows.map((row) => row.name));
}
