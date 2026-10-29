import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAiChat } from "@/hooks/useAdminAiChat";
import { InstanceAdminAiChatMessageList } from "./instance-admin-ai-chat-messages";

export function InstanceAdminAiChatSection() {
  const { messages, loading, sending, error, send, clear } = useAdminAiChat();
  const [draft, setDraft] = useState("");

  async function handleSend() {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    await send(message);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>AI assistant</CardTitle>
        <Button
          type="button"
          variant="outline"
          disabled={sending || messages.length === 0}
          onClick={() => void clear()}
        >
          Clear chat
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ask questions about this instance&apos;s settings, workspaces, and users — or ask the
          assistant to change a setting for you.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet. Try &quot;How many workspaces do I have?&quot;
          </p>
        ) : (
          <InstanceAdminAiChatMessageList messages={messages} />
        )}
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="Message"
            placeholder="Ask the admin assistant…"
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="min-h-16"
          />
          <Button
            type="button"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSend()}
          >
            {sending ? <Spinner className="size-4" /> : null}
            {sending ? "Thinking…" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
