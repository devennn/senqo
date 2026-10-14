import { Link } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import { Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";
import type { AgentToolsFieldsProps } from "@/types/ui";

export function AgentToolsFields({
  tools,
  skills,
  selectedTools,
  selectedSkills,
  toolsDirty,
  skillsDirty,
  saving,
  toolsTabHref,
}: AgentToolsFieldsProps) {
  const { wsPath } = useWorkspace();

  return (
    <>
      <fieldset className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="flex items-center gap-2">
            <Wrench className="size-3.5 text-muted-foreground" /> Tools
          </Label>
          {toolsDirty ? (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
        {tools.length > 0 ? (
          <AgentAttachCheckboxList
            fieldName="tools"
            items={tools.map((tool) => ({ id: tool.tool_key, name: tool.display_name }))}
            selectedIds={selectedTools}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No custom tools yet.{" "}
            <Link to={toolsTabHref} className="font-medium text-primary underline-offset-4 hover:underline">
              Open Tool Catalog
            </Link>{" "}
            to create one.
          </p>
        )}
      </fieldset>
      <fieldset className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="flex items-center gap-2">
            <Zap className="size-3.5 text-muted-foreground" /> Skills
          </Label>
          {skillsDirty ? (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
        {skills.length > 0 ? (
          <AgentAttachCheckboxList
            fieldName="skills"
            items={skills.map((skill) => ({ id: skill.skill_key, name: skill.display_name }))}
            selectedIds={selectedSkills}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No skills in your workspace yet.{" "}
            <Link to={`${wsPath("/agent")}?tab=skills`} className="font-medium text-primary underline-offset-4 hover:underline">
              Add skills
            </Link>{" "}
            under Agent setup.
          </p>
        )}
      </fieldset>
    </>
  );
}
