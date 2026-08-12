import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentKnowledgeImportPanel } from "@/pages/dashboard/components/agent-knowledge-import-panel";
import { useAgentKnowledgeImportJobs } from "@/hooks/useAgentKnowledgeImportJobs";
import type { AgentConfigRecord } from "@/types/repositories";

type Props = {
  agents: AgentConfigRecord[];
  onApplied?: () => void;
};

export function KnowledgeImportDocsButton({ agents, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const selected = agents.find((a) => a.id === agentId) ?? agents[0] ?? null;
  const { activeJob, refresh } = useAgentKnowledgeImportJobs(open ? selected?.id ?? null : null);

  async function handleOpen() {
    if (!agents.length) return;
    const nextId = agentId && agents.some((a) => a.id === agentId) ? agentId : agents[0].id;
    setAgentId(nextId);
    setOpen(true);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => void handleOpen()} disabled={agents.length === 0}>
        Import docs
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) void refresh();
          setOpen(next);
        }}
      >
        <DialogContent
          className="flex max-h-[min(92vh,52rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
          showCloseButton
        >
          <DialogHeader className="shrink-0 space-y-3 border-b border-border px-6 py-4 pr-12">
            <DialogTitle>Import docs</DialogTitle>
            <DialogDescription>
              Draft context, skills, and templates, then attach them to the selected agent.
            </DialogDescription>
            {agents.length > 0 ? (
              <label className="block space-y-1.5 text-sm text-foreground">
                <span className="font-medium">Attach to agent</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  value={selected?.id ?? ""}
                  onChange={(e) => setAgentId(e.target.value)}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.profile_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {open && selected ? (
              <AgentKnowledgeImportPanel
                key={selected.id}
                agentId={selected.id}
                profileName={selected.profile_name}
                resumeJobId={activeJob?.id ?? null}
                onApplied={() => {
                  void refresh();
                  onApplied?.();
                }}
                onCleared={() => void refresh()}
                onJobStarted={() => void refresh()}
                onDone={() => setOpen(false)}
                onRunInBackground={() => setOpen(false)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
