import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { effectiveSkillDisposition, isImportReviewItemVisible } from "@/lib/agent-knowledge-import-selection";
import {
  AgentKnowledgeImportDispositionActions,
  AgentKnowledgeImportItemHeader,
} from "@/pages/dashboard/components/agent-knowledge-import-disposition-actions";
import { AgentKnowledgeImportReviewAnimatedItem } from "@/pages/dashboard/components/agent-knowledge-import-review-animated-item";
import type { DraftSkill } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportSelection,
} from "@/types/agent-knowledge-import-selection";

type Props = {
  skills: DraftSkill[];
  selection: AgentKnowledgeImportSelection;
  applyingTarget: AgentKnowledgeImportApplyTarget | null;
  onChange: (skills: DraftSkill[]) => void;
  onAddSkill: (skillId: string) => void;
  onDiscardSkill: (skillId: string) => void;
};

export function AgentKnowledgeImportDraftSkills({
  skills,
  selection,
  applyingTarget,
  onChange,
  onAddSkill,
  onDiscardSkill,
}: Props) {
  if (skills.length === 0) return null;

  function updateSkill(skillId: string, patch: Partial<DraftSkill>) {
    onChange(skills.map((s) => (s.id === skillId ? { ...s, ...patch } : s)));
  }

  return (
    <section className="space-y-4">
      {skills.map((skill, index) => {
        const isAdding =
          applyingTarget?.kind === "skill" && applyingTarget.skillId === skill.id;
        const skillVisible = isImportReviewItemVisible(
          effectiveSkillDisposition(selection, skill.id),
          isAdding,
        );

        return (
          <AgentKnowledgeImportReviewAnimatedItem key={skill.id} visible={skillVisible}>
            <div className="space-y-3 rounded-lg border border-border/70 bg-card p-4 shadow-soft">
              <AgentKnowledgeImportItemHeader
                label={skill.displayName.trim() || `Skill ${index + 1}`}
                actions={
                  <AgentKnowledgeImportDispositionActions
                    applying={isAdding}
                    onAccept={() => onAddSkill(skill.id)}
                    onDiscard={() => onDiscardSkill(skill.id)}
                  />
                }
              />
              <div className="space-y-2">
                <Label htmlFor={`skill-name-${skill.id}`}>Name</Label>
                <Input
                  id={`skill-name-${skill.id}`}
                  value={skill.displayName}
                  onChange={(e) => updateSkill(skill.id, { displayName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`skill-desc-${skill.id}`}>Description</Label>
                <Input
                  id={`skill-desc-${skill.id}`}
                  value={skill.description}
                  onChange={(e) => updateSkill(skill.id, { description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`skill-content-${skill.id}`}>Markdown</Label>
                <Textarea
                  id={`skill-content-${skill.id}`}
                  value={skill.content}
                  onChange={(e) => updateSkill(skill.id, { content: e.target.value })}
                  rows={8}
                  className="resize-y font-mono text-xs"
                />
              </div>
            </div>
          </AgentKnowledgeImportReviewAnimatedItem>
        );
      })}
    </section>
  );
}
