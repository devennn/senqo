import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentProfileBehaviorFieldsProps } from "@/types/ui";

export function AgentProfileBehaviorFields({
  agent,
  profileNameDirty,
  profileBehaviorDirty,
  saving,
}: AgentProfileBehaviorFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="profileName">Profile name</Label>
          {profileNameDirty ? (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
        <Input
          id="profileName"
          name="profileName"
          placeholder="Sales Assistant"
          defaultValue={agent.profile_name}
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="behavior">Behavior</Label>
          {profileBehaviorDirty ? (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
        <Textarea
          id="behavior"
          name="behavior"
          placeholder="How should this agent respond? Tone, constraints, escalation rules..."
          defaultValue={agent.behavior}
          rows={5}
          className="resize-none"
        />
      </div>
    </div>
  );
}
