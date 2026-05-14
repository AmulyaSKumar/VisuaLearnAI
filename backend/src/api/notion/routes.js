import { Router } from 'express';
import { config } from '../../config/environment.js';
import {
  disconnectNotion,
  exportConversationToNotion,
  getNotionAuthorizationUrl,
  getNotionStatus,
  handleNotionCallback,
} from '../../services/notion/service.js';

export const notionCallbackRoutes = Router();
const router = Router();

router.get('/connect', (req, res) => {
  try {
    const url = getNotionAuthorizationUrl(req.user.userId);
    res.json({ url });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

notionCallbackRoutes.get('/callback', async (req, res) => {
  try {
    await handleNotionCallback({
      code: req.query.code,
      state: req.query.state,
    });

    res.redirect(`${config.frontendUrl}/settings?notion=connected`);
  } catch (error) {
    const message = encodeURIComponent(error.message || 'Notion connection failed');
    res.redirect(`${config.frontendUrl}/settings?notion=error&message=${message}`);
  }
});

router.get('/status', async (req, res) => {
  try {
    const status = await getNotionStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/disconnect', async (req, res) => {
  try {
    await disconnectNotion(req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { conversationId, artifactTypes, mindmapPngDataUrl } = req.body || {};

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    if (!Array.isArray(artifactTypes) || artifactTypes.length === 0) {
      return res.status(422).json({ error: 'Select at least one artifact to export.' });
    }

    const result = await exportConversationToNotion({
      userId: req.user.userId,
      conversationId,
      artifactTypes,
      mindmapPngDataUrl,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
