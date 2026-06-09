import { useAppVersion } from "@/hooks/useAppVersion";
import { cn } from "@/lib/utils";

export function AppVersionLabel({ className }: { className?: string }) {
  const version = useAppVersion();

  if (!version) return null;

  return (
    <p
      className={cn(
        "text-[11px] font-medium tracking-wide text-muted-foreground",
        className,
      )}
    >
      Senqo v{version}
    </p>
  );
}
