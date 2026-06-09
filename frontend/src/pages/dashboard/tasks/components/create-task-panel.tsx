import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace";
import { useContactOptions } from "@/hooks/useContactOptions";
import { CreateTaskForm } from "@/pages/dashboard/tasks/components/create-task-form";
import type { SchedulableAgentRecord } from "@/types/repositories";

type Props = {
  open: boolean;
  agents: SchedulableAgentRecord[];
  agentsLoading: boolean;
  createTask: (formData: FormData) => Promise<void>;
  onClose: () => void;
};

export function CreateTaskPanel({ open, agents, agentsLoading, createTask, onClose }: Props) {
  const { wsPath } = useWorkspace();
  const { contacts, loading: contactsLoading } = useContactOptions(open);
  const noEligibleAgents = !agentsLoading && agents.length === 0;

  if (!open) return null;

  async function handleCreate(formData: FormData) {
    await createTask(formData);
    onClose();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create task</CardTitle>
        <CardDescription>Set prompt, select agent, and schedule.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {noEligibleAgents ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p>
              Tasks need an authorized WhatsApp connection and at least one agent. Authorize WhatsApp on{" "}
              <Link to={wsPath("/connect")} className="font-medium text-foreground underline underline-offset-2">
                Connect
              </Link>
              , then create or select an agent on{" "}
              <Link to={wsPath("/agent")} className="font-medium text-foreground underline underline-offset-2">
                Agent setup
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={wsPath("/connect")} className={buttonVariants({ size: "sm" })}>
                Go to Connect
              </Link>
              <Link to={wsPath("/agent")} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Go to Agent setup
              </Link>
            </div>
          </div>
        ) : (
          <CreateTaskForm
            agents={agents}
            contacts={contacts}
            contactsLoading={contactsLoading}
            createTask={handleCreate}
            onCancel={onClose}
          />
        )}
        {noEligibleAgents ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
