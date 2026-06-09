import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TaskListItem } from "@/types/repositories";

function resolveTarget(task: TaskListItem): string {
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

function resolveScheduleDetail(task: TaskListItem): string {
  if (task.schedule_type === "one_time") {
    if (!task.one_time_at) {
      return "One-time (datetime not set)";
    }
    const dt = new Date(task.one_time_at);
    return Number.isNaN(dt.getTime()) ? task.one_time_at : dt.toLocaleString();
  }
  if (task.cron_expression) {
    return `${task.cron_expression} (${task.timezone})`;
  }
  return `Recurring (${task.timezone})`;
}

export function TaskViewDialog({ task }: { task: TaskListItem }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>View task</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Task setup</DialogTitle>
          <DialogDescription>Read-only configuration snapshot for this task.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div>
            <p className="text-xs font-bold text-foreground">Target</p>
            <p>{resolveTarget(task)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Prompt</p>
            <p className="whitespace-pre-wrap">{task.prompt}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-foreground">Agent</p>
              <p>{task.agent.profile_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Type</p>
              <p>{task.schedule_type === "recurring" ? "Recurring" : "One time"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Schedule</p>
              <p>{resolveScheduleDetail(task)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Source</p>
              <p>{task.source}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Created</p>
              <p>{new Date(task.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Daily limit</p>
              <p>{task.daily_contact_limit ?? "-"}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">File URL</p>
            <p className="break-all">{task.file_url ?? "-"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
