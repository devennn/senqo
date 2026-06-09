import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { cn } from "@/lib/utils";

const nameTitleButtonClass =
  "min-w-0 max-w-[min(28rem,calc(100%-2rem))] truncate rounded-md px-1 py-0 text-left font-heading text-lg font-semibold leading-snug text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

type Props = {
  icon: ReactNode;
  helpLabel: string;
  helpContent: ReactNode;
  loading: boolean;
  loadError: string | null;
  nameEditing: boolean;
  groupName: string;
  deletingGroup: boolean;
  onStartNameEdit: () => void;
  nameFields: ReactNode;
  className?: string;
};

export function GroupEditorCardNameHeader({
  icon,
  helpLabel,
  helpContent,
  loading,
  loadError,
  nameEditing,
  groupName,
  deletingGroup,
  onStartNameEdit,
  nameFields,
  className,
}: Props) {
  return (
    <CardTitle className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-snug">
        {icon}
        {loading ? (
          <span className="sr-only">Loading</span>
        ) : loadError ? null : nameEditing ? null : (
          <button
            type="button"
            disabled={deletingGroup}
            className={nameTitleButtonClass}
            aria-label="Edit group name"
            onClick={() => onStartNameEdit()}
          >
            {groupName.trim() || "Untitled group"}
          </button>
        )}
        <InlineHelpHint label={helpLabel}>{helpContent}</InlineHelpHint>
      </div>
      {!loading && !loadError && nameEditing ? nameFields : null}
    </CardTitle>
  );
}
