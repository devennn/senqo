import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSkills, type SkillWithContent, type SkillsNavConfig } from "@/hooks/useSkills";
import { SkillsSidebar } from "@/pages/dashboard/skills/components/skills-sidebar";
import { SkillDetail } from "@/pages/dashboard/skills/components/skill-detail";
import { SkillCreateForm } from "@/pages/dashboard/skills/components/skill-create-form";
import { SkillEditForm } from "@/pages/dashboard/skills/components/skill-edit-form";
import { PageLoader } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  navigation: SkillsNavConfig;
};

export function SkillsCatalogPanel({ navigation }: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const skillId = searchParams.get("skillId");
  const mode = searchParams.get("mode");
  const { skills, loading, fetchSkill, createSkill, updateSkill, deleteSkill, toSkillsUrl } = useSkills(navigation);
  const [selected, setSelected] = useState<SkillWithContent | null>(null);

  useEffect(() => {
    if (!skills.length || mode === "new") {
      setSelected(null);
      return;
    }
    const id = skillId ?? skills[0]?.id;
    if (!id) return;
    if (!skillId) navigate(toSkillsUrl({ skillId: id }), { replace: true });
    void fetchSkill(id).then(setSelected);
  }, [skillId, mode, skills, fetchSkill, navigate, toSkillsUrl]);

  const selectedId = skillId ?? skills[0]?.id;

  if (loading) return <PageLoader layout="agentTabPanel" label="Loading skills" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <SkillsSidebar skills={skills} selectedId={selectedId} isNew={mode === "new"} toSkillsUrl={toSkillsUrl} />
      <div>
        {mode === "new" && <SkillCreateForm onCreate={createSkill} cancelTo={toSkillsUrl(selectedId ? { skillId: selectedId } : {})} />}
        {mode !== "new" && selected && mode === "edit" && (
          <SkillEditForm skill={selected} onUpdate={updateSkill} cancelTo={toSkillsUrl({ skillId: selected.id })} />
        )}
        {mode !== "new" && selected && mode !== "edit" && (
          <SkillDetail skill={selected} onDelete={deleteSkill} editTo={toSkillsUrl({ skillId: selected.id, mode: "edit" })} />
        )}
        {mode !== "new" && !selected && (
          <Card>
            <CardHeader>
              <CardTitle>No skills yet</CardTitle>
              <CardDescription>Create your first workspace skill to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Use the Add skill button in the Workspace Skills panel.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
