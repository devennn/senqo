import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { SkillWithContent } from "@/hooks/useSkills";

type Props = {
  skill: SkillWithContent;
  onDelete: (id: string) => Promise<void>;
  editTo: string;
};

export function SkillDetail({ skill, onDelete, editTo }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skill details</CardTitle>
        <CardDescription>View all fields for this workspace skill.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Link to={editTo}>
            <Button type="button" size="sm" variant="outline">Edit</Button>
          </Link>
          <Button type="button" size="sm" variant="destructive" onClick={() => { void onDelete(skill.id); }}>Delete</Button>
        </div>
        <Field label="Name" value={skill.display_name} />
        <Field label="Description" value={skill.description?.trim() || "No description provided."} />
        <Field label="Skill key" value={<span className="font-mono">{skill.skill_key}</span>} />
        <Field label="Status" value={skill.is_active ? "Active" : "Inactive"} />
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Definition</p>
          <Textarea key={`${skill.id}-ro`} defaultValue={skill.content} readOnly rows={14} className="resize-y" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
