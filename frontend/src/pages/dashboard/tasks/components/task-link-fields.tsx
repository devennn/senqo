import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskFormContactOption } from "@/types/repositories";

type TaskLinkMode = "single_contact" | "contactless" | "tools_source";

type TaskLinkFieldsProps = {
  contacts: TaskFormContactOption[];
  contactsLoading?: boolean;
};

export function TaskLinkFields({ contacts, contactsLoading = false }: TaskLinkFieldsProps) {
  const [taskLinkMode, setTaskLinkMode] = useState<TaskLinkMode>("contactless");

  useEffect(() => {
    if (!contactsLoading && contacts.length > 0) {
      setTaskLinkMode("single_contact");
    }
  }, [contacts.length, contactsLoading]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="taskLinkMode">Who to reach</Label>
          <span className="group relative inline-flex">
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-input text-[10px] text-muted-foreground"
              aria-label="Who to reach notes"
            >
              i
            </button>
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-input bg-background p-2 text-[11px] leading-4 text-foreground shadow-md group-hover:block group-focus-within:block">
              Notes: CRM options use saved CRM people only. &quot;Other - via tools&quot;
              assumes the agent has a tool to fetch contacts from other sources. If no such
              tool exists, the run may fail.
            </span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          CRM = people in your CRM list below. Other = agent uses its tools, not this picker.
        </p>
        <select
          id="taskLinkMode"
          name="taskLinkMode"
          value={taskLinkMode}
          onChange={(event) => setTaskLinkMode(event.target.value as TaskLinkMode)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="single_contact" disabled={contacts.length === 0 && !contactsLoading}>
            A person (CRM)
          </option>
          <option value="contactless">Multiple people (CRM)</option>
          <option value="tools_source">Other — via tools</option>
        </select>
      </div>

      {taskLinkMode === "single_contact" ? (
        <div className="grid gap-2">
          <Label htmlFor="contactId">Person (CRM)</Label>
          <p className="text-xs text-muted-foreground">
            Choose contact you want to reach out.
          </p>
          <select
            id="contactId"
            name="contactId"
            required={contacts.length > 0}
            defaultValue=""
            disabled={contactsLoading}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="">
              {contactsLoading
                ? "Loading contacts…"
                : contacts.length === 0
                  ? "Add contacts in CRM first"
                  : "Select a contact"}
            </option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {taskLinkMode === "contactless" ? (
        <div className="grid gap-2">
          <input type="hidden" name="contactId" value="" />
          <Label htmlFor="dailyContactLimit">Daily outreach limit (optional)</Label>
          <p className="text-xs text-muted-foreground">
            If set (1–100), each run messages up to that many CRM leads in status &quot;new&quot; (with
            a phone), using this prompt as the WhatsApp body. Leave empty for agent-only (no auto
            sends).
          </p>
          <Input
            id="dailyContactLimit"
            name="dailyContactLimit"
            type="number"
            min={1}
            max={100}
            placeholder="e.g. 30 — leave empty for agent-only"
            className="max-w-xs"
          />
        </div>
      ) : null}

      {taskLinkMode === "tools_source" ? (
        <div className="grid gap-2">
          <input type="hidden" name="contactId" value="" />
          <p className="text-xs text-muted-foreground">
            Each run starts a workspace agent turn with your prompt. Who to contact comes from tool
            calls (e.g. WhatsApp send), not the CRM fields above.
          </p>
          <p className="text-xs text-muted-foreground">
            Assumption: the agent has at least one tool that can fetch contacts from another source.
            If no tool can do that, this mode can fail at runtime.
          </p>
        </div>
      ) : null}
    </div>
  );
}
