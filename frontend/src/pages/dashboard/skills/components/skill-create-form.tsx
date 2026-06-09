import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onCreate: (displayName: string, description: string, content: string) => Promise<void>;
  cancelTo: string;
};

export function SkillCreateForm({ onCreate, cancelTo }: Props) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await onCreate(String(fd.get("displayName") ?? ""), String(fd.get("description") ?? ""), String(fd.get("content") ?? ""));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Skill</CardTitle>
        <CardDescription>Add a new markdown skill for this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input name="displayName" placeholder="Lead Qualification" required /></div>
          <div className="space-y-2"><Label>Description</Label><Input name="description" placeholder="How and when to use this skill." /></div>
          <div className="space-y-2"><Label>Markdown Definition</Label><Textarea name="content" placeholder="## Skill instructions..." rows={12} className="resize-y" required /></div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">Create skill</Button>
            <Link to={cancelTo}>
              <Button type="button" size="sm" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
