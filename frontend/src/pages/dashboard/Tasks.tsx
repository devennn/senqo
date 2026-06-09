import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { AppFrame } from "@/components/layout/app-frame";
import { TasksTable } from "@/pages/dashboard/tasks/components/tasks-table";
import { TasksToolbar } from "@/pages/dashboard/tasks/components/tasks-toolbar";
import { TasksFlashBanner } from "@/pages/dashboard/tasks/components/tasks-flash-banner";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import { TableListLoading } from "@/pages/dashboard/components/table-list-loading";

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const search = searchParams.get("search") ?? "";
  const { tasks, agents, total, loading, pageSize, createTask, cancelTask, refetch } = useTasks({
    page,
    search,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(safePage));
      setSearchParams(next, { replace: true });
    }
  }, [page, safePage, searchParams, setSearchParams]);

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next, { replace: true });
  }

  async function handleCreateTask(formData: FormData) {
    await createTask(formData);
    if (page === 1) {
      await refetch();
    } else {
      goToPage(1);
    }
  }

  return (
    <AppFrame conversations={[]} messages={[]} hideConversationRail mainPanel={
      <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <TasksFlashBanner />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tasks</h1>
          <p className="mt-1.5 text-base text-muted-foreground">Schedule and monitor automated agent tasks.</p>
        </div>
        <TasksToolbar
          search={search}
          agents={agents}
          agentsLoading={loading}
          createTask={handleCreateTask}
        />
        <div className="mt-7">
        {loading ? (
          <TableListLoading label="Loading tasks" />
        ) : total === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">
            {search ? "No tasks match your current search." : "No tasks yet. Create your first task above."}
          </p>
        ) : (
          <>
            <TasksTable tasks={tasks} cancelTask={cancelTask} />
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
