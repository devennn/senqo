import { eq, asc, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceSkillDefinitions } from "../db/schema/index.js";
import { storageUpload, storageDownload, storageRemove } from "../lib/storage.js";
import type { WorkspaceSkillDefinitionRecord } from "../types/repositories.js";

const scope = "SkillsRepository";

function normalizeSkillKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getStoragePath(workspaceId: string, skillKey: string): string {
  return `${workspaceId}/${skillKey}.md`;
}

function toRecord(
  row: typeof workspaceSkillDefinitions.$inferSelect,
): WorkspaceSkillDefinitionRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    skill_key: row.skillKey,
    display_name: row.displayName,
    description: row.description,
    storage_path: row.storagePath,
    is_active: row.isActive,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export async function listWorkspaceSkills(
  workspaceId: string,
): Promise<WorkspaceSkillDefinitionRecord[]> {
  try {
    const rows = await db
      .select()
      .from(workspaceSkillDefinitions)
      .where(eq(workspaceSkillDefinitions.workspaceId, workspaceId))
      .orderBy(asc(workspaceSkillDefinitions.displayName));
    console.info(`[${scope}/listWorkspaceSkills] Success: userId=${workspaceId}`);
    return rows.map(toRecord);
  } catch (error) {
    console.error(`[${scope}/listWorkspaceSkills] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function listActiveWorkspaceSkills(
  workspaceId: string,
): Promise<WorkspaceSkillDefinitionRecord[]> {
  try {
    const rows = await db
      .select()
      .from(workspaceSkillDefinitions)
      .where(
        and(
          eq(workspaceSkillDefinitions.workspaceId, workspaceId),
          eq(workspaceSkillDefinitions.isActive, true),
        ),
      )
      .orderBy(asc(workspaceSkillDefinitions.displayName));
    console.info(`[${scope}/listActiveWorkspaceSkills] Success: userId=${workspaceId}`);
    return rows.map(toRecord);
  } catch (error) {
    console.error(`[${scope}/listActiveWorkspaceSkills] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getWorkspaceSkillById(
  workspaceId: string,
  skillId: string,
): Promise<WorkspaceSkillDefinitionRecord | null> {
  try {
    const rows = await db
      .select()
      .from(workspaceSkillDefinitions)
      .where(
        and(
          eq(workspaceSkillDefinitions.workspaceId, workspaceId),
          eq(workspaceSkillDefinitions.id, skillId),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      console.error(`[${scope}/getWorkspaceSkillById] Failed query: skill not found`);
      return null;
    }
    console.info(`[${scope}/getWorkspaceSkillById] Success: userId=${workspaceId}`);
    return toRecord(rows[0]);
  } catch (error) {
    console.error(`[${scope}/getWorkspaceSkillById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function findWorkspaceSkillByNameOrKey(
  workspaceId: string,
  skillName: string,
): Promise<WorkspaceSkillDefinitionRecord | null> {
  const normalizedInput = normalizeSkillKey(skillName);
  try {
    const rows = await db
      .select()
      .from(workspaceSkillDefinitions)
      .where(
        and(
          eq(workspaceSkillDefinitions.workspaceId, workspaceId),
          eq(workspaceSkillDefinitions.isActive, true),
        ),
      );
    const matched = rows.find((skill) => {
      const skillKey = String(skill.skillKey ?? "");
      const displayName = String(skill.displayName ?? "");
      return (
        normalizeSkillKey(skillKey) === normalizedInput ||
        normalizeSkillKey(displayName) === normalizedInput
      );
    });
    if (!matched) {
      console.error(`[${scope}/findWorkspaceSkillByNameOrKey] Failed query: skill not found`);
      return null;
    }
    console.info(`[${scope}/findWorkspaceSkillByNameOrKey] Success: userId=${workspaceId}`);
    return toRecord(matched);
  } catch (error) {
    console.error(`[${scope}/findWorkspaceSkillByNameOrKey] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function readWorkspaceSkillContent(
  workspaceId: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const data = await storageDownload("agent-skills", storagePath);
    if (!data) {
      console.error(
        `[${scope}/readWorkspaceSkillContent] Failed query: file not found`,
      );
      return null;
    }
    const content = new TextDecoder().decode(data);
    console.info(`[${scope}/readWorkspaceSkillContent] Success: userId=${workspaceId}`);
    return content;
  } catch (error) {
    console.error(`[${scope}/readWorkspaceSkillContent] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createWorkspaceSkill(input: {
  workspaceId: string;
  displayName: string;
  description: string;
  content: string;
}): Promise<{ ok: boolean; message: string; skillId: string | null }> {
  const skillKey = normalizeSkillKey(input.displayName);
  if (!skillKey) {
    console.error(`[${scope}/createWorkspaceSkill] Failed query: invalid skill key`);
    return { ok: false, message: "Invalid skill name", skillId: null };
  }
  const storagePath = getStoragePath(input.workspaceId, skillKey);
  try {
    const { error: uploadError } = await storageUpload(
      "agent-skills",
      storagePath,
      input.content,
      "text/markdown",
    );
    if (uploadError) {
      console.error(`[${scope}/createWorkspaceSkill] Failed query: ${uploadError}`);
      return { ok: false, message: uploadError, skillId: null };
    }

    const [inserted] = await db
      .insert(workspaceSkillDefinitions)
      .values({
        workspaceId: input.workspaceId,
        skillKey: skillKey,
        displayName: input.displayName.trim(),
        description: input.description.trim(),
        storagePath: storagePath,
        isActive: true,
      })
      .returning({ id: workspaceSkillDefinitions.id });
    console.info(`[${scope}/createWorkspaceSkill] Success: userId=${input.workspaceId}`);
    return { ok: true, message: "Skill created", skillId: inserted.id };
  } catch (error) {
    console.error(`[${scope}/createWorkspaceSkill] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", skillId: null };
  }
}

export async function updateWorkspaceSkill(input: {
  workspaceId: string;
  skillId: string;
  displayName: string;
  description: string;
  content: string;
  isActive: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const skillKey = normalizeSkillKey(input.displayName);
  if (!skillKey) {
    console.error(`[${scope}/updateWorkspaceSkill] Failed query: invalid skill key`);
    return { ok: false, message: "Invalid skill name" };
  }
  const newStoragePath = getStoragePath(input.workspaceId, skillKey);
  try {
    const current = await getWorkspaceSkillById(input.workspaceId, input.skillId);
    if (!current) {
      return { ok: false, message: "Skill not found" };
    }

    const { error: uploadError } = await storageUpload(
      "agent-skills",
      newStoragePath,
      input.content,
      "text/markdown",
    );
    if (uploadError) {
      console.error(`[${scope}/updateWorkspaceSkill] Failed query: ${uploadError}`);
      return { ok: false, message: uploadError };
    }

    if (current.storage_path !== newStoragePath) {
      await storageRemove("agent-skills", [current.storage_path]);
    }

    await db
      .update(workspaceSkillDefinitions)
      .set({
        skillKey: skillKey,
        displayName: input.displayName.trim(),
        description: input.description.trim(),
        storagePath: newStoragePath,
        isActive: input.isActive,
      })
      .where(
        and(
          eq(workspaceSkillDefinitions.workspaceId, input.workspaceId),
          eq(workspaceSkillDefinitions.id, input.skillId),
        ),
      );

    console.info(`[${scope}/updateWorkspaceSkill] Success: userId=${input.workspaceId}`);
    return { ok: true, message: "Skill updated" };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceSkill] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceSkill(input: {
  workspaceId: string;
  skillId: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const current = await getWorkspaceSkillById(input.workspaceId, input.skillId);
    if (!current) {
      return { ok: false, message: "Skill not found" };
    }

    await db
      .delete(workspaceSkillDefinitions)
      .where(
        and(
          eq(workspaceSkillDefinitions.workspaceId, input.workspaceId),
          eq(workspaceSkillDefinitions.id, input.skillId),
        ),
      );

    const { error: storageError } = await storageRemove("agent-skills", [current.storage_path]);
    if (storageError) {
      console.error(`[${scope}/deleteWorkspaceSkill] Failed query: ${storageError}`);
      return { ok: false, message: storageError };
    }

    console.info(`[${scope}/deleteWorkspaceSkill] Success: userId=${input.workspaceId}`);
    return { ok: true, message: "Skill deleted" };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceSkill] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}