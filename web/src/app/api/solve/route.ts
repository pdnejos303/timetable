// web/src/app/api/solve/route.ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { prisma } from "@/lib/prisma";
import type {
  SolveInput,
  SolveOutput,
  Unavail,
  LessonOut,
  SolverConfig,
} from "@/lib/types";

const SOLVER_API_URL =
  process.env.SOLVER_API_URL?.trim() || "http://localhost:8000/solve";
const SOLVER_TIMEOUT_MS = Number(process.env.SOLVER_TIMEOUT_MS || 60_000);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseUnavail(jsonValue: unknown): Unavail[] {
  if (!jsonValue) return [];
  try {
    const arr = Array.isArray(jsonValue) ? jsonValue : JSON.parse(String(jsonValue));
    if (!Array.isArray(arr)) return [];
    const result: Unavail[] = [];
    for (const item of arr) {
      if (!isRecord(item)) continue;
      const day = typeof item.day === "string" ? item.day : null;
      const slots = Array.isArray(item.slotIndexes)
        ? (item.slotIndexes as unknown[]).filter((x) => Number.isInteger(x)).map((x) => Number(x))
        : [];
      if (day) result.push({ day, slotIndexes: slots });
    }
    return result;
  } catch {
    return [];
  }
}

async function buildGroupParallels(term: string): Promise<Map<number, number[]>> {
  // โหลด edges จากตาราง groupParallel (หนึ่งครั้งพอ)
  const edges = await prisma.groupParallel.findMany({
    where: { term },
    select: { groupAId: true, groupBId: true },
  });

  const adj = new Map<number, Set<number>>();
  for (const e of edges) {
    if (!adj.has(e.groupAId)) adj.set(e.groupAId, new Set());
    if (!adj.has(e.groupBId)) adj.set(e.groupBId, new Set());
    adj.get(e.groupAId)!.add(e.groupBId);
    adj.get(e.groupBId)!.add(e.groupAId);
  }

  const parallelMap = new Map<number, number[]>();
  for (const [gid, set] of adj) parallelMap.set(gid, Array.from(set));
  return parallelMap;
}

function dayToString(day: string): string {
  return String(day).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      term?: string;
      config?: Partial<SolverConfig>;
    };
    const term = body.term?.trim() || "2025-T1";

    const [teachers, subjects, rooms, groups, assignments, timeslots] =
      await Promise.all([
        prisma.teacher.findMany({}),
        prisma.subject.findMany({}),
        prisma.room.findMany({}),
        prisma.group.findMany({}),
        prisma.teachingAssignment.findMany({
          where: { OR: [{ term }, { term: null }] },
        }),
        prisma.timeslot.findMany({
          orderBy: [{ day: "asc" }, { index: "asc" }],
        }),
      ]);

    const assignmentKey = (a: {
      subjectId: number;
      teacherId: number;
      groupId: number;
      term: string | null;
    }) => `${a.subjectId}:${a.teacherId}:${a.groupId}:${a.term ?? ""}`;

    const assignmentMap = new Map<string, number>();
    for (const a of assignments) {
      assignmentMap.set(
        assignmentKey({
          subjectId: a.subjectId,
          teacherId: a.teacherId,
          groupId: a.groupId,
          term: a.term ?? null,
        }),
        a.id
      );
    }

    const parallelMap = await buildGroupParallels(term);

    const input: SolveInput = {
      timeslots: timeslots.map((t) => ({
        id: t.id,
        day: dayToString(t.day),
        index: t.index,
        // isBreak: ไม่มีใน DB ตอนนี้ หากมีฟิลด์ค่อย map เพิ่ม
      })),
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name ?? undefined,
        capacity: r.capacity,
        roomType: r.roomType ?? undefined,
      })),
      teachers: teachers.map((t) => ({
        id: t.id,
        name: t.name ?? undefined,
        maxHoursPerWeek: t.maxHoursPerWeek ?? undefined,
        // maxPeriodsPerDay: ยังไม่มีใน schema → undefined
        unavailable: parseUnavail(t.unavailableJson as unknown),
      })),
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name ?? undefined,
        roomType: s.requiresRoomType ? String(s.requiresRoomType) : undefined,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name ?? undefined,
        size: g.size,
        parallelWithIds: parallelMap.get(g.id) ?? [],   // ★★ FIX: ใส่ให้ครบตาม GroupIn
        // maxPeriodsPerDay / unavailable: ยังไม่มีใน schema
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        groupId: a.groupId,
        requiredPeriods: a.requiredPeriods ?? 1,
        // doublePeriod / preferredRoomType: ยังไม่มีใน schema
      })),
      config: {
        subjectPerDayLimit: body.config?.subjectPerDayLimit ?? 1,
        avoidFirstPeriod: body.config?.avoidFirstPeriod ?? true,
        avoidLastPeriod: body.config?.avoidLastPeriod ?? true,
        avoidIndices: body.config?.avoidIndices ?? [],
        solverTimeLimitSec:
          body.config?.solverTimeLimitSec ??
          Number(process.env.SOLVER_TIME_LIMIT_SEC || 15),
        randomSeed: body.config?.randomSeed,
        parallelPolicy: body.config?.parallelPolicy ?? "BLOCK",
      },
    };

    const { data } = await axios.post<SolveOutput>(SOLVER_API_URL, input, {
      timeout: SOLVER_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });

    if (!data || !Array.isArray(data.lessons) || data.lessons.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solver ไม่ได้คืน lessons — ตรวจสอบคอนสเตรนต์/ข้อมูลอินพุต",
          notes: data?.notes ?? [],
        },
        { status: 400 }
      );
    }

    const schedule = await prisma.$transaction(async (tx) => {
      const sc = await tx.schedule.create({
        data: {
          term,
          notes: (data.notes ?? []) as unknown as string,
        },
      });

      const lessonRows = (data.lessons as LessonOut[]).map((L) => {
        const akey = assignmentKey({
          subjectId: L.subjectId,
          teacherId: L.teacherId,
          groupId: L.groupId,
          term,
        });
        const assignmentId = assignmentMap.get(akey) ?? null;

        return {
          scheduleId: sc.id,
          subjectId: L.subjectId,
          teacherId: L.teacherId,
          groupId: L.groupId,
          roomId: L.roomId,
          timeslotId: L.timeslotId,
          assignmentId,
        };
      });

      await tx.lesson.createMany({ data: lessonRows, skipDuplicates: true });

      return sc;
    });

    return NextResponse.json({
      ok: true,
      scheduleId: schedule.id,
      count: data.lessons.length,
      objectiveScore: data.objectiveScore,
      notes: data.notes,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
