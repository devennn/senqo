import type { ButtonTemplateButton } from "@/types/repositories";

type Props = {
  body: string;
  buttons: ButtonTemplateButton[];
};

/** WhatsApp-style read-only preview of the button message customers will see. */
export function ButtonTemplatePreview({ body, buttons }: Props) {
  const bodyText = body.trim();
  return (
    <div className="rounded-lg bg-muted/40 p-4 dark:bg-muted/20">
      <div className="mx-auto max-w-sm space-y-2 rounded-lg border border-border bg-card p-3 shadow-soft">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {bodyText.length > 0 ? bodyText : "Message text"}
        </p>
        {buttons.length > 0 ? (
          <div className="space-y-1.5">
            {buttons.map((button, index) => (
              <div
                key={`${button.type}-${index}`}
                className="flex items-center justify-center rounded-md border border-border py-1.5 text-sm font-medium text-primary"
              >
                <span className="min-w-0 truncate px-2">
                  {button.label.trim().length > 0 ? button.label.trim() : "Button"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
