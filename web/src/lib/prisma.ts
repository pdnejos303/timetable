// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";


// ป้องกัน hot-reload สร้างหลาย instance ใน dev
const globalForPrisma = global as unknown as { prisma?: PrismaClient };


export const prisma = globalForPrisma.prisma ?? new PrismaClient({});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;