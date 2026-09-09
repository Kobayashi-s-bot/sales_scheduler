import { z } from "zod";

const contactFields = {
  organizationId: z.uuid(), companyId: z.uuid(), fullName: z.string().trim().max(200).optional(), department: z.string().trim().max(200).optional(),
  email: z.email().max(320).optional().or(z.literal("")), phone: z.string().trim().max(50).optional(),
};
export const contactInputSchema = z.object(contactFields).strict();
export const contactUpdateSchema = z.object({ ...contactFields, contactId: z.uuid() }).strict();
