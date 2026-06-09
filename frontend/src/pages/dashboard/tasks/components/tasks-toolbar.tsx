import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateTaskPanel } from "@/pages/dashboard/tasks/components/create-task-panel";
import type { SchedulableAgentRecord } from "@/types/repositories";

type TasksToolbarProps = {
  search: string;
  agents: SchedulableAgentRecord[];
  agentsLoading: boolean;
  createTask: (formData: FormData) => Promise<void>;
};

export function TasksToolbar({ search, agents, agentsLoading, createTask }: TasksToolbarProps) {
  const { wsPath } = useWorkspace();
  const [formOpen, setFormOpen] = useState(false);
  const hasActiveFilters = search.trim().length > 0;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action="/tasks" method="get" className="flex items-center gap-2">
          <Input
            name="search"
            defaultValue={search}
            placeholder="Search prompt or agent"
            className="h-9 w-44 sm:w-52"
          />
          <Button type="submit" variant="outline" size="sm">
            Apply
          </Button>
          {hasActiveFilters ? (
            <Link to={wsPath("/tasks")} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Reset
            </Link>
          ) : null}
        </form>
        <Button
          type="button"
          size="sm"
          disabled={agentsLoading}
          onClick={() => setFormOpen(true)}
        >
          {agentsLoading ? "Loading…" : "Create task"}
        </Button>
      </div>
      <CreateTaskPanel
        open={formOpen}
        agents={agents}
        agentsLoading={agentsLoading}
        createTask={createTask}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
