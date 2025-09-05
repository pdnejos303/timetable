// web/src/lib/types.ts
/**
 * Timetable Solver I/O Types (TS mirror of FastAPI Pydantic models)
 * แบบฟอร์มข้อมูลที่ส่งให้/รับจากตัวแก้ตาราง (solver)
 *
 * หมายเหตุ:
 * - ใช้ string สำหรับ day ("MON" | "TUE" | ... ) ให้ตรงกับ enum DayOfWeek ของ Prisma
 * - index ของคาบ ใช้ตัวเลขตาม DB (ใน schema ใช้ 1..N ภายในวัน)
 */

export type Unavail = {
  /** เช่น "MON" | "TUE" | ... */
  day: string;
  /** ดัชนีคาบที่ไม่สะดวก (ภายในวันนั้น ๆ) เช่น [1,2] */
  slotIndexes: number[];
};

export type TeacherIn = {
  id: number;
  name?: string;
  /** เพดานชั่วโมงสอน/สัปดาห์ (ถ้าไม่ระบุ = ไม่จำกัด) */
  maxHoursPerWeek?: number;
  /** เพดานคาบ/วัน (optional) */
  maxPeriodsPerDay?: number;
  /** ช่วงเวลาที่ครูไม่สะดวกสอน */
  unavailable: Unavail[];
};

export type SubjectIn = {
  id: number;
  name?: string;
  /**
   * ประเภทห้องที่วิชาต้องใช้ (ถ้ามี) เช่น "LECTURE" | "LAB" | "SEMINAR"
   * แม็ปมาจาก Subject.requiresRoomType ใน Prisma
   */
  roomType?: string;
};

export type RoomIn = {
  id: number;
  name?: string;
  capacity: number;
  /** "LECTURE" | "LAB" | "SEMINAR" | ... */
  roomType?: string;
};

export type TimeslotIn = {
  id: number;
  /** "MON" | "TUE" | ... */
  day: string;
  /** ดัชนีคาบภายในวัน (ในสคีมาใช้ 1..N) */
  index: number;
  /** เป็นคาบพัก/ปิดระบบหรือไม่ (optional) */
  isBreak?: boolean;
};

export type GroupIn = {
  id: number;
  name?: string;
  size: number;
  /** กลุ่มที่ถือเป็น cluster คู่ขนาน (BLOCK policy = ไม่ให้ชนกัน) */
  parallelWithIds: number[];
  /** เพดานคาบ/วัน (optional) */
  maxPeriodsPerDay?: number;
  /** ไม่สะดวก (optional) – ปัจจุบันสคีมาไม่มี ฟิลด์นี้จะเว้นว่างไว้ */
  unavailable?: Unavail[];
};

export type AssignmentIn = {
  id: number;
  subjectId: number;
  teacherId: number;
  groupId: number;
  /** จำนวนคาบรวมที่ต้องเปิดในสัปดาห์ */
  requiredPeriods: number;
  /** วิชาปฏิบัติที่ต้องลง 2 คาบติดกัน (ถ้ามี) */
  doublePeriod?: boolean;
  /** override roomType เฉพาะคลาสนี้ (optional) */
  preferredRoomType?: string | null;
};

export type SolverConfig = {
  /** จำกัดวิชาเดียวกัน/วัน/กลุ่ม ไม่เกิน n คาบ (ดีฟอลต์ 1) */
  subjectPerDayLimit?: number;
  /** ลดการใช้คาบแรกของวัน */
  avoidFirstPeriod?: boolean;
  /** ลดการใช้คาบสุดท้ายของวัน */
  avoidLastPeriod?: boolean;
  /** ดัชนีคาบอื่น ๆ ที่อยากเลี่ยง (soft) เช่น [2,7] */
  avoidIndices?: number[];
  /** จำกัดเวลาแก้ (วินาที) */
  solverTimeLimitSec?: number;
  /** seed สำหรับสุ่มคำตอบ */
  randomSeed?: number;
  /** นโยบายคู่ขนาน "BLOCK" | "SYNC"(ยังไม่ทำ) */
  parallelPolicy?: "BLOCK" | "SYNC";
};

export type SolveInput = {
  timeslots: TimeslotIn[];
  rooms: RoomIn[];
  teachers: TeacherIn[];
  subjects: SubjectIn[];
  groups: GroupIn[];
  assignments: AssignmentIn[];
  config?: SolverConfig;
};

export type LessonOut = {
  subjectId: number;
  teacherId: number;
  groupId: number;
  roomId: number;
  timeslotId: number;
};

export type SolveOutput = {
  lessons: LessonOut[];
  /** ค่าคะแนนของ soft objective (ยิ่งต่ำยิ่งดี) */
  objectiveScore?: number;
  /** ข้อความบันทึก/ดีบักจาก solver */
  notes?: string[];
};
