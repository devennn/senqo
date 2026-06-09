import { Link } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import { Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AgentToolsFieldsProps } from "@/types/ui";

export function AgentToolsFields({
  tools,
  skills,
  selectedTools,
  selectedSkills,
  toolsDirty,
  skillsDirty,
  saving,
}: AgentToolsFieldsProps) {
  const { wsPath } = useWorkspace();
  const configurable = tools.filter((t) => t.scope !== "system");

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
        <div className="grid gap-2 sm:grid-cols-2">
          {configurable.map((tool) => (
            <label key={tool.id} className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" name="tools" value={tool.tool_key} defaultChecked={selectedTools.has(tool.tool_key)} />
                <span>{tool.display_name}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`rounded px-1.5 py-0.5 text-xs ${tool.scope === "workspace" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"}`}>
                  {tool.scope === "workspace" ? "Custom" : "Free for all"}
                </span>
              </span>
            </label>
          ))}
        </div>
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
        <div className="grid gap-2 sm:grid-cols-2">
          {skills.length > 0 ? skills.map((skill) => (
            <label key={skill.id} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
              <input type="checkbox" name="skills" value={skill.skill_key} defaultChecked={selectedSkills.has(skill.skill_key)} />
              <span>{skill.display_name}</span>
            </label>
          )) : (
            <p className="text-xs text-muted-foreground">
              No skills in your workspace yet.{" "}
              <Link to={`${wsPath("/agent")}?tab=skills`} className="font-medium text-primary underline-offset-4 hover:underline">
                Add skills
              </Link>{" "}
              under Agent setup.
            </p>
          )}
        </div>
      </fieldset>
    </>
  );
}
