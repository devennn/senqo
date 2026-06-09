import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceSkillDefinitionRecord } from "@/types/repositories";

type Props = {
  skills: WorkspaceSkillDefinitionRecord[];
  selectedId: string | undefined;
  isNew: boolean;
  toSkillsUrl: (target: { skillId?: string | null; mode?: string | null }) => string;
};

export function SkillsSidebar({ skills, selectedId, isNew, toSkillsUrl }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Workspace Skills</CardTitle>
            <CardDescription>Select a skill to view or edit.</CardDescription>
          </div>
          <Link to={toSkillsUrl({ mode: "new" })} className="sm:shrink-0">
            <Button type="button" size="sm" className="w-full sm:w-auto">Add skill</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isNew && (
          <div className="rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
            <p className="font-medium">New Skill</p>
          </div>
        )}
        {skills.length > 0 ? skills.map((s) => (
          <Link key={s.id} to={toSkillsUrl({ skillId: s.id })} className={`block rounded-md border px-3 py-2 text-sm ${!isNew && selectedId === s.id ? "border-primary bg-primary/5 text-foreground" : "border-border/70 text-muted-foreground"}`}>
            <p className="truncate font-medium">{s.display_name}</p>
            <p className="truncate text-xs">{s.skill_key}</p>
          </Link>
        )) : <p className="text-sm text-muted-foreground">No skills yet.</p>}
      </CardContent>
    </Card>
  );
}
