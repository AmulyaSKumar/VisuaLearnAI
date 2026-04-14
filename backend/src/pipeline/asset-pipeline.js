/**
 * Asset Pipeline
 * Orchestrates parallel generation of widgets, images, and other assets
 * Streams results progressively via SSE
 * @module pipeline/asset-pipeline
 */

import { VisualIntelligenceAgent } from '../agents/visual-intelligence.js';
import { ImageGeneratorAgent } from '../agents/image-generator.js';
import { FactCheckerAgent } from '../agents/fact-checker.js';
import { logger } from '../utils/logger.js';

/**
 * Asset Pipeline Manager
 * Generates assets in parallel and streams to client
 */
export class AssetPipeline {
  constructor() {
    this.visualAgent = new VisualIntelligenceAgent();
    this.imageAgent = new ImageGeneratorAgent();
    this.factChecker = new FactCheckerAgent();
  }

  /**
   * Generate assets for a learning plan
   * Streams results progressively as they complete
   *
   * @param {Object} input - { plan, learningStyle?, userId? }
   * @param {Object} context - { userProfile?, memory? }
   * @param {Function} onAsset - Callback when asset completes: (asset) => void
   * @param {Function} onError - Callback on error: (error) => void
   * @param {Function} onComplete - Callback when pipeline completes: () => void
   *
   * @returns {Promise} Resolves when all assets generated
   */
  async generateAssets(input, context = {}, callbacks = {}) {
    const { onAsset = () => {}, onError = () => {}, onComplete = () => {} } = callbacks;

    const startTime = Date.now();
    let assetCount = 0;

    try {
      logger.info('Asset Pipeline: Starting generation', {
        planTitle: input.plan?.title,
        steps: input.plan?.steps?.length,
      });

      // Generate widgets in parallel but stream results as they complete
      const tasks = [];

      // Task 1: Generate visual widgets
      tasks.push(
        this._generateWidgetsTask(input, context)
          .then(widgets => {
            widgets.forEach(widget => {
              assetCount++;
              onAsset({
                type: 'widget',
                asset: widget,
                progress: `Generated widget ${assetCount}`,
              });
              logger.debug('Asset Pipeline: Widget generated', {
                widgetId: widget.id,
                vizType: widget.type,
              });
            });
            return widgets;
          })
          .catch(error => {
            logger.error('Asset Pipeline: Widget generation failed', { error: error.message });
            onError({
              type: 'widget',
              error: error.message,
            });
          })
      );

      // Task 2: Generate images (Day 4)
      tasks.push(
        this._generateImagesTask(input, context)
          .then(images => {
            images.forEach(image => {
              assetCount++;
              onAsset({
                type: 'image',
                asset: image,
                progress: `Generated image ${assetCount}`,
              });
              logger.debug('Asset Pipeline: Image generated', {
                imageUrl: image.imageUrl,
              });
            });
            return images;
          })
          .catch(error => {
            logger.error('Asset Pipeline: Image generation failed', { error: error.message });
            onError({
              type: 'image',
              error: error.message,
            });
          })
      );

      // Task 3: Fact checking (async, doesn't block)
      tasks.push(
        this._validateClaimsTask(input, context)
          .then(verification => {
            if (verification && verification.claims && verification.claims.length > 0) {
              onAsset({
                type: 'fact-check',
                asset: verification,
                progress: `Verified ${verification.claims.length} claims`,
              });
              logger.debug('Asset Pipeline: Fact check complete', {
                claims: verification.claims.length,
                confidence: verification.overallConfidence,
              });
            }
            return verification;
          })
          .catch(error => {
            logger.error('Asset Pipeline: Fact checking failed', { error: error.message });
            onError({
              type: 'fact-check',
              error: error.message,
            });
          })
      )

      // Wait for all tasks to complete
      const results = await Promise.allSettled(tasks);

      logger.info('Asset Pipeline: Generation complete', {
        planTitle: input.plan?.title,
        totalAssets: assetCount,
        duration: Date.now() - startTime,
      });

      onComplete({
        totalAssets: assetCount,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        totalAssets: assetCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Asset Pipeline: Fatal error', { error: error.message });
      onError({
        type: 'pipeline',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Generate widgets task
   * Can run in parallel with other tasks
   */
  async _generateWidgetsTask(input, context) {
    try {
      const result = await this.visualAgent.run(input, context);

      if (!result.success) {
        throw new Error(result.error || 'Widget generation failed');
      }

      return result.result.widgets || [];
    } catch (error) {
      logger.error('Asset Pipeline: Widget task failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate images task
   * Generates one image per learning step
   */
  async _generateImagesTask(input, context) {
    try {
      const { plan } = input;
      const images = [];

      // Generate image for each step that has visual resources
      const stepsNeedingImages = (plan.steps || []).filter(step => {
        const resources = step.resources || [];
        return resources.some(r =>
          r.type === 'visualization' ||
          r.type === 'diagram' ||
          r.type === 'illustration'
        );
      });

      // Limit to max 3 images per plan to control costs
      const stepsToProcess = stepsNeedingImages.slice(0, 3);

      for (const step of stepsToProcess) {
        try {
          const prompt = `Educational illustration for: ${step.title}. ${step.description || ''}`;

          const result = await this.imageAgent.run(
            { prompt, style: 'educational, clear, colorful' },
            context
          );

          if (result.success && result.result.imageUrl) {
            images.push({
              id: `img-${step.number || images.length + 1}`,
              step: step.number,
              title: step.title,
              imageUrl: result.result.imageUrl,
              prompt: result.result.prompt,
              metadata: result.result.metadata,
            });
          }
        } catch (stepError) {
          logger.warn('Asset Pipeline: Image for step failed', {
            step: step.number,
            error: stepError.message,
          });
        }
      }

      return images;
    } catch (error) {
      logger.error('Asset Pipeline: Image task failed', { error: error.message });
      return [];
    }
  }

  /**
   * Validate claims in the learning plan
   * Uses MAFC pattern for fact checking
   */
  async _validateClaimsTask(input, context) {
    try {
      const { plan } = input;

      // Combine all step descriptions for fact checking
      const textToValidate = (plan.steps || [])
        .map(step => `${step.title}: ${step.description || ''}`)
        .join('\n');

      if (!textToValidate || textToValidate.length < 50) {
        return null;
      }

      const result = await this.factChecker.run(
        { text: textToValidate },
        context
      );

      if (result.success) {
        return result.result;
      }

      return null;
    } catch (error) {
      logger.error('Asset Pipeline: Fact check task failed', { error: error.message });
      return null;
    }
  }
}

export default AssetPipeline;
