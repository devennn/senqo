import { useEffect, useRef } from "react";
import type { AdminAiChatMessage } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function InstanceAdminAiChatMessageList({ messages }: { messages: AdminAiChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  return (
    <div className="max-h-96 space-y-3 overflow-y-auto" aria-live="polite">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex",
            message.role === "user" ? "justify-end" : "justify-start",
          )}
        >
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            <p
              className={cn(
                "mt-1 text-[10px]",
                message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {formatTime(message.created_at)}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
