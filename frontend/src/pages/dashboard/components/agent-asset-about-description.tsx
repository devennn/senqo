import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { workspaceAssetLimitsSummaryForUi } from "@/lib/workspace-asset-limits";

export const ASSET_ABOUT_DESCRIPTION_PLACEHOLDER =
  "e.g. 2024 price list with plans, add-ons, and onboarding steps.";

export function AssetAboutDescriptionHintBody() {
  return (
    <>
      <p>
        Internal description of the file. The agent reads it to know what the file contains;
        customers never see it.
      </p>
      <p>
        Describe the file itself: what it is, what is inside, who it helps. No instructions,
        tool names, or send rules.
      </p>
      <p>Upload limit: {workspaceAssetLimitsSummaryForUi()}. Sendable files count toward workspace storage (see Settings → Workspace).</p>
    </>
  );
}

type LabelProps = {
  htmlFor: string;
  labelClassName?: string;
};

export function AssetAboutDescriptionLabel({ htmlFor, labelClassName }: LabelProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Label htmlFor={htmlFor} className={labelClassName}>
        Description
      </Label>
      <InlineHelpHint label="Description">
        <AssetAboutDescriptionHintBody />
      </InlineHelpHint>
    </div>
  );
}
