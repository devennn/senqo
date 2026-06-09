import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { TaskListItem } from "@/types/repositories";
import { RunStatusIndicator } from "@/pages/dashboard/tasks/components/run-status-indicator";
import { TaskViewDialog } from "@/pages/dashboard/tasks/components/task-view-dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Keeps long CRM names / phone targets from stretching the desktop tasks table. */
const TASK_TARGET_COLUMN_MAX_CLASS = "w-[13rem] max-w-[13rem]";

type TasksTableProps = {
  tasks: TaskListItem[];
  cancelTask: (taskId: string) => Promise<void>;
};

function formatSchedule(task: TaskListItem): string {
  if (task.one_time_at) {
    const utcDate = new Date(task.one_time_at);
    if (!Number.isNaN(utcDate.getTime())) {
      return utcDate.toLocaleString();
    }
  }
  return task.timezone ? `One time (${task.timezone})` : "One time";
}

function formatTaskTarget(task: TaskListItem): string {
  if (task.lead_id) {
    const fullName = `${task.lead_contact?.firstName ?? ""} ${task.lead_contact?.lastName ?? ""}`.trim();
    const phone = task.lead_contact?.phone?.trim() ?? "";
    if (fullName && phone) {
      return `${fullName} (${phone})`;
    }
    if (phone) {
      return phone;
    }
    if (fullName) {
      return fullName;
    }
    return "A person (CRM)";
  }
  if (task.daily_contact_limit != null && task.daily_contact_limit > 0) {
    return `Multiple people (CRM, up to ${task.daily_contact_limit}/run)`;
  }
  return "Workspace agent";
}

function canStopTask(task: TaskListItem): boolean {
  if (task.status !== "active") {
    return false;
  }
  if (task.schedule_type === "one_time" && task.last_run_status === "success") {
    return false;
  }
  return true;
}

export function TasksTable({ tasks, cancelTask }: TasksTableProps) {
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);

  async function handleCancel(taskId: string): Promise<void> {
    setCancellingTaskId(taskId);
    try {
      await cancelTask(taskId);
    } finally {
      setCancellingTaskId(null);
    }
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <article key={task.id} className="card-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="line-clamp-2 font-semibold">{task.prompt}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">{task.agent.profile_name}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                One time
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target</dt>
                <dd className="mt-0.5 line-clamp-2 text-muted-foreground">{formatTaskTarget(task)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule</dt>
                <dd className="mt-0.5">{formatSchedule(task)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last run</dt>
                <dd className="mt-1">
                  <RunStatusIndicator
                    scheduleType={task.schedule_type}
                    taskStatus={task.status}
                    recentRuns={task.recent_runs ?? []}
                    lastRunStatus={task.last_run_status}
                  />
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              {!canStopTask(task) ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {task.status === "cancelled" ? "Cancelled" : "Completed"}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancellingTaskId === task.id}
                  onClick={() => void handleCancel(task.id)}
                >
                  Stop
                </Button>
              )}
              <TaskViewDialog task={task} />
            </div>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TASK_TARGET_COLUMN_MAX_CLASS}>Target</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead className="text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const targetLabel = formatTaskTarget(task);
              return (
              <TableRow key={task.id}>
                <TableCell
                  className={cn(TASK_TARGET_COLUMN_MAX_CLASS, "truncate text-muted-foreground")}
                  title={targetLabel}
                >
                  {targetLabel}
                </TableCell>
                <TableCell className="max-w-[340px] truncate">{task.prompt}</TableCell>
                <TableCell>{task.agent.profile_name}</TableCell>
                <TableCell>{formatSchedule(task)}</TableCell>
                <TableCell>One time</TableCell>
                <TableCell>{task.status === "cancelled" ? "Cancelled" : "Active"}</TableCell>
                <TableCell>
                  <RunStatusIndicator
                    scheduleType={task.schedule_type}
                    taskStatus={task.status}
                    recentRuns={task.recent_runs ?? []}
                    lastRunStatus={task.last_run_status}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canStopTask(task) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={cancellingTaskId === task.id}
                        onClick={() => void handleCancel(task.id)}
                      >
                        Stop
                      </Button>
                    ) : null}
                    <TaskViewDialog task={task} />
                  </div>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
