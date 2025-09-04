// web/src/app/admin/page.tsx
"use client";
import { useState } from "react";

type SolveResponse = {
  ok: boolean;
  scheduleId?: number;
  count?: number;
  objectiveScore?: number;
  notes?: string[];
  error?: string;
};

export default function AdminPage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");

  async function runSolve(): Promise<void> {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: "2025-T1" }),
      });

      const json: SolveResponse = await res.json();

      if (!res.ok || !json.ok) {
        const errMsg = json.error ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const { scheduleId, count, objectiveScore } = json;
      setMsg(
        `สร้าง Schedule #${scheduleId ?? "-"} จำนวนคาบ ${count ?? 0}${
          objectiveScore !== undefined ? ` | score=${objectiveScore}` : ""
        }`
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setMsg(`ERROR: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Timetable Admin</h1>
      <button
        disabled={loading}
        onClick={runSolve}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? "Solving…" : "Solve (สร้างตาราง)"}
      </button>
      {msg && <pre className="p-3 bg-gray-100 rounded border whitespace-pre-wrap">{msg}</pre>}
      <p className="text-sm text-gray-600">
        * หน้านี้เป็นตัวอย่างเริ่มต้น แสดงวิธีเรียก solver และบันทึกผล
      </p>
    </main>
  );
}
