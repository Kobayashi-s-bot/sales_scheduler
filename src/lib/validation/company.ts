import { z } from "zod";

export const companyInputSchema = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  websiteUrl: z.url().max(2048).optional(),
  industry: z.string().trim().max(100).optional(),
}).strict();

export type CompanyInput = z.infer<typeof companyInputSchema>;
