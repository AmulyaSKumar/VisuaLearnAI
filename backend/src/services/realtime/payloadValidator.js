const ALLOWED_SESSION_FIELDS = new Set([
  'type',
  'instructions',
  'input_audio_transcription',
]);

function pruneUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null),
  );
}

export function validateRealtimeSession(session) {
  const cleaned = pruneUndefined(session || {});
  const unknown = Object.keys(cleaned).filter(key => !ALLOWED_SESSION_FIELDS.has(key));
  if (unknown.length > 0) {
    throw new Error(`Invalid Azure realtime session fields: ${unknown.join(', ')}`);
  }

  return cleaned;
}

export function createSessionUpdateEvent(session) {
  return {
    type: 'session.update',
    session: validateRealtimeSession(session),
  };
}
