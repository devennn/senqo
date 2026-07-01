import { BookOpen, MessagesSquare, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentKnowledgeImportTarget } from "@/types/agent-knowledge-import";

const TARGET_OPTIONS: {
  id: AgentKnowledgeImportTarget;
  label: string;
  description: string;
  icon: typeof BookOpen;
}[] = [
  {
    id: "context",
    label: "Workspace context",
    description: "Fact groups the agent can reference in replies.",
    icon: BookOpen,
  },
  {
    id: "skills",
    label: "Skills",
    description: "Markdown playbooks for how the agent should act.",
    icon: Zap,
  },
  {
    id: "templates",
    label: "Response templates",
    description: "Intent + verbatim WhatsApp reply pairs.",
    icon: MessagesSquare,
  },
];

type Props = {
  targets: AgentKnowledgeImportTarget[];
  focusHint: string;
  profileName: string;
  canGenerate: boolean;
  generateError: string | null;
  onToggleTarget: (target: AgentKnowledgeImportTarget) => void;
  onFocusHintChange: (value: string) => void;
  onGenerate: () => void;
};

export function AgentKnowledgeImportTargetsForm({
  targets,
  focusHint,
  profileName,
  canGenerate,
  generateError,
  onToggleTarget,
  onFocusHintChange,
  onGenerate,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>What should we create?</span>
          <InlineHelpHint label="Import targets">
            <p>
              Pick one or more catalog types. After you upload docs, AI drafts groups and entries attached to{" "}
              {profileName} — review before saving.
            </p>
          </InlineHelpHint>
        </CardTitle>
        <CardDescription>Draft outputs for {profileName}. Select at least one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {TARGET_OPTIONS.map((option) => {
            const selected = targets.includes(option.id);
            const Icon = option.icon;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border/70 hover:border-border",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected}
                  onChange={() => onToggleTarget(option.id)}
                />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label htmlFor="import-focus-hint">Focus (optional)</Label>
          <Textarea
            id="import-focus-hint"
            value={focusHint}
            onChange={(e) => onFocusHintChange(e.target.value)}
            placeholder="e.g. pricing, returns policy, onboarding steps"
            rows={3}
            className="resize-y"
            maxLength={500}
          />
        </div>

        {generateError ? <p className="text-sm text-destructive">{generateError}</p> : null}

        <Button type="button" disabled={!canGenerate} onClick={onGenerate} className="w-full sm:w-auto">
          <Sparkles className="size-4" aria-hidden />
          Generate preview
        </Button>
      </CardContent>
    </Card>
  );
}
