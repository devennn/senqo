import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localDateTimeInputValueToIsoUtc } from "@/lib/datetime";
import { TaskLinkFields } from "@/pages/dashboard/tasks/components/task-link-fields";
import { TaskScheduleFields } from "@/pages/dashboard/tasks/components/task-schedule-fields";
import type { SchedulableAgentRecord, TaskFormContactOption } from "@/types/repositories";

type Props = {
  agents: SchedulableAgentRecord[];
  contacts: TaskFormContactOption[];
  contactsLoading?: boolean;
  createTask: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
};

export function CreateTaskForm({ agents, contacts, contactsLoading = false, createTask, onCancel }: Props) {
  const defaultAgentId = agents[0]?.id ?? "";
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [connectionId, setConnectionId] = useState("");

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? agents[0] ?? null,
    [agents, agentId],
  );
  const agentConnections = selectedAgent?.connections ?? [];
  const needsConnectionPick = agentConnections.length > 1;
  const singleConnectionId = agentConnections.length === 1 ? agentConnections[0].id : "";
  const effectiveConnectionId = needsConnectionPick ? connectionId : singleConnectionId;
  const canSubmit = agents.length > 0 && (!needsConnectionPick || connectionId.length > 0);

  function handleAgentChange(nextAgentId: string) {
    setAgentId(nextAgentId);
    setConnectionId("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const localField = form.querySelector<HTMLInputElement>("#oneTimeAtLocal");
    const utcField = form.elements.namedItem("oneTimeAt") as HTMLInputElement | null;
    if (!localField || !utcField) return;
    const isoUtc = localDateTimeInputValueToIsoUtc(localField.value);
    if (!isoUtc) { event.preventDefault(); return; }
    utcField.value = isoUtc;
  }

  return (
    <form
      onSubmit={(e) => { handleSubmit(e); if (!e.defaultPrevented) { e.preventDefault(); void createTask(new FormData(e.currentTarget)); } }}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea id="prompt" name="prompt" required placeholder="Instructions for the agent, or the exact WhatsApp text for batch outreach to new leads." />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="fileUrl">Public file URL (optional)</Label>
        <Input id="fileUrl" name="fileUrl" type="url" placeholder="https://example.com/brochure.pdf" />
        <p className="text-xs text-muted-foreground">If set, WhatsApp sends this file URL together with the outreach message.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="agentId">AI Agent</Label>
        <select
          id="agentId"
          name="agentId"
          value={agentId}
          required
          onChange={(event) => handleAgentChange(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {agents.map((a) => <option key={a.id} value={a.id}>{a.profile_name}</option>)}
        </select>
      </div>
      {needsConnectionPick ? (
        <div className="grid gap-2">
          <Label htmlFor="whatsappConnectionId">WhatsApp connection</Label>
          <select
            id="whatsappConnectionId"
            name="whatsappConnectionId"
            value={connectionId}
            required
            onChange={(event) => setConnectionId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a connection</option>
            {agentConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.display_name}
                {connection.phone_number ? ` (${connection.phone_number})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : effectiveConnectionId ? (
        <input type="hidden" name="whatsappConnectionId" value={effectiveConnectionId} />
      ) : null}
      <TaskLinkFields contacts={contacts} contactsLoading={contactsLoading} />
      <TaskScheduleFields />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
          Create task
        </Button>
      </div>
    </form>
  );
}
