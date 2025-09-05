// web/src/app/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import GenerateButton from "@/components/solve/GenerateButton";

type LatestScheduleRow = {
  id: number;
  term: string | null;
  createdAt: Date;
  _count: { lessons: number };
};

async function getDashboardData() {
  const [scheduleCount, lessonCount, latestSchedulesRaw] = await Promise.all([
    prisma.schedule.count(),
    prisma.lesson.count(),
    prisma.schedule.findMany({
      orderBy: { createdAt: "asc" }, // หรือ "desc" ตามต้องการ
      take: 10,
      select: { id: true, term: true, createdAt: true, _count: { select: { lessons: true } } },
    }),
  ]);

  // ช่วยให้ type ชัดเจน
  const latestSchedules = latestSchedulesRaw as LatestScheduleRow[];

  return { scheduleCount, lessonCount, latestSchedules };
}

export default async function HomePage() {
  const { scheduleCount, lessonCount, latestSchedules } = await getDashboardData();

  return (
    <main className="p-6 mx-auto max-w-6xl space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timetable — Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Generate timetable with OR-Tools and manage schedules.
          </p>
        </div>
        <div className="flex gap-3">
          <GenerateButton />
          <Link href="/schedule" className="rounded-lg border px-4 py-2 hover:bg-accent">
            Browse
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Schedules</div>
          <div className="text-2xl font-semibold">{scheduleCount}</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Lessons</div>
          <div className="text-2xl font-semibold">{lessonCount}</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Solver</div>
          <div className="text-sm">
            <code>{process.env.SOLVER_API_URL ?? "http://localhost:8000/solve"}</code>
          </div>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-2">How to generate</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li>Ensure Timeslots, Rooms, Teachers, Subjects, Groups, Assignments exist.</li>
          <li>Click <b>Generate Schedule</b> and select term & options.</li>
          <li>Open created schedule and inspect grid view.</li>
        </ol>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Latest Schedules</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Term</th>
                <th className="py-2 pr-4">Lessons</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {latestSchedules.map((s: LatestScheduleRow) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">#{s.id}</td>
                  <td className="py-2 pr-4">{s.term}</td>
                  <td className="py-2 pr-4">{s._count.lessons}</td>
                  <td className="py-2 pr-4">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/schedule/${s.id}?view=room`}
                      className="rounded border px-3 py-1 hover:bg-accent"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {latestSchedules.length === 0 && (
                <tr>
                  <td className="py-4 text-sm text-muted-foreground" colSpan={5}>
                    No schedules yet — click <b>Generate Schedule</b>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
