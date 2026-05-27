import WebSocket from 'ws';
import { createTextCompletion } from '../openai/azure-client.js';
import { config, getRealtimeConfigStatus } from '../../config/environment.js';
import { createSessionUpdateEvent } from './payloadValidator.js';
import { traceRealtime } from './realtimeTrace.js';

const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2';

function getRealtimeConfig() {
  return {
    endpoint: config.azureRealtime.endpoint || '',
    apiKey: config.azureRealtime.apiKey || '',
    deployment: config.azureRealtime.deployment || DEFAULT_REALTIME_MODEL,
    apiVersion: config.azureRealtime.apiVersion || 'v1',
  };
}

function assertConfigured() {
  const config = getRealtimeConfig();
  const status = getRealtimeConfigStatus();
  if (!status.configured) {
    const error = new Error(`Azure realtime is not configured. Missing: ${status.missing.join(', ')}`);
    error.code = 'AZURE_REALTIME_NOT_CONFIGURED';
    error.missing = status.missing;
    throw error;
  }
  return config;
}

function normalizeEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed;
}

function buildRealtimeWebSocketUrl(config) {
  const base = normalizeEndpoint(config.endpoint);
  const url = new URL(base);

  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/openai/${config.apiVersion}/realtime`;
  url.search = '';
  url.searchParams.set('model', config.deployment);
  url.searchParams.set('api-key', config.apiKey);

  return url.toString();
}

function createRealtimeSessionPayload({ instructions }) {
  return { instructions };
}

async function postJson(url, body, apiKey) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || 'Azure realtime request failed.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export function createAzureRealtimeSocket() {
  const config = assertConfigured();
  const url = buildRealtimeWebSocketUrl(config);
  const socket = new WebSocket(url, ['realtime'], {
    followRedirects: true,
    maxRedirects: 3,
    headers: {
      'api-key': config.apiKey,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  socket.on('redirect', (redirectUrl) => {
    traceRealtime({
      stage: 'socketRedirect',
      payload: { from: url, to: redirectUrl },
    });
  });

  socket.on('unexpected-response', (_request, response) => {
    traceRealtime({
      stage: 'socketUnexpectedResponse',
      success: false,
      payload: {
        statusCode: response.statusCode,
        location: response.headers?.location,
      },
    });
  });

  return socket;
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out connecting to Azure realtime.')), 12000);
    socket.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('error', () => {
      clearTimeout(timeout);
      reject(new Error('Azure realtime WebSocket connection failed.'));
    });
  });
}

function parseRealtimeEvent(raw) {
  try {
    return JSON.parse(typeof raw === 'string' ? raw : raw?.data || raw?.toString?.() || '{}');
  } catch {
    return null;
  }
}

export class AzureRealtimeClient {
  isConfigured() {
    return getRealtimeConfigStatus().configured;
  }

  getStatus() {
    const status = getRealtimeConfigStatus();
    return {
      ...status,
      deployment: getRealtimeConfig().deployment || null,
    };
  }

  getModel() {
    return getRealtimeConfig().deployment;
  }

  async createSession({ instructions, modalities = ['text'], voice = 'alloy' }) {
    assertConfigured();
    return {
      id: `local_${Date.now()}`,
      model: getRealtimeConfig().deployment,
      modalities,
      voice,
      instructionsApplied: !!instructions,
    };
  }

  async updateSession({ instructions, modalities = ['text'], voice = 'alloy' }) {
    return this.createSession({ instructions, modalities, voice });
  }

  async streamTextTurn({ instructions, messages, input, onDelta }) {
    const socket = createAzureRealtimeSocket();
    let output = '';

    await waitForOpen(socket);

    const send = (event) => socket.send(JSON.stringify(event));
    send(createSessionUpdateEvent(createRealtimeSessionPayload({ instructions })));

    for (const message of messages.slice(-12)) {
      send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'input_text', text: message.content || '' }],
        },
      });
    }

    send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: input }],
      },
    });
    send({ type: 'response.create' });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { socket.close(); } catch {}
        reject(new Error('Azure realtime response timed out.'));
      }, 45000);

      socket.on('message', (raw) => {
        const event = parseRealtimeEvent(raw);
        if (!event) return;

        const delta = event.delta || event.text || event.transcript || event.response?.output_text_delta;
        if (
          event.type === 'response.text.delta' ||
          event.type === 'response.output_text.delta' ||
          event.type === 'response.audio_transcript.delta'
        ) {
          const text = String(delta || '');
          output += text;
          onDelta?.(text, event);
        }

        if (event.type === 'response.done' || event.type === 'response.completed') {
          clearTimeout(timeout);
          try { socket.close(); } catch {}
          resolve(output.trim());
        }

        if (event.type === 'error') {
          clearTimeout(timeout);
          try { socket.close(); } catch {}
          reject(new Error(event.error?.message || 'Azure realtime returned an error.'));
        }
      });

      socket.once('error', () => {
        clearTimeout(timeout);
        reject(new Error('Azure realtime WebSocket failed while streaming.'));
      });
    });
  }

  async generateTextTurn({ instructions, messages, input, onDelta }) {
    if (this.isConfigured()) {
      try {
        return await this.streamTextTurn({ instructions, messages, input, onDelta });
      } catch (error) {
        if (error.code !== 'AZURE_REALTIME_NOT_CONFIGURED') {
          console.warn('[RealtimeClient] Falling back to chat completion:', error.message);
        }
      }
    }

    const fallbackMessages = [
      ...messages.slice(-12).map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content || '',
      })),
      { role: 'user', content: input },
    ];
    const text = await createTextCompletion({
      system: instructions,
      messages: fallbackMessages,
      maxTokens: 900,
    });
    onDelta?.(text);
    return text;
  }
}

export const realtimeClient = new AzureRealtimeClient();

export default realtimeClient;
