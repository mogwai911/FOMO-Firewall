import { z } from "zod";

export const profileRoleSchema = z.enum(["PM", "ENG", "RES"]);

const hypeWordSchema = z.string().trim().min(1).max(64);

export const profileUpsertSchema = z.object({
  role: profileRoleSchema,
  timeBudgetMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  hypeWords: z.array(hypeWordSchema).max(50).nullable().optional()
});

export type ProfileUpsertInput = z.infer<typeof profileUpsertSchema>;
export type ProfileRole = z.infer<typeof profileRoleSchema>;
