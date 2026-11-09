import { z } from "zod";
const uuid = z.uuid();
export const candidateListSchema = z.object({ organizationId: uuid, status: z.enum(["pending","accepted","rejected"]).optional(), companyId: uuid.optional() }).strict();
export const candidateAcceptSchema = z.object({ organizationId: uuid, eventType: z.string().trim().min(1).max(100).optional(), occurredOn: z.iso.date().optional(), title: z.string().trim().min(1).max(300).optional() }).strict();
export const candidateRejectSchema = z.object({ organizationId: uuid }).strict();
