// web/prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"] as const;
type RoomTypeLit = "LECTURE" | "LAB" | "SEMINAR";

async function main(): Promise<void> {
  const times: [string, string][] = [
    ["08:00", "08:50"],
    ["09:00", "09:50"],
    ["10:00", "10:50"],
    ["11:00", "11:50"],
    ["13:00", "13:50"],
    ["14:00", "14:50"],
  ];

  for (const day of DAYS) {
    for (let i = 0; i < times.length; i++) {
      const [s, e] = times[i];
      await prisma.timeslot.upsert({
        where: { day_index: { day: (day as unknown as never), index: i + 1 } },
        update: {},
        create: {
          day: (day as unknown as never),
          index: i + 1,
          startTime: s,
          endTime: e,
        },
      });
    }
  }

  const tAlice = await prisma.teacher.upsert({
    where: { name: "Alice" },
    update: {},
    create: {
      name: "Alice",
      dept: "Math",
      maxHoursPerWeek: 10,
      unavailableJson: [{ day: "MON", slotIndexes: [1] }],
    },
  });

  const tBob = await prisma.teacher.upsert({
    where: { name: "Bob" },
    update: {},
    create: { name: "Bob", dept: "CS", maxHoursPerWeek: 12 },
  });

  const sMath = await prisma.subject.upsert({
    where: { code: "MATH101" },
    update: {},
    create: {
      code: "MATH101",
      name: "Calculus I",
      periodsPerWeek: 3,
      requiresRoomType: ("LECTURE" as RoomTypeLit as unknown as never),
    },
  });

  const sProg = await prisma.subject.upsert({
    where: { code: "CS102" },
    update: {},
    create: {
      code: "CS102",
      name: "Intro Programming",
      periodsPerWeek: 3,
      requiresRoomType: ("LAB" as RoomTypeLit as unknown as never),
    },
  });

  await prisma.room.upsert({
    where: { name: "R-101" },
    update: {},
    create: {
      name: "R-101",
      capacity: 40,
      roomType: ("LECTURE" as RoomTypeLit as unknown as never),
    },
  });
  await prisma.room.upsert({
    where: { name: "Lab-A" },
    update: {},
    create: {
      name: "Lab-A",
      capacity: 30,
      roomType: ("LAB" as RoomTypeLit as unknown as never),
    },
  });
  await prisma.room.upsert({
    where: { name: "R-102" },
    update: {},
    create: {
      name: "R-102",
      capacity: 50,
      roomType: ("LECTURE" as RoomTypeLit as unknown as never),
    },
  });

  const g1 = await prisma.group.upsert({
    where: { name: "CPE1" },
    update: {},
    create: { name: "CPE1", dept: "CPE", level: 1, size: 35 },
  });

  await prisma.teachingAssignment.upsert({
    where: {
      subjectId_teacherId_groupId: {
        subjectId: sMath.id,
        teacherId: tAlice.id,
        groupId: g1.id,
      },
    },
    update: {},
    create: {
      subjectId: sMath.id,
      teacherId: tAlice.id,
      groupId: g1.id,
      requiredPeriods: 3,
    },
  });

  await prisma.teachingAssignment.upsert({
    where: {
      subjectId_teacherId_groupId: {
        subjectId: sProg.id,
        teacherId: tBob.id,
        groupId: g1.id,
      },
    },
    update: {},
    create: {
      subjectId: sProg.id,
      teacherId: tBob.id,
      groupId: g1.id,
      requiredPeriods: 3,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
