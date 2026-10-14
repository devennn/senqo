import { cancelScheduledTask } from "./job-scheduler.js";
import {
  cancelAndDetachTasksByConnection,
  listTasksForConnectionCleanup,
} from "../repositories/tasks.js";
import { deleteConnectionByWorkspace } from "../repositories/whatsapp.js";

const scope = "ConnectionDelete";

/**
 * Deletes a workspace connection row without being blocked by the tasks FK
 * (`tasks.whatsapp_connection_id` uses ON DELETE RESTRICT):
 * stops the pending pg-boss jobs of non-cancelled tasks bound to the connection,
 * cancels + detaches those task rows, then deletes the connection.
 */
export async function deleteConnectionWithTasks(
  workspaceId: string,
  connectionId: string,
): Promise<{ ok: boolean; deleted: boolean }> {
  const tasks = await listTasksForConnectionCleanup(workspaceId, connectionId);
  for (const task of tasks) {
    await cancelScheduledTask(task.jobPayload);
  }

  const cleaned = await cancelAndDetachTasksByConnection(workspaceId, connectionId);
  if (!cleaned.ok) {
    console.error(
      `[${scope}/deleteConnectionWithTasks] Failed query: task cleanup failed workspaceId=${workspaceId} connectionId=${connectionId}`,
    );
    return { ok: false, deleted: false };
  }

  const deleted = await deleteConnectionByWorkspace(workspaceId, connectionId);
  if (!deleted.ok) {
    console.error(
      `[${scope}/deleteConnectionWithTasks] Failed query: ${deleted.message} workspaceId=${workspaceId} connectionId=${connectionId}`,
    );
    return { ok: false, deleted: false };
  }

  console.info(
    `[${scope}/deleteConnectionWithTasks] Success: workspaceId=${workspaceId} connectionId=${connectionId} cancelledTasks=${cleaned.cancelled}`,
  );
  return { ok: true, deleted: deleted.deleted };
}
