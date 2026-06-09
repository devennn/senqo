import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import type { TaskFormContactOption } from "@/types/repositories";

type ContactOptionsResponse = {
  contacts: TaskFormContactOption[];
};

export function useContactOptions(enabled: boolean) {
  const [contacts, setContacts] = useState<TaskFormContactOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ContactOptionsResponse>("/api/user/contacts/options");
      setContacts(res.contacts);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !loaded && !loading) {
      void load();
    }
  }, [enabled, loaded, loading, load]);

  return { contacts, loading, loaded };
}
