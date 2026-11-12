import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import type { AgentConfigRecord, WorkspaceButtonTemplateGroupSummary } from "@/types/repositories";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { agentsUsingKnowledgeGroup } from "@/lib/knowledge-used-by";
import { ButtonTemplateCreateGroupForm } from "@/pages/dashboard/components/button-template-create-group-form";
import { ButtonTemplatesSidebar } from "@/pages/dashboard/components/button-templates-sidebar";
import { ButtonTemplateGroupEditor } from "@/pages/dashboard/components/button-template-group-editor";

type Props = {
  groups: WorkspaceButtonTemplateGroupSummary[];
  agents: AgentConfigRecord[];
  reload: () => Promise<void>;
  agentId: string | undefined;
  refreshKey?: number;
};

export function ButtonTemplatesPanel({ groups, agents, reload, agentId, refreshKey = 0 }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  function buttonsPanelHref(id: string | undefined, buttonGroupId: string): string {
    const params = new URLSearchParams();
    params.set("tab", "buttons");
    if (id) params.set("agentId", id);
    params.set("buttonGroupId", buttonGroupId);
    return `${wsPath("/knowledge")}?${params.toString()}`;
  }

  const urlGroupId = searchParams.get("buttonGroupId") ?? undefined;

  const canonicalGroupId = useMemo(() => {
    if (!urlGroupId) return undefined;
    return groups.some((g) => g.id === urlGroupId) ? urlGroupId : undefined;
  }, [groups, urlGroupId]);

  const firstGroupId = groups[0]?.id;

  const groupHref = useMemo(
    () => (id: string) => buttonsPanelHref(agentId, id),
    [agentId],
  );

  const sidebarSelectedId = canonicalGroupId ?? firstGroupId;

  const editorGroupId = groups.length > 0 ? canonicalGroupId ?? firstGroupId : undefined;

  useEffect(() => {
    if (searchParams.get("button") !== "new") return;
    setCreateOpen(true);
    const p = new URLSearchParams(searchParams);
    p.delete("button");
    setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (groups.length === 0) return;
    const fallbackId = groups[0].id;
    if (!urlGroupId || !groups.some((g) => g.id === urlGroupId)) {
      navigate(buttonsPanelHref(agentId, fallbackId), { replace: true });
    }
  }, [agentId, groups, navigate, urlGroupId]);

  function handleCreated(newId: string) {
    setCreateOpen(false);
    navigate(buttonsPanelHref(agentId, newId), { replace: true });
    void reload();
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ButtonTemplatesSidebar
          groups={groups}
          selectedGroupId={sidebarSelectedId}
          onAddGroup={() => setCreateOpen(true)}
          groupHref={groupHref}
        />

        <div>
          {groups.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">No button groups yet</span>
                  <InlineHelpHint className="size-7 shrink-0" label="Button groups overview">
                    <p>
                      Choose Add group, name the folder in the dialog, then select it from the list and add
                      templates. Attach groups on Agent → Profile → Attached knowledge.
                    </p>
                  </InlineHelpHint>
                </CardTitle>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
                  Use Add group to open the creation dialog.
                </p>
              </CardHeader>
            </Card>
          )}

          {editorGroupId !== undefined && (
            <ButtonTemplateGroupEditor
              key={`${editorGroupId}-${refreshKey}`}
              groupId={editorGroupId}
              usedByNames={agentsUsingKnowledgeGroup(agents, editorGroupId, "buttons")}
              onSaved={reload}
            />
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
              <span>New button group</span>
              <InlineHelpHint label="What is a button group">
                <p>
                  Choose a short workspace-wide name (for example Sales). Then add button templates in the group
                  editor after you create it.
                </p>
              </InlineHelpHint>
            </DialogTitle>
            <DialogDescription>
              Create a workspace folder for related button templates (message text plus interactive buttons).
            </DialogDescription>
          </DialogHeader>
          <ButtonTemplateCreateGroupForm
            active={createOpen}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
