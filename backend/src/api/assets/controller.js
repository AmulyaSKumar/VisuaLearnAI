/**
 * Assets API Controller
 * Handles asset generation requests and SSE streaming
 * @module api/assets/controller
 */

import { AssetPipeline } from '../../pipeline/asset-pipeline.js';
import { MemoryManager } from '../../services/memory/index.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * Generate assets (widgets, images, etc.) for a learning plan
 * Streams results via SSE
 * POST /api/generate-assets
 */
export async function generateAssets(req, res) {
  try {
    const { plan, learningStyle = 'visual' } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Validate input
    if (!plan || typeof plan !== 'object') {
      throw new ValidationError('plan is required and must be an object');
    }

    if (!plan.steps || !Array.isArray(plan.steps)) {
      throw new ValidationError('plan.steps must be an array');
    }

    logger.info('Assets: Generate request received', {
      planTitle: plan.title,
      steps: plan.steps.length,
      userId,
    });

    // Set up SSE response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial message
    sendSSE(res, {
      type: 'start',
      message: 'Asset generation started',
      plan: plan.title,
    });

    // Load user context
    let userProfile = {};
    if (userId !== 'anonymous') {
      try {
        const memory = new MemoryManager(userId);
        await memory.initialize();
        userProfile = await memory.getUserProfile();
      } catch (error) {
        logger.warn('Assets: Could not load user profile', { userId, error: error.message });
      }
    }

    // Create asset pipeline
    const pipeline = new AssetPipeline();

    // Generate assets with streaming
    let aborted = false;
    let assetCount = 0;

    const handleAbort = () => {
      aborted = true;
      logger.info('Assets: Generation aborted by client', { userId });
    };

    try {
      await pipeline.generateAssets(
        { plan, learningStyle, userId },
        { userProfile },
        {
          // Asset callback - stream each completed asset
          onAsset: (assetData) => {
            if (!aborted) {
              assetCount++;

              // Send different event types based on asset type
              if (assetData.type === 'widget') {
                sendSSE(res, {
                  type: 'asset',
                  asset: assetData.asset,
                  progress: assetData.progress || `Asset ${assetCount}`,
                });
              } else if (assetData.type === 'image') {
                sendSSE(res, {
                  type: 'image',
                  asset: assetData.asset,
                  progress: assetData.progress || `Image ${assetCount}`,
                });
              } else if (assetData.type === 'fact-check') {
                sendSSE(res, {
                  type: 'fact_check',
                  verification: assetData.asset,
                  progress: assetData.progress || 'Verification complete',
                });
              } else {
                sendSSE(res, {
                  type: 'asset',
                  asset: assetData.asset,
                  progress: assetData.progress || `Asset ${assetCount}`,
                });
              }
            }
          },

          // Error callback
          onError: (errorData) => {
            if (!aborted) {
              logger.error('Assets: Generation error', { error: errorData.error });
              sendSSE(res, {
                type: 'error',
                error: errorData.error,
                assetType: errorData.type,
              });
            }
          },

          // Complete callback
          onComplete: (stats) => {
            if (!aborted) {
              logger.info('Assets: Generation complete', {
                totalAssets: stats.totalAssets,
                duration: stats.duration,
              });

              sendSSE(res, {
                type: 'complete',
                totalAssets: stats.totalAssets,
                duration: stats.duration,
                message: `Generated ${stats.totalAssets} assets in ${(stats.duration / 1000).toFixed(1)}s`,
              });
            }
          },
        }
      );

      // Send final message and close
      if (!aborted) {
        sendSSE(res, { type: 'done' });
      }
      res.end();
    } catch (error) {
      if (!aborted) {
        logger.error('Assets: Pipeline failed', { error: error.message });
        sendSSE(res, {
          type: 'error',
          error: error.message || 'Asset generation failed',
        });
        res.end();
      }
    }

    // Handle client disconnect
    req.on('close', handleAbort);
    res.on('finish', handleAbort);
    res.on('error', handleAbort);
  } catch (error) {
    logger.error('Assets: Request error', { error: error.message });
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get asset generation schema
 * GET /api/assets/schema
 */
export function getAssetSchema(req, res) {
  res.json({
    title: 'Asset Generation Schema',
    request: {
      plan: {
        type: 'object',
        description: 'Learning plan from Planner Agent',
        required: true,
        properties: {
          title: 'string',
          steps: [
            {
              number: 'number',
              title: 'string',
              description: 'string',
              resources: [
                {
                  type: 'string (visualization)',
                  description: 'string',
                },
              ],
            },
          ],
        },
      },
      learningStyle: {
        type: 'string',
        enum: ['visual', 'auditory', 'reading', 'kinesthetic'],
        default: 'visual',
      },
    },
    response: {
      streamFormat: 'Server-Sent Events (SSE)',
      events: [
        {
          type: 'start',
          message: 'Asset generation started',
          plan: 'string (plan title)',
        },
        {
          type: 'asset',
          asset: {
            id: 'string',
            step: 'number',
            type: 'string (widget type)',
            title: 'string',
            code: 'string (HTML/CSS/JS)',
            description: 'string',
          },
          progress: 'string',
        },
        {
          type: 'image',
          asset: {
            id: 'string',
            step: 'number',
            title: 'string',
            imageUrl: 'string (public URL)',
            prompt: 'string',
            metadata: {
              model: 'string (gpt-image-1.5)',
              size: 'string',
              quality: 'string',
              generatedAt: 'string (ISO 8601)',
            },
          },
          progress: 'string',
        },
        {
          type: 'fact_check',
          verification: {
            claims: [
              {
                claim: 'string',
                confidence: 'number (0-1)',
                status: 'string (verified|likely|uncertain|unverified)',
                sources: ['string'],
              },
            ],
            overallConfidence: 'number (0-1)',
            summary: 'string',
            validatedAt: 'string (ISO 8601)',
          },
          progress: 'string',
        },
        {
          type: 'complete',
          totalAssets: 'number',
          duration: 'number (ms)',
          message: 'string',
        },
        {
          type: 'error',
          error: 'string',
          assetType: 'string (widget|image|fact-check|pipeline)',
        },
        {
          type: 'done',
        },
      ],
    },
  });
}

/**
 * Helper: Send SSE message
 */
function sendSSE(res, data) {
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    logger.error('Assets: SSE write error', { error: error.message });
  }
}
