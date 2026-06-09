import { useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CreateAgentDialogProps } from "@/types/ui";

export function CreateAgentDialog({ createAgent }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="w-full sm:w-auto" />}>
        <Plus className="mr-1.5 size-3.5" /> Create New Agent
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-amber-500" />
            Confirm agent creation
          </DialogTitle>
          <DialogDescription>
            Create a new agent profile now? You can configure behavior and connect WhatsApp later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={async () => { await createAgent(); setOpen(false); }}>
            Yes, create agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
