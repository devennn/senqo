import { useCallback, useEffect, useState } from "react";
import {
  clearAdminAiMessages,
  fetchAdminAiMessages,
  sendAdminAiChat,
  type AdminAiChatMessage,
} from "@/lib/admin-api";

export function useAdminAiChat() {
  const [messages, setMessages] = useState<AdminAiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminAiMessages()
      .then(setMessages)
      .catch((e) => setError(String((e as Error).message)))
      .finally(() => setLoading(false));
  }, []);

  const send = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setError(null);
    setSending(true);
    // Optimistic user message; the server persists the same content.
    const optimistic: AdminAiChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { reply } = await sendAdminAiChat(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      // Remove the optimistic message on failure so the chat reflects reality.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(String((e as Error).message).replace(/_/g, " "));
    } finally {
      setSending(false);
    }
  }, [sending]);

  const clear = useCallback(async () => {
    setError(null);
    try {
      await clearAdminAiMessages();
      setMessages([]);
    } catch (e) {
      setError(String((e as Error).message).replace(/_/g, " "));
    }
  }, []);

  return { messages, loading, sending, error, send, clear };
}
