import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SkillWithContent } from "@/hooks/useSkills";

type Props = {
  skill: SkillWithContent;
  onUpdate: (id: string, displayName: string, description: string, content: string, isActive: boolean) => Promise<void>;
  cancelTo: string;
};

export function SkillEditForm({ skill, onUpdate, cancelTo }: Props) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isActive = (e.currentTarget.querySelector("[name=isActive]") as HTMLInputElement)?.checked ?? true;
    await onUpdate(skill.id, String(fd.get("displayName") ?? ""), String(fd.get("description") ?? ""), String(fd.get("content") ?? ""), isActive);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Skill</CardTitle>
        <CardDescription>Update metadata, content, and active status.</CardDescription>
      </CardHeader>
      <CardContent>
        <form key={skill.id} onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input name="displayName" defaultValue={skill.display_name} required /></div>
          <div className="space-y-2"><Label>Description</Label><Input name="description" defaultValue={skill.description} /></div>
          <div className="space-y-2"><Label>Markdown Definition</Label><Textarea name="content" defaultValue={skill.content} rows={12} className="resize-y" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={skill.is_active} /> Active</label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">Save changes</Button>
            <Link to={cancelTo}><Button type="button" size="sm" variant="outline">Cancel</Button></Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
