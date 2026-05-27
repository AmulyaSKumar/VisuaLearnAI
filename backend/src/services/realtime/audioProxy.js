import WebSocket, { WebSocketServer } from 'ws';
import { verifyToken } from '../auth.js';
import {
  buildRealtimeContextFromSession,
  buildRealtimeInstructions,
} from './contextBuilder.js';
import realtimeSessionManager from './sessionManager.js';
import realtimeClient, { createAzureRealtimeSocket } from './realtimeClient.js';
import { config } from '../../config/environment.js';
import { createSessionUpdateEvent } from './payloadValidator.js';
import { traceRealtime } from './realtimeTrace.js';

const SPEECH_RMS_THRESHOLD = 0.015;
const SILENCE_COMMIT_MS = 1500;
const MIN_COMMIT_AUDIO_MS = 100;
const RESPONSE_STATE = {
  IDLE: 'idle',
  GENERATING: 'generating',
  CANCELLING: 'cancelling',
};

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value.toString());
  } catch {
    return null;
  }
}

function pcm16Rms(base64Audio = '') {
  const buffer = Buffer.from(base64Audio, 'base64');
  if (buffer.length < 2) return 0;

  let total = 0;
  const sampleCount = Math.floor(buffer.length / 2);
  for (let offset = 0; offset < sampleCount * 2; offset += 2) {
    const sample = buffer.readInt16LE(offset) / 0x8000;
    total += sample * sample;
  }
  return Math.sqrt(total / Math.max(sampleCount, 1));
}

function pcm16DurationMs(base64Audio = '') {
  const byteLength = Buffer.from(base64Audio, 'base64').length;
  const sampleCount = Math.floor(byteLength / 2);
  return (sampleCount / 24000) * 1000;
}

async function authenticateUpgrade(request) {
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (!token) {
    throw new Error('Missing realtime auth token.');
  }

  return verifyToken({
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

function getQueryOptions(request) {
  const url = new URL(request.url, 'http://localhost');
  return {
    conversationId: url.searchParams.get('conversationId') || null,
    mode: url.searchParams.get('mode') === 'learning' ? 'learning' : 'chat',
    personaId: url.searchParams.get('personaId') || null,
    documentId: url.searchParams.get('documentId') || null,
  };
}

function configureAzureSession(azureSocket, session) {
  const context = buildRealtimeContextFromSession(session);
  const instructions = buildRealtimeInstructions(context);
  const transcriptionDeployment = config.azureRealtime.transcriptionDeployment;

  const sessionUpdate = createSessionUpdateEvent({
    type: 'realtime',
    instructions,
  });

  if (transcriptionDeployment) {
    sessionUpdate.session.input_audio_transcription = {
      model: transcriptionDeployment,
    };
  }

  return sessionUpdate;
}

function createResponseEvent() {
  return {
    type: 'response.create',
  };
}

function forwardAzureEvent(clientSocket, session, event) {
  if (!event?.type) return;

  if (event.type === 'conversation.item.input_audio_transcription.completed') {
    realtimeSessionManager.appendMessage(session.sessionId, {
      id: event.item_id || `rt_user_${Date.now()}`,
      role: 'user',
      content: event.transcript || '',
      metadata: { temporary: true, realtimeAudio: true },
      created_at: new Date().toISOString(),
    });
    sendJson(clientSocket, {
      type: 'user_transcript',
      text: event.transcript || '',
    });
    return;
  }

  if (event.type === 'response.audio_transcript.delta' || event.type === 'response.output_text.delta') {
    sendJson(clientSocket, {
      type: 'assistant_transcript_delta',
      text: event.delta || '',
    });
    return;
  }

  if (event.type === 'response.audio_transcript.done') {
    realtimeSessionManager.appendMessage(session.sessionId, {
      id: event.item_id || `rt_assistant_${Date.now()}`,
      role: 'assistant',
      content: event.transcript || '',
      metadata: { temporary: true, realtimeAudio: true },
      created_at: new Date().toISOString(),
    });
    sendJson(clientSocket, {
      type: 'assistant_transcript_done',
      text: event.transcript || '',
    });
    return;
  }

  if (event.type === 'response.audio.delta') {
    sendJson(clientSocket, {
      type: 'assistant_audio_delta',
      audio: event.delta || '',
    });
    return;
  }

  if (event.type === 'input_audio_buffer.speech_started') {
    sendJson(clientSocket, { type: 'user_speech_started' });
    return;
  }

  if (event.type === 'input_audio_buffer.speech_stopped') {
    sendJson(clientSocket, { type: 'user_speech_stopped' });
    return;
  }

  if (event.type === 'response.created') {
    sendJson(clientSocket, { type: 'assistant_thinking' });
    return;
  }

  if (event.type === 'response.done' || event.type === 'response.completed') {
    sendJson(clientSocket, { type: 'assistant_done' });
    return;
  }

  if (event.type === 'error') {
    sendJson(clientSocket, {
      type: 'error',
      error: event.error?.message || 'Azure realtime error.',
    });
  }
}

export function attachRealtimeAudioProxy(server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/api/realtime/audio',
  });

  server.on('upgrade', async (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/api/realtime/audio') return;

    try {
      await authenticateUpgrade(request);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (clientSocket) => {
      wss.emit('connection', clientSocket, request);
    });
  });

  wss.on('connection', async (clientSocket, request) => {
    const connectedAt = Date.now();
    traceRealtime({
      stage: 'socketConnected',
      payload: { path: '/api/realtime/audio' },
    });

    if (!realtimeClient.isConfigured()) {
      sendJson(clientSocket, {
        type: 'error',
        error: 'Realtime configuration incomplete.',
      });
      clientSocket.close();
      return;
    }

    const user = await authenticateUpgrade(request).catch(() => null);
    if (!user) {
      clientSocket.close();
      return;
    }

    const options = getQueryOptions(request);
    const session = await realtimeSessionManager.createSession({
      userId: user.userId,
      conversationId: options.conversationId,
      mode: options.mode,
      personaId: options.personaId,
      documentId: options.documentId,
      createIfMissing: false,
    });

    let azureSocket;
    try {
      azureSocket = createAzureRealtimeSocket();
    } catch (error) {
      traceRealtime({
        stage: 'socketConnected',
        success: false,
        error: error.message,
        duration: Date.now() - connectedAt,
      });
      sendJson(clientSocket, { type: 'error', error: error.message });
      clientSocket.close();
      return;
    }

    let sessionConfirmed = false;
    let sessionUpdateSentAt = 0;
    let speechActive = false;
    let silenceTimer = null;
    let responseInFlight = false;
    let responseCancelling = false;
    let bufferedAudioMs = 0;
    let responseState = RESPONSE_STATE.IDLE;

    const setResponseState = (newState) => {
      if (responseState === newState) return;
      const oldState = responseState;
      responseState = newState;
      traceRealtime({
        stage: 'responseStateChanged',
        payload: { oldState, newState },
      });
    };

    const clearSilenceTimer = () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    };

    const commitAudioTurn = () => {
      clearSilenceTimer();
      if (responseState === RESPONSE_STATE.GENERATING) {
        traceRealtime({
          stage: 'commitIgnored',
          payload: { reason: 'responseActive' },
        });
        return;
      }
      if (!sessionConfirmed || azureSocket.readyState !== WebSocket.OPEN) return;
      if (responseState !== RESPONSE_STATE.IDLE) {
        traceRealtime({
          stage: 'responseCreateBlocked',
          payload: { responseState },
        });
        return;
      }
      if (bufferedAudioMs < MIN_COMMIT_AUDIO_MS) {
        traceRealtime({
          stage: 'audioCommitSkipped',
          success: false,
          error: 'Buffered audio below Azure minimum commit duration.',
          payload: {
            bufferedAudioMs: Math.round(bufferedAudioMs),
            minAudioMs: MIN_COMMIT_AUDIO_MS,
          },
        });
        speechActive = false;
        bufferedAudioMs = 0;
        return;
      }

      speechActive = false;
      responseInFlight = true;
      bufferedAudioMs = 0;
      setResponseState(RESPONSE_STATE.GENERATING);

      const commitEvent = { type: 'input_audio_buffer.commit' };
      sendJson(azureSocket, commitEvent);
      traceRealtime({ stage: 'audioCommit', payload: commitEvent });

      const responseEvent = createResponseEvent();
      if (responseState !== RESPONSE_STATE.GENERATING) {
        traceRealtime({
          stage: 'responseCreateBlocked',
          payload: { responseState },
        });
        return;
      }
      sendJson(azureSocket, responseEvent);
      traceRealtime({ stage: 'responseCreate', payload: responseEvent });
    };

    azureSocket.on('open', () => {
      const sessionUpdate = configureAzureSession(azureSocket, session);
      sessionUpdateSentAt = Date.now();
      traceRealtime({
        stage: 'sessionUpdatedPayload',
        payload: sessionUpdate,
      });
      azureSocket.send(JSON.stringify(sessionUpdate));
      traceRealtime({
        stage: 'sessionUpdateSent',
        payload: sessionUpdate,
      });
    });

    azureSocket.on('message', (message) => {
      const event = parseJson(message);
      if (!event) {
        traceRealtime({
          stage: 'jsonParse',
          success: false,
          error: 'Failed to parse Azure realtime event.',
        });
        return;
      }

      if (event.type === 'session.updated' && !sessionConfirmed) {
        sessionConfirmed = true;
        traceRealtime({
          stage: 'sessionUpdated',
          payload: event,
          duration: Date.now() - sessionUpdateSentAt,
        });
        sendJson(clientSocket, {
          type: 'ready',
          session: {
            sessionId: session.sessionId,
            mode: session.mode,
            activeTopic: session.activeTopic,
          },
        });
        return;
      }

      if (event.type === 'response.created') {
        responseInFlight = true;
        responseCancelling = false;
        setResponseState(RESPONSE_STATE.GENERATING);
        traceRealtime({ stage: 'responseReceived', payload: event });
      }
      if (event.type === 'response.audio.delta') {
        traceRealtime({ stage: 'audioReceived', payload: { type: event.type, audio: event.delta || '' } });
      }
      if (event.type === 'response.audio_transcript.delta' || event.type === 'response.output_text.delta') {
        traceRealtime({ stage: 'transcriptReceived', payload: event });
      }
      if (event.type === 'response.done' || event.type === 'response.completed') {
        responseInFlight = false;
        responseCancelling = false;
        bufferedAudioMs = 0;
        setResponseState(RESPONSE_STATE.IDLE);
        traceRealtime({ stage: 'responseCompleted', payload: event });
      }
      if (event.type === 'error') {
        const errorCode = event.error?.code || '';
        if (errorCode === 'input_audio_buffer_commit_empty') {
          bufferedAudioMs = 0;
        }
        if (errorCode !== 'conversation_already_has_active_response') {
          responseInFlight = false;
          responseCancelling = false;
          setResponseState(RESPONSE_STATE.IDLE);
        }
        traceRealtime({
          stage: 'azureError',
          success: false,
          error: event.error?.message || 'Azure realtime error.',
          payload: event,
        });
      }

      forwardAzureEvent(clientSocket, session, event);
    });

    azureSocket.on('error', (error) => {
      traceRealtime({
        stage: 'socketConnected',
        success: false,
        error: error.message || 'Azure realtime socket failed.',
      });
      sendJson(clientSocket, {
        type: 'error',
        error: error.message || 'Azure realtime socket failed.',
      });
    });

    azureSocket.on('close', () => {
      clearSilenceTimer();
      sendJson(clientSocket, { type: 'closed' });
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    });

    clientSocket.on('message', (message) => {
      const event = parseJson(message);
      if (!event) {
        traceRealtime({
          stage: 'jsonParse',
          success: false,
          error: 'Failed to parse frontend realtime event.',
        });
        return;
      }
      if (azureSocket.readyState !== WebSocket.OPEN) return;

      if (event.type === 'input_audio_buffer.append') {
        if (!sessionConfirmed) {
          traceRealtime({
            stage: 'audioChunkSent',
            success: false,
            error: 'Audio chunk received before Azure session.updated.',
          });
          return;
        }

        if (responseState !== RESPONSE_STATE.IDLE) {
          traceRealtime({
            stage: 'audioChunkIgnored',
            payload: {
              reason: 'responseActive',
              responseState,
            },
          });
          return;
        }

        const level = pcm16Rms(event.audio);
        bufferedAudioMs += pcm16DurationMs(event.audio);
        sendJson(azureSocket, {
          type: 'input_audio_buffer.append',
          audio: event.audio,
        });
        traceRealtime({
          stage: 'audioChunkSent',
          payload: {
            type: 'input_audio_buffer.append',
            audio: event.audio,
            rms: level,
            bufferedAudioMs: Math.round(bufferedAudioMs),
          },
        });

        if (level > SPEECH_RMS_THRESHOLD) {
          speechActive = true;
          clearSilenceTimer();
        } else if (speechActive && !silenceTimer) {
          silenceTimer = setTimeout(commitAudioTurn, SILENCE_COMMIT_MS);
        }
        return;
      }

      if (event.type === 'response.cancel') {
        clearSilenceTimer();
        if (responseState === RESPONSE_STATE.IDLE) {
          traceRealtime({
            stage: 'responseCancelIgnored',
            payload: { reason: 'responseIdle' },
          });
          return;
        }
        responseCancelling = true;
        setResponseState(RESPONSE_STATE.CANCELLING);
        sendJson(azureSocket, { type: 'response.cancel' });
        return;
      }

      if (event.type === 'session.end') {
        clientSocket.close();
      }
    });

    clientSocket.on('close', () => {
      clearSilenceTimer();
      try {
        azureSocket?.close();
      } catch {}
      realtimeSessionManager.deleteSession(session.sessionId, user.userId);
    });
  });

  return wss;
}

export default attachRealtimeAudioProxy;
