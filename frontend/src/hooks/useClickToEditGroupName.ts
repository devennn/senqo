import { useCallback, useEffect, useState } from "react";

/** Click-to-edit group name: Escape or cancel reverts draft to `baselineName`. */
export function useClickToEditGroupName(
  groupId: string,
  baselineName: string,
  setDraft: (name: string) => void,
  onClearNameError: () => void,
) {
  const [nameEditing, setNameEditing] = useState(false);

  useEffect(() => {
    setNameEditing(false);
  }, [groupId]);

  const cancelNameEdit = useCallback(() => {
    setDraft(baselineName);
    onClearNameError();
    setNameEditing(false);
  }, [baselineName, onClearNameError, setDraft]);

  useEffect(() => {
    if (!nameEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelNameEdit();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [nameEditing, cancelNameEdit]);

  return {
    nameEditing,
    startNameEdit: () => setNameEditing(true),
    endNameEdit: () => setNameEditing(false),
  };
}
