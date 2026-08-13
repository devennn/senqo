import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppFrame } from "@/components/layout/app-frame";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { useAgents } from "@/hooks/useAgents";
import { EVALS_UI_PAGE_SIZE, useEvals } from "@/hooks/useEvals";
import { CreateEvalDialog } from "@/pages/dashboard/evals/components/create-eval-dialog";
import { EvalDetail } from "@/pages/dashboard/evals/components/eval-detail";
import { EvalsSidebar } from "@/pages/dashboard/evals/components/evals-sidebar";

export default function EvalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: agentsData, loading: agentsLoading } = useAgents();
  const agents = agentsData.agents.map((agent) => ({
    id: agent.id,
    name: agent.profile_name,
  }));
  const [agentId, setAgentId] = useState("");
  const selectedId = searchParams.get("evalId");
  const {
    cases,
    total,
    loading,
    page,
    setPage,
    selectedCase,
    createManual,
    updateExpected,
    updateTurns,
    updateDetails,
    remove,
    run,
    runningId,
  } = useEvals(agentId || null, selectedId);

  useEffect(() => {
    if (agentId || agents.length === 0) return;
    setAgentId(agents[0].id);
  }, [agentId, agents]);

  useEffect(() => {
    if (!selectedCase) return;
    if (selectedCase.agentId !== agentId) {
      setAgentId(selectedCase.agentId);
      setPage(1);
    }
  }, [agentId, selectedCase, setPage]);

  const selected = selectedCase ?? cases[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(total / EVALS_UI_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  function selectEval(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set("evalId", id);
    setSearchParams(next, { replace: true });
  }

  function changeAgent(nextAgentId: string): void {
    setAgentId(nextAgentId);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete("evalId");
    setSearchParams(next, { replace: true });
  }

  return (
    <AppFrame
      conversations={[]}
      messages={[]}
      hideConversationRail
      mainPanel={
        <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">Evals</h1>
                <InlineHelpHint label="About evals">
                  <p>
                    Test cases for one agent at a time. Create manually, or capture a bad chat reply
                    with feedback so AI can draft a case. Run uses the same agent loop as live chats;
                    a judge scores pass or fail.
                  </p>
                </InlineHelpHint>
              </div>
              <p className="mt-1.5 text-base text-muted-foreground">
                Build and review expected replies for a single agent.
              </p>
            </div>
            <CreateEvalDialog
              agents={agents}
              defaultAgentId={agentId}
              onCreate={(input) => {
                void createManual(input).then((created) => {
                  setAgentId(created.agentId);
                  selectEval(created.id);
                });
              }}
            />
          </div>

          <div className="mt-5 grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col">
              <EvalsSidebar
                agents={agents}
                agentId={agentId}
                agentsLoading={agentsLoading}
                onAgentChange={changeAgent}
                cases={cases}
                selectedId={selected?.id ?? null}
                loading={loading}
                page={safePage}
                total={total}
                onPage={setPage}
                onSelect={selectEval}
              />
            </div>
            <div className="flex min-h-0 flex-col">
              {selected ? (
                <EvalDetail
                  evalCase={selected}
                  onSaveExpected={(id, expectedReply) => {
                    void updateExpected(id, expectedReply);
                  }}
                  onSaveTurns={(id, turns) => {
                    void updateTurns(id, turns);
                  }}
                  onSaveDetails={async (id, input) => {
                    await updateDetails(id, input);
                  }}
                  onDelete={async (id) => {
                    await remove(id);
                    const next = new URLSearchParams(searchParams);
                    next.delete("evalId");
                    setSearchParams(next, { replace: true });
                  }}
                  onRun={(id) => {
                    void run(id);
                  }}
                  running={runningId === selected.id}
                />
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  {agents.length === 0 ? "Create an agent first." : "No evals for this agent yet."}
                </p>
              )}
            </div>
          </div>
        </section>
      }
    />
  );
}
