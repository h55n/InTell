import { z } from 'zod';

export const InvestigateSchema = z.object({
  input: z.string().min(2).max(300).trim(),
  inputType: z.enum(['phone', 'email', 'name', 'business']).optional(),
});

export const BulkSchema = z.object({
  inputs: z.array(InvestigateSchema).min(1).max(50),
});
