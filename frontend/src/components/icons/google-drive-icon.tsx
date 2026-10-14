import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  title?: string;
  /** Render as decorative (no accessible name) inside controls that already say "Google Drive". */
  decorative?: boolean;
};

/** Official-style Google Drive triangle mark (brand colors). */
export function GoogleDriveIcon({ className, title = "Google Drive", decorative = false }: Props) {
  return (
    <svg
      viewBox="0 0 87.3 78"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={cn("size-5 shrink-0", className)}
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.25l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.75-2.5 1.85-3.3 3.25L1.2 48.35c-.8 1.4-1.2 2.95-1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.75c1.35-.75 2.5-1.85 3.3-3.25l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85l5.1 9.5z"
        fill="#ea4335"
      />
      <path
        d="M43.65 25 57.4 1.2C56.05.45 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="M59.85 53H27.5L13.75 76.8c1.35.75 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.25L43.65 25l16.2 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}
