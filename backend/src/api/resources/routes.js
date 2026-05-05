/**
 * Learning Resources API
 * Handles persistent storage and retrieval of learning content (tabs)
 * @module api/resources
 */

import { Router } from 'express';
import {
  saveLearningResource,
  getConversationResources,
  getResource,
  getAvailableResourceTypes,
  deleteLearningResource,
  RESOURCE_TYPES,
} from '../../database/client.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/resources/:conversationId
 * Get all learning resources for a conversation
 */
router.get('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  try {
    const resources = await getConversationResources(conversationId);

    // Group resources by type for easier frontend consumption
    const grouped = {
      types: [],
      resources: {},
    };

    resources.forEach(resource => {
      if (!grouped.types.includes(resource.resource_type)) {
        grouped.types.push(resource.resource_type);
      }
      if (!grouped.resources[resource.resource_type]) {
        grouped.resources[resource.resource_type] = [];
      }
      grouped.resources[resource.resource_type].push({
        id: resource.id,
        topic: resource.topic,
        content: resource.content,
        createdAt: resource.created_at,
        updatedAt: resource.updated_at,
      });
    });

    // Always include 'learn' as available (it's the default)
    if (!grouped.types.includes('learn')) {
      grouped.types.unshift('learn');
    }

    res.json(grouped);
  } catch (error) {
    logger.error({ error: error.message, conversationId }, 'Failed to fetch resources');
    res.status(500).json({ error: 'Failed to fetch learning resources' });
  }
});

/**
 * GET /api/resources/:conversationId/types
 * Get available resource types for a conversation (for tab rendering)
 */
router.get('/:conversationId/types', async (req, res) => {
  const { conversationId } = req.params;

  try {
    const types = await getAvailableResourceTypes(conversationId);

    // Always include 'learn' as available
    if (!types.includes('learn')) {
      types.unshift('learn');
    }

    res.json({ types, availableTypes: Object.values(RESOURCE_TYPES) });
  } catch (error) {
    logger.error({ error: error.message, conversationId }, 'Failed to fetch resource types');
    res.status(500).json({ error: 'Failed to fetch resource types' });
  }
});

/**
 * GET /api/resources/:conversationId/:resourceType
 * Get a specific resource type for a conversation
 */
router.get('/:conversationId/:resourceType', async (req, res) => {
  const { conversationId, resourceType } = req.params;
  const { topic } = req.query;

  // Validate resource type
  if (!Object.values(RESOURCE_TYPES).includes(resourceType)) {
    return res.status(400).json({
      error: 'Invalid resource type',
      validTypes: Object.values(RESOURCE_TYPES),
    });
  }

  try {
    const resource = await getResource(conversationId, resourceType, topic || null);

    if (!resource) {
      return res.status(404).json({
        error: 'Resource not found',
        resourceType,
        conversationId,
      });
    }

    res.json({
      id: resource.id,
      type: resource.resource_type,
      topic: resource.topic,
      content: resource.content,
      createdAt: resource.created_at,
      updatedAt: resource.updated_at,
    });
  } catch (error) {
    logger.error({ error: error.message, conversationId, resourceType }, 'Failed to fetch resource');
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});

/**
 * POST /api/resources/:conversationId
 * Save a learning resource
 */
router.post('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const { resourceType, topic, content, messageId } = req.body;

  // Validate required fields
  if (!resourceType || !topic || !content) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['resourceType', 'topic', 'content'],
    });
  }

  // Validate resource type
  if (!Object.values(RESOURCE_TYPES).includes(resourceType)) {
    return res.status(400).json({
      error: 'Invalid resource type',
      validTypes: Object.values(RESOURCE_TYPES),
    });
  }

  try {
    const resource = await saveLearningResource(
      conversationId,
      messageId || null,
      resourceType,
      topic,
      content
    );

    logger.info({
      conversationId,
      resourceType,
      topic,
      resourceId: resource.id,
    }, 'Learning resource saved');

    res.status(201).json({
      id: resource.id,
      type: resource.resource_type,
      topic: resource.topic,
      content: resource.content,
      createdAt: resource.created_at,
    });
  } catch (error) {
    logger.error({ error: error.message, conversationId, resourceType }, 'Failed to save resource');
    res.status(500).json({ error: 'Failed to save learning resource' });
  }
});

/**
 * DELETE /api/resources/:conversationId/:resourceId
 * Delete a specific learning resource
 */
router.delete('/:conversationId/:resourceId', async (req, res) => {
  const { conversationId, resourceId } = req.params;

  try {
    await deleteLearningResource(resourceId);

    logger.info({ conversationId, resourceId }, 'Learning resource deleted');

    res.json({ success: true, deleted: resourceId });
  } catch (error) {
    logger.error({ error: error.message, resourceId }, 'Failed to delete resource');
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

export default router;
