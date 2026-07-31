import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SKILLS_UI_PAGE_SIZE } from "@/lib/skills-limits";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceSkillDefinitionRecord } from "@/types/repositories";

type Props = {
  skills: WorkspaceSkillDefinitionRecord[];
  selectedId: string | undefined;
  isNew: boolean;
  toSkillsUrl: (target: { skillId?: string | null; mode?: string | null }) => string;
};

export function SkillsSidebar({ skills, selectedId, isNew, toSkillsUrl }: Props) {
  const pageSize = SKILLS_UI_PAGE_SIZE;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selectedId || skills.length === 0) return;
    const idx = skills.findIndex((s) => s.id === selectedId);
    if (idx < 0) return;
    setPage(Math.floor(idx / pageSize) + 1);
  }, [selectedId, pageSize, skills]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(skills.length / pageSize));
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [skills.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(skills.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const listSkills = skills.slice(startOffset, startOffset + pageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Workspace skills</CardTitle>
        <CardDescription>Select a skill to view or edit.</CardDescription>
        <CardAction className="-mt-0.5 shrink-0">
          <Link to={toSkillsUrl({ mode: "new" })}>
            <Button type="button" size="sm">
              Add skill
            </Button>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {isNew ? (
          <div className="rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
            <p className="font-medium">New skill</p>
          </div>
        ) : null}
        {skills.length > 0 ? (
          <>
            {listSkills.map((s) => (
              <Link
                key={s.id}
                to={toSkillsUrl({ skillId: s.id })}
                className={`block rounded-md border px-3 py-2 text-sm ${
                  !isNew && selectedId === s.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                <p className="truncate font-medium">{s.display_name}</p>
                <p className="truncate text-xs">{s.skill_key}</p>
              </Link>
            ))}
            {skills.length > pageSize ? (
              <TablePagination
                page={safePage}
                total={skills.length}
                pageSize={pageSize}
                onPage={setPage}
                compact
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No skills yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
