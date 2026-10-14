import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function SvgShell({
  className,
  title,
  children,
}: {
  className?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

export function GoogleDocsTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Google Docs">
      <path
        fill="#4285F4"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#A1C2FA" d="M40 13H30V3z" />
      <path fill="#1967D2" d="M30 13l10 10V13z" />
      <path
        fill="#E8F0FE"
        d="M15 23h18v2H15zm0 4h18v2H15zm0 4h18v2H15zm0 4h10v2H15z"
      />
    </SvgShell>
  );
}

export function GoogleSheetsTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Google Sheets">
      <path
        fill="#0F9D58"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#8CD9B3" d="M40 13H30V3z" />
      <path fill="#0B8043" d="M30 13l10 10V13z" />
      <path fill="#E6F4EA" d="M15 21h18v16H15z" />
      <path
        fill="#0F9D58"
        d="M15 21h18v2H15zm0 5h18v1H15zm0 5h18v1H15zm5-10v16h1V21zm6 0v16h1V21z"
      />
    </SvgShell>
  );
}

export function GoogleSlidesTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Google Slides">
      <path
        fill="#F4B400"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#FCE8B2" d="M40 13H30V3z" />
      <path fill="#E37400" d="M30 13l10 10V13z" />
      <path fill="#FFF8E1" d="M15 23h18v12H15z" />
      <path fill="#F4B400" d="M15 23h18v2H15z" />
    </SvgShell>
  );
}

export function GoogleFormsTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Google Forms">
      <path
        fill="#673AB7"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#D1C4E9" d="M40 13H30V3z" />
      <path fill="#4527A0" d="M30 13l10 10V13z" />
      <circle cx="17" cy="24" r="1.5" fill="#EDE7F6" />
      <path fill="#EDE7F6" d="M21 23h12v2H21z" />
      <circle cx="17" cy="30" r="1.5" fill="#EDE7F6" />
      <path fill="#EDE7F6" d="M21 29h12v2H21z" />
      <circle cx="17" cy="36" r="1.5" fill="#EDE7F6" />
      <path fill="#EDE7F6" d="M21 35h8v2H21z" />
    </SvgShell>
  );
}

export function GooglePdfTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="PDF">
      <path
        fill="#EA4335"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#F6AEA9" d="M40 13H30V3z" />
      <path fill="#C5221F" d="M30 13l10 10V13z" />
      <path
        fill="#FCE8E6"
        d="M16 26h16c.6 0 1 .4 1 1v8c0 .6-.4 1-1 1H16c-.6 0-1-.4-1-1v-8c0-.6.4-1 1-1z"
      />
      <path
        fill="#EA4335"
        d="M18 28h3.2c1.1 0 1.9.7 1.9 1.7 0 1-.8 1.7-1.9 1.7H19.2V34H18zm1.2 2.4h1.8c.5 0 .8-.3.8-.7s-.3-.7-.8-.7h-1.8zm5 3.6c1.3 0 2.2-.9 2.2-2.2v-1.6c0-1.3-.9-2.2-2.2-2.2H23V34h1.2zm0-1h.8c.6 0 1-.4 1-1v-1.2c0-.6-.4-1-1-1h-.8zm3.8-3.6v6h3.4v-1h-2.2v-1.4h2v-1h-2v-1.6h2.2v-1z"
      />
    </SvgShell>
  );
}

export function GoogleFolderTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Folder">
      <path
        fill="#FBBC04"
        d="M40 14H24l-4-4H8c-2.2 0-4 1.8-4 4v24c0 2.2 1.8 4 4 4h32c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z"
      />
      <path
        fill="#FDD663"
        d="M40 14H8c-2.2 0-4 1.8-4 4v2h40v-2c0-2.2-1.8-4-4-4z"
      />
    </SvgShell>
  );
}

export function WordTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Word document">
      <path
        fill="#2B579A"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#8FAADC" d="M40 13H30V3z" />
      <path fill="#1E3F6F" d="M30 13l10 10V13z" />
      <path
        fill="#E8F0FE"
        d="M16 34l2.8-12h2.4l1.8 7.4 1.8-7.4h2.4L30 34h-2.3l-1.5-7.2L24.6 34H22l-1.6-7.2L18.9 34z"
      />
    </SvgShell>
  );
}

export function ExcelTypeIcon({ className }: { className?: string }) {
  return (
    <SvgShell className={className} title="Excel spreadsheet">
      <path
        fill="#217346"
        d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"
      />
      <path fill="#8FD1A8" d="M40 13H30V3z" />
      <path fill="#0D5C2E" d="M30 13l10 10V13z" />
      <path
        fill="#E6F4EA"
        d="M17.2 22h2.6l3.2 5.4 3.2-5.4h2.6L24.2 30l4.8 8h-2.6L23 32.4 19.8 38h-2.6l4.8-8z"
      />
    </SvgShell>
  );
}
