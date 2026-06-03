/**
 * Image Generator Agent (Phase 9C)
 * Generates educational images using Azure gpt-image-1.5
 *
 * Input: { prompt, style?, size?, numberOfImages? }
 * Output: { imageUrl, prompt, metadata: { model, size, quality, generatedAt } }
 */

import { BaseAgent } from './base-agent.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../database/client.js';

export class ImageGeneratorAgent extends BaseAgent {
  /**
   * Retry configuration for ImageGeneratorAgent
   * Lower retries since image generation is slow and costly
   */
  static retryConfig = { maxRetries: 2 };

  constructor() {
    super('image-generator', 'Generates educational images using Azure API', '1.0.0');
  }

  async execute(input, context = {}) {
    this.validateInput(input, ['prompt']);

    const {
      prompt,
      style = 'educational, colorful, scientific',
      size = '1024x1024',
      numberOfImages = 1
    } = input;
    const { userId } = context;

    logger.info('Image Generator: Starting image generation', {
      prompt: prompt.substring(0, 50),
      style,
      size
    });

    try {
      // Generate image from Azure API
      const imageData = await this._generateImageWithAzure(prompt, style, size, numberOfImages);

      // Upload to Supabase Storage
      const imageUrl = await this._uploadToStorage(imageData, prompt);

      const result = {
        prompt,
        style,
        imageUrl,
        metadata: {
          size,
          model: 'gpt-image-1.5',
          quality: 'medium',
          generatedAt: new Date().toISOString()
        }
      };

      logger.info('Image Generator: Complete', { imageUrl });
      return result;

    } catch (error) {
      logger.error('Image Generator: Failed', { error: error.message });
      throw error;
    }
  }

  async _generateImageWithAzure(prompt, style, size, numberOfImages) {
    try {
      const enhancedPrompt = `${prompt}\nStyle: ${style}`;

      const response = await fetch(
        `${config.azure.imageEndpoint}?api-version=${config.azure.imageApiVersion}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.azure.apiKey
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            size,
            quality: 'medium',
            n: numberOfImages
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error('No image data returned from Azure API');
      }

      return data.data[0].b64_json;

    } catch (error) {
      logger.error('Image Generator: Azure API failed', { error: error.message });
      throw error;
    }
  }

  async _uploadToStorage(base64Data, prompt) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const timestamp = Date.now();
      const promptSlug = prompt
        .substring(0, 20)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const filename = `${timestamp}-${promptSlug}.png`;

      const { data, error } = await supabase.storage
        .from('lesson-assets')
        .upload(`images/${filename}`, buffer, {
          contentType: 'image/png',
          upsert: false
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      const { data: publicData } = supabase.storage
        .from('lesson-assets')
        .getPublicUrl(`images/${filename}`);

      const publicUrl = publicData.publicUrl;
      try {
        const verifyResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (verifyResponse.ok) {
          return publicUrl;
        }
        logger.warn('Image Generator: Public storage URL was not readable, using data URL fallback', {
          status: verifyResponse.status,
          publicUrl,
        });
      } catch (verifyError) {
        logger.warn('Image Generator: Public storage URL verification failed, using data URL fallback', {
          error: verifyError.message,
          publicUrl,
        });
      }

      return `data:image/png;base64,${base64Data}`;

    } catch (error) {
      logger.error('Image Generator: Storage upload failed', { error: error.message });
      throw error;
    }
  }

  async beforeExecute(input, context) {
    logger.debug(`[${this.name}] Validating image generation request...`);

    if (!input.prompt || input.prompt.trim().length === 0) {
      throw new Error('Prompt is required and cannot be empty');
    }

    return { input, context };
  }

  async afterExecute(result, context) {
    if (!result.imageUrl || typeof result.imageUrl !== 'string') {
      throw new Error('Invalid result: imageUrl required and must be string');
    }

    if (!result.metadata) {
      throw new Error('Invalid result: metadata required');
    }

    logger.info(`[${this.name}] Image generation validated successfully`);
    return result;
  }

  async onError(error, input, context) {
    logger.error(`[${this.name}] Error occurred:`, {
      message: error.message,
      input: input?.prompt?.substring(0, 50)
    });

    // Return fallback error response
    return {
      error: true,
      message: error.message,
      prompt: input?.prompt || 'Unknown',
      metadata: {
        model: 'gpt-image-1.5',
        error: true,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

export default ImageGeneratorAgent;
