import { useEffect, type Dispatch, type SetStateAction } from "react";

/** After `flag` becomes true, sets it back to false after `delayMs` (cleans up on unmount or when `flag` flips). */
export function useTransientBooleanReset(
  flag: boolean,
  setFlag: Dispatch<SetStateAction<boolean>>,
  delayMs: number,
): void {
  useEffect(() => {
    if (!flag) return;
    const id = window.setTimeout(() => setFlag(false), delayMs);
    return () => window.clearTimeout(id);
  }, [flag, delayMs, setFlag]);
}
