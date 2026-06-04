import { useCallback, useEffect, useRef, useState } from "react";
import {
  createVideoJob,
  fetchVideoBlob,
  getVideoJob,
} from "../utils/videoGeneration";

const TERMINAL_STATUSES = new Set(["done", "failed"]);
const videoJobCache = new Map();

function cacheKey(topic, options = {}) {
  return JSON.stringify({
    topic: String(topic || "").trim().toLowerCase(),
    durationSeconds: options.durationSeconds || 60,
    audience: options.audience || "high school students",
    quality: options.quality || "final",
  });
}

export default function useVideoGeneration({
  topic,
  accessToken = null,
  initialVideo = null,
  autoStart = false,
  options = {},
} = {}) {
  const durationSeconds = options.durationSeconds || 60;
  const audience = options.audience || "high school students";
  const quality = options.quality || "final";
  const [job, setJob] = useState(() => initialVideo?.job || initialVideo || videoJobCache.get(cacheKey(topic, options)) || null);
  const [error, setError] = useState(initialVideo?.error || null);
  const [isCreating, setIsCreating] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const startedRef = useRef(false);
  const objectUrlRef = useRef(null);

  const jobId = job?.jobId || initialVideo?.jobId || null;
  const status = job?.status || null;
  const isRunning = Boolean(jobId && status && !TERMINAL_STATUSES.has(status));
  const canLoadVideo = status === "done" && Boolean(jobId);

  const start = useCallback(async (overrides = {}) => {
    const finalTopic = String(overrides.topic || topic || "").trim();
    if (!finalTopic) return null;
    const finalOptions = {
      durationSeconds: overrides.durationSeconds || durationSeconds,
      audience: overrides.audience || audience,
      quality: overrides.quality || quality,
    };
    const key = cacheKey(finalTopic, finalOptions);
    const cached = videoJobCache.get(key);
    if (cached?.jobId) {
      setJob(cached);
      return cached;
    }

    setIsCreating(true);
    setError(null);
    try {
      const created = await createVideoJob({
        topic: finalTopic,
        ...finalOptions,
      }, accessToken);
      videoJobCache.set(key, created);
      setJob(created);
      return created;
    } catch (err) {
      const message = err?.message || "Video generation failed to start.";
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [accessToken, audience, durationSeconds, quality, topic]);

  useEffect(() => {
    if (!autoStart || startedRef.current || jobId || !topic) return;
    startedRef.current = true;
    start();
  }, [autoStart, jobId, start, topic]);

  useEffect(() => {
    if (!jobId || TERMINAL_STATUSES.has(status)) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const nextJob = await getVideoJob(jobId, accessToken);
        if (cancelled) return;
        setJob(nextJob);
        videoJobCache.set(cacheKey(nextJob?.topic || topic, { durationSeconds, audience, quality }), nextJob);
        if (nextJob?.status === "failed") {
          setError(nextJob.error || "Video generation failed.");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not refresh video status.");
      }
    };

    poll();
    const intervalId = window.setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [accessToken, audience, durationSeconds, jobId, quality, status, topic]);

  useEffect(() => {
    if (!canLoadVideo || !jobId) return undefined;

    let cancelled = false;
    fetchVideoBlob(jobId, accessToken)
      .then((blob) => {
        if (cancelled) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setVideoUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load generated video.");
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, canLoadVideo, jobId]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  return {
    job,
    jobId,
    status,
    error,
    progress: job?.progress || 0,
    videoUrl,
    isCreating,
    isRunning,
    available: status === "done" && Boolean(videoUrl),
    start,
  };
}
