import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceAppConnections } from "../db/schema/index.js";

const scope = "WorkspaceAppConnectionsRepository";

export type DriveAccessMode = "entire_drive" | "folder" | "file";

export type WorkspaceAppConnectionRecord = {
  id: string;
  workspace_id: string;
  toolkit: string;
  composio_user_id: string;
  composio_connected_account_id: string;
  status: string;
  drive_access_mode: DriveAccessMode;
  drive_scope_id: string | null;
  drive_scope_name: string | null;
  drive_scope_mime_type: string | null;
  created_at: string;
  updated_at: string;
};

function parseAccessMode(value: unknown): DriveAccessMode {
  if (value === "folder" || value === "file" || value === "entire_drive") {
    return value;
  }
  return "entire_drive";
}

function mapRow(
  row: typeof workspaceAppConnections.$inferSelect,
): WorkspaceAppConnectionRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    toolkit: row.toolkit,
    composio_user_id: row.composioUserId,
    composio_connected_account_id: row.composioConnectedAccountId,
    status: row.status,
    drive_access_mode: parseAccessMode(row.driveAccessMode),
    drive_scope_id: row.driveScopeId,
    drive_scope_name: row.driveScopeName,
    drive_scope_mime_type: row.driveScopeMimeType,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updated_at:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export async function getWorkspaceAppConnection(
  workspaceId: string,
  toolkit: string,
): Promise<WorkspaceAppConnectionRecord | null> {
  try {
    const rows = await db
      .select()
      .from(workspaceAppConnections)
      .where(
        and(
          eq(workspaceAppConnections.workspaceId, workspaceId),
          eq(workspaceAppConnections.toolkit, toolkit),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      console.info(
        `[${scope}/getWorkspaceAppConnection] Failed query: not found workspaceId=${workspaceId} toolkit=${toolkit}`,
      );
      return null;
    }
    console.info(
      `[${scope}/getWorkspaceAppConnection] Success: workspaceId=${workspaceId} toolkit=${toolkit}`,
    );
    return mapRow(rows[0]);
  } catch (error) {
    console.error(
      `[${scope}/getWorkspaceAppConnection] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function listWorkspaceAppConnections(
  workspaceId: string,
): Promise<WorkspaceAppConnectionRecord[]> {
  try {
    const rows = await db
      .select()
      .from(workspaceAppConnections)
      .where(eq(workspaceAppConnections.workspaceId, workspaceId));
    console.info(
      `[${scope}/listWorkspaceAppConnections] Success: workspaceId=${workspaceId} count=${rows.length}`,
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error(
      `[${scope}/listWorkspaceAppConnections] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function upsertWorkspaceAppConnection(input: {
  workspaceId: string;
  toolkit: string;
  composioUserId: string;
  composioConnectedAccountId: string;
  status?: string;
}): Promise<{ ok: true; record: WorkspaceAppConnectionRecord } | { ok: false; message: string }> {
  try {
    const existing = await getWorkspaceAppConnection(input.workspaceId, input.toolkit);
    if (existing) {
      const rows = await db
        .update(workspaceAppConnections)
        .set({
          composioUserId: input.composioUserId,
          composioConnectedAccountId: input.composioConnectedAccountId,
          status: input.status ?? "active",
          updatedAt: new Date(),
        })
        .where(eq(workspaceAppConnections.id, existing.id))
        .returning();
      console.info(
        `[${scope}/upsertWorkspaceAppConnection] Success: updated id=${existing.id}`,
      );
      return { ok: true, record: mapRow(rows[0]) };
    }
    const rows = await db
      .insert(workspaceAppConnections)
      .values({
        workspaceId: input.workspaceId,
        toolkit: input.toolkit,
        composioUserId: input.composioUserId,
        composioConnectedAccountId: input.composioConnectedAccountId,
        status: input.status ?? "active",
        driveAccessMode: "entire_drive",
      })
      .returning();
    console.info(
      `[${scope}/upsertWorkspaceAppConnection] Success: created id=${rows[0].id}`,
    );
    return { ok: true, record: mapRow(rows[0]) };
  } catch (error) {
    console.error(
      `[${scope}/upsertWorkspaceAppConnection] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Failed to save app connection" };
  }
}

export async function updateWorkspaceDriveAccessScope(input: {
  workspaceId: string;
  toolkit: string;
  accessMode: DriveAccessMode;
  scopeId?: string | null;
  scopeName?: string | null;
  scopeMimeType?: string | null;
}): Promise<
  { ok: true; record: WorkspaceAppConnectionRecord } | { ok: false; message: string }
> {
  try {
    if (input.accessMode !== "entire_drive" && !input.scopeId?.trim()) {
      return {
        ok: false,
        message: "Pick a folder or file to limit access",
      };
    }
    const rows = await db
      .update(workspaceAppConnections)
      .set({
        driveAccessMode: input.accessMode,
        driveScopeId:
          input.accessMode === "entire_drive"
            ? null
            : input.scopeId?.trim() || null,
        driveScopeName:
          input.accessMode === "entire_drive"
            ? null
            : input.scopeName?.trim() || null,
        driveScopeMimeType:
          input.accessMode === "entire_drive"
            ? null
            : input.scopeMimeType?.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceAppConnections.workspaceId, input.workspaceId),
          eq(workspaceAppConnections.toolkit, input.toolkit),
          eq(workspaceAppConnections.status, "active"),
        ),
      )
      .returning();
    if (rows.length === 0) {
      return { ok: false, message: "Active Drive connection not found" };
    }
    console.info(
      `[${scope}/updateWorkspaceDriveAccessScope] Success: mode=${input.accessMode}`,
    );
    return { ok: true, record: mapRow(rows[0]) };
  } catch (error) {
    console.error(
      `[${scope}/updateWorkspaceDriveAccessScope] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Failed to update Drive access" };
  }
}

export async function disconnectWorkspaceAppConnection(
  workspaceId: string,
  toolkit: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db
      .update(workspaceAppConnections)
      .set({
        status: "disconnected",
        driveAccessMode: "entire_drive",
        driveScopeId: null,
        driveScopeName: null,
        driveScopeMimeType: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceAppConnections.workspaceId, workspaceId),
          eq(workspaceAppConnections.toolkit, toolkit),
        ),
      )
      .returning({ id: workspaceAppConnections.id });
    if (rows.length === 0) {
      console.info(
        `[${scope}/disconnectWorkspaceAppConnection] Failed query: not found`,
      );
      return { ok: false, message: "Connection not found" };
    }
    console.info(
      `[${scope}/disconnectWorkspaceAppConnection] Success: workspaceId=${workspaceId} toolkit=${toolkit}`,
    );
    return { ok: true, message: "Disconnected" };
  } catch (error) {
    console.error(
      `[${scope}/disconnectWorkspaceAppConnection] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Failed to disconnect" };
  }
}
