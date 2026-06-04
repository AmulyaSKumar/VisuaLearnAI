import { Router } from 'express';
import {
  createVideoJob,
  getVideoJob,
  getVideoLogs,
  proxyVideo,
} from '../../video/video-service.js';
import { logger } from '../../services/logger.js';

const router = Router();

function sendVideoError(res, error, fallbackMessage) {
  const status = Number(error?.status) || 500;
  const message = error?.message || fallbackMessage;
  logger.warn({ error: message, status }, 'Video API request failed');
  return res.status(status).json({
    success: false,
    error: status >= 500 ? 'video_service_error' : 'video_request_error',
    message,
  });
}

router.post('/', async (req, res) => {
  try {
    const job = await createVideoJob(req.body || {}, req.user?.userId || null);
    res.status(202).json({ success: true, job });
  } catch (error) {
    sendVideoError(res, error, 'Failed to create video job.');
  }
});

router.get('/:jobId', async (req, res) => {
  try {
    const job = await getVideoJob(req.params.jobId, req.user?.userId || null);
    res.json({ success: true, job });
  } catch (error) {
    sendVideoError(res, error, 'Failed to load video job.');
  }
});

router.get('/:jobId/logs', async (req, res) => {
  try {
    const logs = await getVideoLogs(req.params.jobId, req.user?.userId || null);
    res.json({ success: true, logs });
  } catch (error) {
    sendVideoError(res, error, 'Failed to load video logs.');
  }
});

router.get('/:jobId/video', async (req, res) => {
  try {
    await proxyVideo(req.params.jobId, req, res);
  } catch (error) {
    sendVideoError(res, error, 'Failed to stream generated video.');
  }
});

export default router;

