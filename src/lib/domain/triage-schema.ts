import { z } from "zod";

const roleFitSchema = z.object({
  pm: z.string().min(1),
  eng: z.string().min(1),
  res: z.string().min(1)
});

const timeSensitivitySchema = z.object({
  label: z.enum(["NOW", "LATER", "IGNORE"]),
  miss_cost: z.enum(["LOW", "MEDIUM", "HIGH"])
});

const scoresSchema = z.object({
  actionability: z.number().int().min(0).max(100),
  hype_noise: z.number().int().min(0).max(100)
});

const oneStepTaskSchema = z.object({
  task: z.string().min(1),
  done_definition: z.string().min(1),
  estimated_minutes: z.number().int().min(10).max(45)
});

const policyTraceSchema = z.object({
  final_label: z.enum(["NOW", "LATER", "IGNORE"]),
  rule_id: z.enum(["SAFE_MODE", "R1", "R2", "R3", "FALLBACK"]),
  consistency: z.enum(["PASS", "ADJUSTED"])
});

export const triageSchema = z.object({
  role_fit: roleFitSchema,
  time_sensitivity: timeSensitivitySchema,
  scores: scoresSchema,
  recommended_action: z.enum(["READ_NOW", "SCHEDULE", "IGNORE", "ASK_SOMEONE"]),
  one_step_task: oneStepTaskSchema,
  reasons: z.array(z.string().min(1)).min(1).max(3),
  policy_trace: policyTraceSchema
});

export type TriageInput = z.infer<typeof triageSchema>;
