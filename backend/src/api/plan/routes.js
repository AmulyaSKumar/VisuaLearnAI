/**
 * Plan Routes
 * Learning plan generation endpoints
 * @module api/plan/routes
 */

import { Router } from 'express';
import { generatePlan, getPlanSchema } from './controller.js';

const router = Router();

// POST /api/plan - Generate a learning plan
router.post('/', generatePlan);

// GET /api/plan/schema - Get plan response schema
router.get('/schema', getPlanSchema);

export default router;
