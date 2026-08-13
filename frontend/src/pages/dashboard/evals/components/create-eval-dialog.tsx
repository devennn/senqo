import { useState } from "react";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateManualEvalInput, EvalAgentOption } from "@/types/evals";

type Props = {
  agents: EvalAgentOption[];
  defaultAgentId?: string;
  onCreate: (input: CreateManualEvalInput) => void;
};

export function CreateEvalDialog({ agents, defaultAgentId, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agentId, setAgentId] = useState(defaultAgentId || agents[0]?.id || "");
  const [userMessage, setUserMessage] = useState("");
  const [expectedReply, setExpectedReply] = useState("");

  const canSubmit =
    title.trim().length > 0 &&
    userMessage.trim().length > 0 &&
    expectedReply.trim().length > 0 &&
    agentId.length > 0;

  function reset(): void {
    setTitle("");
    setAgentId(defaultAgentId || agents[0]?.id || "");
    setUserMessage("");
    setExpectedReply("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setAgentId(defaultAgentId || agents[0]?.id || "");
        } else {
          reset();
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-3.5" />
        Create eval
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create eval</DialogTitle>
          <DialogDescription>
            Add a customer message and the reply the agent should give.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="eval-create-title">Title</Label>
            <Input
              id="eval-create-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Business hours question"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eval-create-agent">Agent</Label>
            <select
              id="eval-create-agent"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eval-create-user">Customer message</Label>
            <Textarea
              id="eval-create-user"
              value={userMessage}
              onChange={(event) => setUserMessage(event.target.value)}
              placeholder="What are your business hours?"
              className="min-h-20"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eval-create-expected">Expected reply</Label>
            <Textarea
              id="eval-create-expected"
              value={expectedReply}
              onChange={(event) => setExpectedReply(event.target.value)}
              placeholder="We're open Monday to Friday…"
              className="min-h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              onCreate({ title, agentId, userMessage, expectedReply });
              setOpen(false);
              reset();
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
