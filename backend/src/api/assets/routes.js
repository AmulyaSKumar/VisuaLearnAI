/**
 * Assets Routes
 * Asset generation endpoints
 * @module api/assets/routes
 */

import { Router } from 'express';
import { generateAssets, getAssetSchema } from './controller.js';

const router = Router();

// POST /api/generate-assets - Generate assets (SSE streaming)
router.post('/', generateAssets);

// GET /api/assets/schema - Get asset generation schema
router.get('/schema', getAssetSchema);

export default router;
