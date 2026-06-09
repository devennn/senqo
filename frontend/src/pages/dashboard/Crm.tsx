import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { AppFrame } from "@/components/layout/app-frame";
import { CrmFilters } from "@/pages/dashboard/components/crm-filters";
import { CrmTable } from "@/pages/dashboard/components/crm-table";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import { TableListLoading } from "@/pages/dashboard/components/table-list-loading";

export default function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const search = searchParams.get("search") ?? "";
  const hasMetadataOnly = searchParams.get("hasMetadata") === "on";
  const testOnly = searchParams.get("testOnly") === "on";

  const {
    contacts,
    total,
    loading,
    pageSize,
    addContact,
    setIsTest,
    deleteContact,
    refetch,
    updatingIsTestId,
    deletingContactId,
  } = useContacts({ page, search, hasMetadataOnly, testOnly });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(safePage));
      setSearchParams(next, { replace: true });
    }
  }, [page, safePage, searchParams, setSearchParams]);

  function updateParams(next: URLSearchParams) {
    setSearchParams(next, { replace: true });
  }

  function applyFilters(newSearch: string, newHasMeta: boolean, newTestOnly: boolean) {
    const q = new URLSearchParams();
    if (newSearch) q.set("search", newSearch);
    if (newHasMeta) q.set("hasMetadata", "on");
    if (newTestOnly) q.set("testOnly", "on");
    q.set("page", "1");
    updateParams(q);
  }

  function goToPage(nextPage: number) {
    const q = new URLSearchParams(searchParams);
    q.set("page", String(nextPage));
    updateParams(q);
  }

  async function handleAddContact(contact: Parameters<typeof addContact>[0]) {
    await addContact(contact);
    if (page === 1) {
      await refetch();
    } else {
      goToPage(1);
    }
  }

  return (
    <AppFrame conversations={[]} messages={[]} hideConversationRail mainPanel={
      <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">CRM</h1>
          <p className="mt-1.5 text-base text-muted-foreground">All contacts and their information in one place.</p>
        </div>
        <div className="mt-6">
          <CrmFilters
            search={search}
            hasMetadataOnly={hasMetadataOnly}
            testOnly={testOnly}
            onApply={applyFilters}
            onAdd={handleAddContact}
          />
        </div>
        <div className="mt-7 min-h-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold">
            <Users className="size-5 text-primary" />
            Contacts
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
              {loading ? "…" : total}
            </span>
          </div>
          {loading ? (
            <TableListLoading label="Loading contacts" />
          ) : total === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">
              No contacts match your current filters.
            </p>
          ) : (
            <>
              <CrmTable
                contacts={contacts}
                onSetIsTest={setIsTest}
                updatingIsTestId={updatingIsTestId}
                onDeleteContact={deleteContact}
                deletingContactId={deletingContactId}
              />
              <TablePagination
                page={safePage}
                total={total}
                pageSize={pageSize}
                onPage={goToPage}
              />
            </>
          )}
        </div>
      </section>
    } />
  );
}
