import { z } from "zod";

export const companyInputSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  websiteUrl: z.url().max(2048).optional().or(z.literal("")),
  industry: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
}).strict();

export const companyUpdateSchema = companyInputSchema.extend({ companyId: z.uuid() }).strict();

export type CompanyInput = z.infer<typeof companyInputSchema>;
