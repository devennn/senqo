import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import type { WorkspaceResponseTemplateGroupSummary } from "@/types/repositories";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { ResponseTemplateCreateGroupForm } from "@/pages/dashboard/components/response-template-create-group-form";
import { ResponseTemplatesSidebar } from "@/pages/dashboard/components/response-templates-sidebar";
import { ResponseTemplateGroupEditor } from "@/pages/dashboard/components/response-template-group-editor";

type Props = {
  groups: WorkspaceResponseTemplateGroupSummary[];
  reload: () => Promise<void>;
  agentId: string | undefined;
  refreshKey?: number;
};

export function ResponseTemplatesPanel({ groups, reload, agentId, refreshKey = 0 }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  function templatesPanelHref(id: string | undefined, templateGroupId: string): string {
    const params = new URLSearchParams();
    params.set("tab", "templates");
    if (id) params.set("agentId", id);
    params.set("templateGroupId", templateGroupId);
    return `${wsPath("/agent")}?${params.toString()}`;
  }

  const urlGroupId = searchParams.get("templateGroupId") ?? undefined;

  const canonicalGroupId = useMemo(() => {
    if (!urlGroupId) return undefined;
    return groups.some((g) => g.id === urlGroupId) ? urlGroupId : undefined;
  }, [groups, urlGroupId]);

  const firstGroupId = groups[0]?.id;

  const groupHref = useMemo(
    () => (id: string) => templatesPanelHref(agentId, id),
    [agentId],
  );

  const sidebarSelectedId = canonicalGroupId ?? firstGroupId;

  const editorGroupId = groups.length > 0 ? canonicalGroupId ?? firstGroupId : undefined;

  useEffect(() => {
    if (searchParams.get("template") !== "new") return;
    setCreateOpen(true);
    const p = new URLSearchParams(searchParams);
    p.delete("template");
    setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (groups.length === 0) return;
    const fallbackId = groups[0].id;
    if (!urlGroupId || !groups.some((g) => g.id === urlGroupId)) {
      navigate(templatesPanelHref(agentId, fallbackId), { replace: true });
    }
  }, [agentId, groups, navigate, urlGroupId]);

  function handleCreated(newId: string) {
    setCreateOpen(false);
    navigate(templatesPanelHref(agentId, newId), { replace: true });
    void reload();
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ResponseTemplatesSidebar
          groups={groups}
          selectedGroupId={sidebarSelectedId}
          onAddGroup={() => setCreateOpen(true)}
          groupHref={groupHref}
        />

        <div>
          {groups.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>No template groups yet</span>
                  <InlineHelpHint label="Template groups overview">
                    <p>
                      Choose Add group, name the folder in the dialog, then select it from the list and add entries.
                      Attach groups on Profile when editing an agent.
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
            <ResponseTemplateGroupEditor
              key={`${editorGroupId}-${refreshKey}`}
              groupId={editorGroupId}
              onSaved={reload}
            />
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
              <span>New template group</span>
              <InlineHelpHint label="What is a template group">
                <p>
                  Choose a short workspace-wide name (for example Operation). Then add entries in the group editor after
                  you create it.
                </p>
              </InlineHelpHint>
            </DialogTitle>
            <DialogDescription>
              Create a workspace folder for related templates (intents plus verbatim WhatsApp replies).
            </DialogDescription>
          </DialogHeader>
          <ResponseTemplateCreateGroupForm
            active={createOpen}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
