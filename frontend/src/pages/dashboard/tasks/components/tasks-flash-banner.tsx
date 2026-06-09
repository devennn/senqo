import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 6000;

export function TasksFlashBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const variant: "success" | "error" | null = success ? "success" : error ? "error" : null;
  const message = success ? decodeURIComponent(success).replace(/_/g, " ") : error ? decodeURIComponent(error).replace(/_/g, " ") : null;

  const dismiss = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("success");
    next.delete("error");
    const query = next.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname, { replace: true });
  }, [location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (!variant) return;
    const id = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [dismiss, variant]);

  if (!variant || !message) return null;

  const styles =
    variant === "success"
      ? "border border-primary/40 bg-secondary text-secondary-foreground"
      : "border border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <div className={cn("mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm", styles)} role="status">
      <p className="min-w-0 flex-1">{message}</p>
      <Button type="button" variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Dismiss" className="shrink-0 -mr-1 -mt-0.5">
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}
