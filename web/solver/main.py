# solver/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Dict, Tuple
from ortools.sat.python import cp_model

app = FastAPI(title="Timetable Solver")


class Unavail(BaseModel):
    day: str
    slotIndexes: List[int]


class Teacher(BaseModel):
    id: int
    name: str
    maxHoursPerWeek: int
    unavailable: List[Unavail] = []


class Subject(BaseModel):
    id: int
    code: str
    name: str
    requiresRoomType: Optional[str] = None


class Room(BaseModel):
    id: int
    name: str
    capacity: int
    roomType: str


class Group(BaseModel):
    id: int
    name: str
    size: int


class Assignment(BaseModel):
    id: int
    subjectId: int
    teacherId: int
    groupId: int
    requiredPeriods: int


class Timeslot(BaseModel):
    id: int
    day: str
    index: int


class SolveInput(BaseModel):
    term: str
    teachers: List[Teacher]
    subjects: List[Subject]
    rooms: List[Room]
    groups: List[Group]
    assignments: List[Assignment]
    timeslots: List[Timeslot]


class Lesson(BaseModel):
    subjectId: int
    teacherId: int
    groupId: int
    roomId: int
    timeslotId: int


class SolveOutput(BaseModel):
    lessons: List[Lesson]
    objectiveScore: Optional[int] = None
    notes: Optional[List[str]] = None


def _maps(inp: SolveInput):
    subj = {s.id: s for s in inp.subjects}
    teacher = {t.id: t for t in inp.teachers}
    group = {g.id: g for g in inp.groups}
    room = {r.id: r for r in inp.rooms}
    tslot = {t.id: t for t in inp.timeslots}
    return subj, teacher, group, room, tslot


@app.get("/")
def health():
    return {"ok": True}


@app.post("/solve", response_model=SolveOutput)
def solve(inp: SolveInput):
    subj, teacher, group, room, tslot = _maps(inp)

    model = cp_model.CpModel()

    # สร้าง "คลาส" ย่อยตาม requiredPeriods
    classes: List[Tuple[int, int, int, int]] = []  # (subjectId, teacherId, groupId, assignId)
    for a in inp.assignments:
        for _k in range(a.requiredPeriods):
            classes.append((a.subjectId, a.teacherId, a.groupId, a.id))

    T = inp.timeslots
    R = inp.rooms

    # ตัวแปร x[c, t, r] ∈ {0,1}
    X: Dict[Tuple[int, int, int], cp_model.IntVar] = {}
    for ci in range(len(classes)):
        for ti in range(len(T)):
            for ri in range(len(R)):
                X[(ci, ti, ri)] = model.NewBoolVar(f"x_c{ci}_t{ti}_r{ri}")

    # (1) 1 คลาสต้องวางที่เดียว
    for ci in range(len(classes)):
        model.Add(sum(X[(ci, ti, ri)] for ti in range(len(T)) for ri in range(len(R))) == 1)

    # (2) ครูห้ามชนคาบ
    teacher_to_classidx: Dict[int, List[int]] = {}
    for ci, (_sid, tid, _gid, _aid) in enumerate(classes):
        teacher_to_classidx.setdefault(tid, []).append(ci)
    for ti in range(len(T)):
        for tid, clist in teacher_to_classidx.items():
            model.Add(sum(X[(ci, ti, ri)] for ci in clist for ri in range(len(R))) <= 1)

    # (3) กลุ่ม/นักเรียนห้ามชนคาบ
    group_to_classidx: Dict[int, List[int]] = {}
    for ci, (_sid, _tid, gid, _aid) in enumerate(classes):
        group_to_classidx.setdefault(gid, []).append(ci)
    for ti in range(len(T)):
        for gid, clist in group_to_classidx.items():
            model.Add(sum(X[(ci, ti, ri)] for ci in clist for ri in range(len(R))) <= 1)

    # (4) ห้อง: ความจุ + ประเภท
    for ci, (sid, _tid, gid, _aid) in enumerate(classes):
        req_type = subj[sid].requiresRoomType
        size = group[gid].size
        for ri, r in enumerate(R):
            if r.capacity < size or (req_type and r.roomType != req_type):
                for ti in range(len(T)):
                    model.Add(X[(ci, ti, ri)] == 0)

    # (5) ครูไม่สะดวก
    for ci, (_sid, tid, _gid, _aid) in enumerate(classes):
        t = teacher[tid]
        forbidden_ts = set()
        for u in t.unavailable:
            for ti, ts in enumerate(T):
                if ts.day == u.day and ts.index in u.slotIndexes:
                    forbidden_ts.add(ti)
        for ti in forbidden_ts:
            for ri in range(len(R)):
                model.Add(X[(ci, ti, ri)] == 0)

    # (6) Objective ง่าย ๆ: เลี่ยงคาบแรกของวัน
    penalty = []
    for ci in range(len(classes)):
        for ti, ts in enumerate(T):
            if ts.index == 1:
                for ri in range(len(R)):
                    penalty.append(X[(ci, ti, ri)])
    model.Minimize(sum(penalty))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0

    res = solver.Solve(model)
    if res not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveOutput(lessons=[], notes=["No feasible solution"])

    lessons: List[Lesson] = []
    for ci, (sid, tid, gid, _aid) in enumerate(classes):
        for ti in range(len(T)):
            for ri in range(len(R)):
                if solver.Value(X[(ci, ti, ri)]) == 1:
                    lessons.append(
                        Lesson(
                            subjectId=sid,
                            teacherId=tid,
                            groupId=gid,
                            roomId=R[ri].id,
                            timeslotId=T[ti].id,
                        )
                    )

    obj = solver.ObjectiveValue()
    return SolveOutput(
        lessons=lessons,
        objectiveScore=int(obj) if obj is not None else None,
        notes=[f"classes={len(classes)}"],
    )
