import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  onOpenHandoffSettings: () => void;
};

/** Row actions for a handoff group in the sidebar list. */
export function HandoffTopicGroupRowMenu({ onOpenHandoffSettings }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground"
          />
        }
      >
        <MoreVertical className="size-4" />
        <span className="sr-only">Open group actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onClick={onOpenHandoffSettings}>Handoff settings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
