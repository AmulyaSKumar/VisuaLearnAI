import { Readable } from 'node:stream';

const DEFAULT_VIDEO_API_URL = 'http://104.45.183.21:8787';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_DURATION_SECONDS = 60;
const VALID_QUALITIES = new Set(['draft', 'final']);
const jobs = new Map();

function getVideoApiUrl() {
  return String(process.env.VIDEO_API_URL || DEFAULT_VIDEO_API_URL).replace(/\/+$/, '');
}

function normalizeDuration(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (/^\d+m$/.test(trimmed)) return Number.parseInt(trimmed, 10) * 60;
    if (/^\d+s$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  }

  const parsed = Number(value || DEFAULT_DURATION_SECONDS);
  if (!Number.isFinite(parsed)) return DEFAULT_DURATION_SECONDS;
  return Math.min(120, Math.max(15, Math.round(parsed)));
}

function normalizeQuality(value) {
  const quality = String(value || 'final').toLowerCase();
  return VALID_QUALITIES.has(quality) ? quality : 'final';
}

function normalizePayload(input = {}) {
  const topic = String(input.topic || '').trim();
  if (!topic) {
    const error = new Error('topic is required');
    error.status = 400;
    throw error;
  }

  return {
    topic: topic.slice(0, 180),
    durationSeconds: normalizeDuration(input.durationSeconds),
    audience: String(input.audience || 'curious learner').trim().slice(0, 120) || 'curious learner',
    quality: normalizeQuality(input.quality),
    visualEngine: input.visualEngine || 'auto',
  };
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${getVideoApiUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const rawText = await response.text();
    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText };
      }
    }

    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Video API request failed with ${response.status}`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function estimateProgress(job) {
  if (!job) return 0;
  if (job.status === 'done') return 100;
  if (job.status === 'failed') return 100;
  if (job.status === 'queued') return 5;

  const createdAtMs = Date.parse(job.createdAt || job.localCreatedAt || new Date().toISOString());
  const elapsedSeconds = Number.isFinite(createdAtMs) ? Math.max(0, (Date.now() - createdAtMs) / 1000) : 0;
  const expectedSeconds = Math.max(90, Number(job.durationSeconds || DEFAULT_DURATION_SECONDS) * 3);
  return Math.min(95, Math.max(10, Math.round((elapsedSeconds / expectedSeconds) * 90)));
}

function toPublicJob(job) {
  if (!job) return null;
  const status = job.status || 'queued';
  return {
    jobId: job.jobId,
    status,
    topic: job.topic,
    durationSeconds: job.durationSeconds,
    audience: job.audience,
    quality: job.quality,
    createdAt: job.createdAt || job.localCreatedAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    error: job.error || null,
    progress: Number.isFinite(job.progress) ? job.progress : estimateProgress(job),
    videoUrl: status === 'done' ? `/api/videos/${encodeURIComponent(job.jobId)}/video` : null,
    logsUrl: `/api/videos/${encodeURIComponent(job.jobId)}/logs`,
    statusUrl: `/api/videos/${encodeURIComponent(job.jobId)}`,
  };
}

function rememberJob(job, ownerId = null) {
  if (!job?.jobId) return job;
  const existing = jobs.get(job.jobId) || {};
  const merged = {
    ...existing,
    ...job,
    ownerId: existing.ownerId || ownerId,
    localCreatedAt: existing.localCreatedAt || new Date().toISOString(),
  };
  merged.progress = estimateProgress(merged);
  jobs.set(job.jobId, merged);
  return merged;
}

function assertJobAccess(jobId, userId) {
  const localJob = jobs.get(jobId);
  if (localJob?.ownerId && userId && localJob.ownerId !== userId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
  return localJob;
}

export async function createVideoJob(input, userId = null) {
  const payload = normalizePayload(input);
  const data = await fetchJson('/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 30_000,
  });

  const job = rememberJob({
    ...payload,
    ...data,
    status: data?.status || 'queued',
  }, userId);

  return toPublicJob(job);
}

export async function getVideoJob(jobId, userId = null) {
  const cleanJobId = String(jobId || '').trim();
  if (!cleanJobId) {
    const error = new Error('jobId is required');
    error.status = 400;
    throw error;
  }

  const localJob = assertJobAccess(cleanJobId, userId);
  const data = await fetchJson(`/jobs/${encodeURIComponent(cleanJobId)}`, { method: 'GET' });
  const job = rememberJob({
    ...(localJob || {}),
    ...data,
    jobId: data?.jobId || cleanJobId,
  }, userId);

  return toPublicJob(job);
}

export async function getVideoLogs(jobId, userId = null) {
  const cleanJobId = String(jobId || '').trim();
  assertJobAccess(cleanJobId, userId);
  return fetchJson(`/jobs/${encodeURIComponent(cleanJobId)}/logs`, { method: 'GET' });
}

export async function proxyVideo(jobId, req, res) {
  const cleanJobId = String(jobId || '').trim();
  assertJobAccess(cleanJobId, req.user?.userId);

  const headers = {};
  if (req.headers.range) headers.Range = req.headers.range;

  const response = await fetch(`${getVideoApiUrl()}/jobs/${encodeURIComponent(cleanJobId)}/video`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let message = 'Video is not ready yet.';
    try {
      const payload = await response.json();
      message = payload?.message || payload?.error || message;
    } catch {
      // Keep generic message for non-JSON upstream errors.
    }
    return res.status(response.status).json({ error: 'video_unavailable', message });
  }

  res.status(response.status);
  for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
    const value = response.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
  res.setHeader('Content-Disposition', `inline; filename="${cleanJobId}.mp4"`);

  if (!response.body) return res.end();
  Readable.fromWeb(response.body).pipe(res);
}

export function getStoredVideoJob(jobId) {
  return toPublicJob(jobs.get(String(jobId || '').trim()));
}

