// src/lib/types.ts
export type SolveInput = {
term: string;
teachers: {
id: number; name: string; maxHoursPerWeek: number;
unavailable: { day: string; slotIndexes: number[] }[];
}[];
subjects: { id: number; code: string; name: string; requiresRoomType?: string }[];
rooms: { id: number; name: string; capacity: number; roomType: string }[];
groups: { id: number; name: string; size: number }[];
assignments: { id: number; subjectId: number; teacherId: number; groupId: number; requiredPeriods: number }[];
timeslots: { id: number; day: string; index: number }[];
};


export type SolveOutput = {
lessons: {
subjectId: number; teacherId: number; groupId: number; roomId: number; timeslotId: number;
}[];
objectiveScore?: number; // optional สำหรับ soft constraints
notes?: string[];
};