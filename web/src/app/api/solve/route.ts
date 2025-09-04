// web/src/app/api/solve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SolveInput, SolveOutput } from "@/lib/types";
import axios from "axios";

// ---- Helper: type guards (no any) ----
type Unavail = { day: string; slotIndexes: number[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isUnavail(v: unknown): v is Unavail {
  if (!isRecord(v)) return false;
  const dayOk = typeof v.day === "string";
  const slots = v.slotIndexes;
  const slotsOk = Array.isArray(slots) && slots.every((n) => typeof n === "number");
  return dayOk && slotsOk;
}
function parseUnavail(v: unknown): Unavail[] {
  return Array.isArray(v) ? v.filter(isUnavail) : [];
}

// ---- Type aliases from prisma return types (ไม่พึ่ง @prisma/client model types) ----
type DbTeacher = Awaited<ReturnType<typeof prisma.teacher.findMany>>[number];
type DbSubject = Awaited<ReturnType<typeof prisma.subject.findMany>>[number];
type DbRoom = Awaited<ReturnType<typeof prisma.room.findMany>>[number];
type DbGroup = Awaited<ReturnType<typeof prisma.group.findMany>>[number];
type DbAssignment = Awaited<ReturnType<typeof prisma.teachingAssignment.findMany>>[number];
type DbTimeslot = Awaited<ReturnType<typeof prisma.timeslot.findMany>>[number];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { term?: string };
    const term = body.term ?? "2025-T1";

    const teachers: DbTeacher[] = await prisma.teacher.findMany();
    const subjects: DbSubject[] = await prisma.subject.findMany();
    const rooms: DbRoom[] = await prisma.room.findMany();
    const groups: DbGroup[] = await prisma.group.findMany();
    const assignments: DbAssignment[] = await prisma.teachingAssignment.findMany();
    const timeslots: DbTimeslot[] = await prisma.timeslot.findMany({
      orderBy: [{ day: "asc" }, { index: "asc" }],
    });

    const input: SolveInput = {
      term,
      teachers: teachers.map((t: DbTeacher) => ({
        id: t.id,
        name: t.name,
        maxHoursPerWeek: t.maxHoursPerWeek,
        unavailable: parseUnavail(t.unavailableJson as unknown),
      })),
      subjects: subjects.map((s: DbSubject) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        requiresRoomType: s.requiresRoomType ? String(s.requiresRoomType) : undefined,
      })),
      rooms: rooms.map((r: DbRoom) => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        roomType: String(r.roomType),
      })),
      groups: groups.map((g: DbGroup) => ({ id: g.id, name: g.name, size: g.size })),
      assignments: assignments.map((a: DbAssignment) => ({
        id: a.id,
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        groupId: a.groupId,
        requiredPeriods: a.requiredPeriods,
      })),
      timeslots: timeslots.map((t: DbTimeslot) => ({
        id: t.id,
        day: String(t.day),
        index: t.index,
      })),
    };

    const url = process.env.SOLVER_API_URL;
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "SOLVER_API_URL is not set" },
        { status: 500 }
      );
    }

    const { data } = await axios.post<SolveOutput>(url, input, { timeout: 60_000 });

    const schedule = await prisma.schedule.create({ data: { term, status: "DRAFT" } });

    if (data.lessons?.length) {
      await prisma.$transaction(
        data.lessons.map((L) =>
          prisma.lesson.create({
            data: {
              scheduleId: schedule.id,
              subjectId: L.subjectId,
              teacherId: L.teacherId,
              groupId: L.groupId,
              roomId: L.roomId,
              timeslotId: L.timeslotId,
            },
          })
        )
      );
    }

    return NextResponse.json({
      ok: true,
      scheduleId: schedule.id,
      count: data.lessons?.length ?? 0,
      objectiveScore: data.objectiveScore,
      notes: data.notes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
