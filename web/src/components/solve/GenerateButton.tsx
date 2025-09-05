// web/src/components/solve/GenerateButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function GenerateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("2025-T1");
  const [subjectPerDayLimit, setSubjectPerDayLimit] = useState(1);
  const [avoidFirst, setAvoidFirst] = useState(true);
  const [avoidLast, setAvoidLast] = useState(true);
  const [timeLimit, setTimeLimit] = useState(15);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function runSolve() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term,
            config: {
              subjectPerDayLimit,
              avoidFirstPeriod: avoidFirst,
              avoidLastPeriod: avoidLast,
              solverTimeLimitSec: timeLimit,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Solve failed");
        }
        setMsg(`✅ สร้างสำเร็จ: Schedule #${data.scheduleId} (Lessons=${data.count})`);
        setOpen(false);
        router.refresh();
      } catch (e: unknown) {
        const err = e as Error;
        setMsg(`❌ ${err?.message ?? String(e)}`);
      }
    });
  }

  return (
    <>
      <button
        className="rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:opacity-90"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "Solving..." : "Generate Schedule"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-background border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Solver Options</h3>
              <button
                className="rounded border px-2 py-1 text-xs"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span>Term</span>
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="rounded border px-2 py-1"
                  placeholder="2025-T1"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span>Subject/Day limit</span>
                <input
                  type="number"
                  min={1}
                  value={subjectPerDayLimit}
                  onChange={(e) => setSubjectPerDayLimit(parseInt(e.target.value || "1"))}
                  className="rounded border px-2 py-1"
                />
              </label>

              <label className="flex items-center gap-2 col-span-1">
                <input
                  type="checkbox"
                  checked={avoidFirst}
                  onChange={(e) => setAvoidFirst(e.target.checked)}
                />
                <span>Avoid first period</span>
              </label>

              <label className="flex items-center gap-2 col-span-1">
                <input
                  type="checkbox"
                  checked={avoidLast}
                  onChange={(e) => setAvoidLast(e.target.checked)}
                />
                <span>Avoid last period</span>
              </label>

              <label className="flex flex-col gap-1 col-span-2">
                <span>Time limit (sec)</span>
                <input
                  type="number"
                  min={5}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value || "15"))}
                  className="rounded border px-2 py-1"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                Solver: {process.env.NEXT_PUBLIC_SOLVER_API_URL ?? "internal /api/solve"}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border px-3 py-2"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded bg-primary text-primary-foreground px-4 py-2"
                  onClick={runSolve}
                  disabled={isPending}
                >
                  {isPending ? "Running..." : "Run"}
                </button>
              </div>
            </div>

            {msg && <div className="text-sm">{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}
