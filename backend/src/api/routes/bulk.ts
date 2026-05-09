import { Router } from 'express';
import { z } from 'zod';
import { processBulk, getJob } from '../../services/bulkQueue.js';

const router = Router();

const BulkSchema = z.object({
  inputs: z
    .array(
      z.object({
        input: z.string().min(2).max(300).trim(),
        inputType: z.enum(['phone', 'email', 'name', 'business']).optional(),
      })
    )
    .min(1)
    .max(50),
});

/** POST /api/bulk — submit a batch job */
router.post('/', async (req, res) => {
  const parsed = BulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  const { inputs } = parsed.data;
  const jobId = await processBulk(inputs);
  return res.json({ jobId, total: inputs.length, status: 'running' });
});

/** GET /api/bulk/:jobId — poll job progress */
router.get('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  return res.json(job);
});

export default router;
