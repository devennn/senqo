import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListTasksForConnectionCleanup = vi.fn();
const mockCancelAndDetachTasksByConnection = vi.fn();
const mockDeleteConnectionByWorkspace = vi.fn();
const mockCancelScheduledTask = vi.fn();

vi.mock("../repositories/tasks.js", () => ({
  listTasksForConnectionCleanup: mockListTasksForConnectionCleanup,
  cancelAndDetachTasksByConnection: mockCancelAndDetachTasksByConnection,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  deleteConnectionByWorkspace: mockDeleteConnectionByWorkspace,
}));

vi.mock("./job-scheduler.js", () => ({
  cancelScheduledTask: mockCancelScheduledTask,
}));

const { deleteConnectionWithTasks } = await import("./connection-delete.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockListTasksForConnectionCleanup.mockResolvedValue([]);
  mockCancelAndDetachTasksByConnection.mockResolvedValue({ ok: true, cancelled: 0 });
  mockDeleteConnectionByWorkspace.mockResolvedValue({
    ok: true,
    message: "Connection deleted",
    deleted: true,
  });
  mockCancelScheduledTask.mockResolvedValue(undefined);
});

describe("deleteConnectionWithTasks", () => {
  // Happy path: every non-cancelled task bound to the connection loses its pending pg-boss job,
  // then the task rows are cancelled/detached and the connection row is deleted.
  it("stops pending jobs, cleans task rows, then deletes the connection", async () => {
    mockListTasksForConnectionCleanup.mockResolvedValue([
      { id: "task-1", jobPayload: { jobId: "job-1", queue: "task-execute" } },
      { id: "task-2", jobPayload: { jobId: "job-2", queue: "task-execute" } },
    ]);

    const result = await deleteConnectionWithTasks("ws-1", "conn-1");

    expect(mockCancelScheduledTask).toHaveBeenCalledWith({ jobId: "job-1", queue: "task-execute" });
    expect(mockCancelScheduledTask).toHaveBeenCalledWith({ jobId: "job-2", queue: "task-execute" });
    expect(mockCancelAndDetachTasksByConnection).toHaveBeenCalledWith("ws-1", "conn-1");
    expect(mockDeleteConnectionByWorkspace).toHaveBeenCalledWith("ws-1", "conn-1");
    expect(result).toEqual({ ok: true, deleted: true });
  });

  // Connections without tasks still delete normally — the FK-cleaning step must be a no-op.
  it("deletes a connection with no bound tasks", async () => {
    const result = await deleteConnectionWithTasks("ws-1", "conn-1");

    expect(mockCancelScheduledTask).not.toHaveBeenCalled();
    expect(mockCancelAndDetachTasksByConnection).toHaveBeenCalledWith("ws-1", "conn-1");
    expect(result).toEqual({ ok: true, deleted: true });
  });

  // Error path: if the task cleanup fails, the connection delete must not be attempted (the FK would reject it anyway).
  it("returns ok:false and skips the delete when task cleanup fails", async () => {
    mockCancelAndDetachTasksByConnection.mockResolvedValue({ ok: false, cancelled: 0 });

    const result = await deleteConnectionWithTasks("ws-1", "conn-1");

    expect(mockDeleteConnectionByWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, deleted: false });
  });

  // Error path: a failed delete surfaces as ok:false so the route can answer connection_delete_failed.
  it("returns ok:false when the connection delete itself fails", async () => {
    mockDeleteConnectionByWorkspace.mockResolvedValue({
      ok: false,
      message: "Unexpected error",
      deleted: false,
    });

    const result = await deleteConnectionWithTasks("ws-1", "conn-1");

    expect(result).toEqual({ ok: false, deleted: false });
  });

  // A row that vanished between checks (deleted elsewhere) must surface deleted:false, not an error.
  it("passes through deleted:false when the row no longer exists", async () => {
    mockDeleteConnectionByWorkspace.mockResolvedValue({
      ok: true,
      message: "Connection not found",
      deleted: false,
    });

    const result = await deleteConnectionWithTasks("ws-1", "conn-1");

    expect(result).toEqual({ ok: true, deleted: false });
  });
});
