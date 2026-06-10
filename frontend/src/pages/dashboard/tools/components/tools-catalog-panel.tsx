import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import { useCustomTools, type ToolWithSource, type ToolsNavConfig } from "@/hooks/useCustomTools";
import { useWorkspaceSecrets } from "@/hooks/useWorkspaceSecrets";
import { ToolAvailableSecretsList } from "@/pages/dashboard/tools/components/tool-available-secrets-list";
import { ToolCatalogHowTo } from "@/pages/dashboard/tools/components/tool-catalog-how-to";
import { ToolsSidebar } from "@/pages/dashboard/tools/components/tools-sidebar";
import { ToolCreateForm } from "@/pages/dashboard/tools/components/tool-create-form";
import { ToolEditForm } from "@/pages/dashboard/tools/components/tool-edit-form";
import { PageLoader } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { navigation: ToolsNavConfig };

export function ToolsCatalogPanel({ navigation }: Props) {
  const { wsPath } = useWorkspace();
  const secretsSettingsPath = wsPath("/settings/secrets");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toolId = searchParams.get("toolId");
  const mode = searchParams.get("mode");
  const { tools, loading, fetchTool, createTool, updateTool, deleteTool, testTool, toToolsUrl } =
    useCustomTools(navigation);
  const { items: secrets, loading: secretsLoading } = useWorkspaceSecrets();
  const [selected, setSelected] = useState<ToolWithSource | null>(null);

  useEffect(() => {
    if (!tools.length || mode === "new") {
      setSelected(null);
      return;
    }
    const id = toolId ?? tools[0]?.id;
    if (!id) return;
    if (!toolId) navigate(toToolsUrl({ toolId: id }), { replace: true });
    void fetchTool(id).then(setSelected);
  }, [toolId, mode, tools, fetchTool, navigate, toToolsUrl]);

  const selectedId = toolId ?? tools[0]?.id;
  if (loading) return <PageLoader layout="agentTabPanel" label="Loading tools" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <ToolsSidebar tools={tools} selectedId={selectedId} isNew={mode === "new"} toToolsUrl={toToolsUrl} />
        <ToolCatalogHowTo secretsSettingsPath={secretsSettingsPath} />
        <ToolAvailableSecretsList
          secrets={secrets}
          loading={secretsLoading}
          secretsSettingsPath={secretsSettingsPath}
        />
      </div>
      <div>
        {mode === "new" && (
          <ToolCreateForm
            onCreate={createTool}
            cancelTo={toToolsUrl(selectedId ? { toolId: selectedId } : {})}
            secretsSettingsPath={secretsSettingsPath}
          />
        )}
        {mode !== "new" && selected ? (
          <ToolEditForm
            key={selected.id}
            tool={selected}
            onTest={testTool}
            onUpdate={updateTool}
            onDelete={deleteTool}
            secretsSettingsPath={secretsSettingsPath}
          />
        ) : null}
        {mode !== "new" && !selected && (
          <Card>
            <CardHeader>
              <CardTitle>No tools yet</CardTitle>
              <CardDescription>Create your first custom tool to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Use Add tool in the sidebar.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
