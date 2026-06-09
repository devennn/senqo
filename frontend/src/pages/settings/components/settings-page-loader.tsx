import { PageLoader } from "@/components/ui/spinner";

export function SettingsPageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center px-4 py-4 sm:px-6 sm:py-5">
      <PageLoader label={label} />
    </div>
  );
}
