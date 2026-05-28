/**
 * Environment Configuration
 * Load and validate environment variables
 * @module config/environment
 */

import dotenv from 'dotenv';

// Load .env file.
// Local development often has stale Azure variables in the parent shell; the
// project .env should be the source of truth for this backend process.
dotenv.config({ override: true });

/**
 * Validate required environment variables
 */
function validateEnv() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_DEPLOYMENT',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

export function getRealtimeConfigStatus() {
  const required = [
    'AZURE_REALTIME_ENDPOINT',
    'AZURE_REALTIME_API_KEY',
    'AZURE_REALTIME_DEPLOYMENT',
  ];
  const missing = required.filter(key => !process.env[key]);

  return {
    configured: missing.length === 0,
    missing,
  };
}

const realtimeStatus = getRealtimeConfigStatus();
if (!realtimeStatus.configured) {
  console.warn('Realtime configuration incomplete', { missing: realtimeStatus.missing });
}

function getUrlHost(value) {
  try {
    return value ? new URL(value).host : null;
  } catch {
    return null;
  }
}

const embeddingEndpoint =
  process.env.AZURE_EMBEDDING_ENDPOINT ||
  process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT ||
  process.env.AZURE_OPENAI_ENDPOINT;
const embeddingEndpointHost = getUrlHost(embeddingEndpoint);
const chatEndpointHost = getUrlHost(process.env.AZURE_OPENAI_ENDPOINT);
const canReuseChatKeyForEmbeddings = Boolean(
  embeddingEndpointHost &&
  chatEndpointHost &&
  embeddingEndpointHost === chatEndpointHost
);

/**
 * Environment configuration object
 */
export const config = {
  // Server
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  // Azure OpenAI
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
    chatDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    embeddingEndpoint,
    embeddingApiKey:
      process.env.AZURE_EMBEDDING_API_KEY ||
      process.env.AZURE_OPENAI_EMBEDDING_API_KEY ||
      (canReuseChatKeyForEmbeddings ? process.env.AZURE_OPENAI_API_KEY : undefined),
    embeddingApiVersion: process.env.AZURE_EMBEDDING_API_VERSION || process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2023-05-15',
    embeddingDeployment: process.env.AZURE_EMBEDDING_DEPLOYMENT || process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002',
    embeddingModel: process.env.AZURE_EMBEDDING_MODEL || process.env.AZURE_OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
    imageEndpoint: process.env.AZURE_IMAGE_ENDPOINT,
    imageApiVersion: process.env.AZURE_IMAGE_API_VERSION || '2024-02-01',
    ttsModel: process.env.AZURE_TTS_MODEL,
  },

  azureRealtime: {
    endpoint: process.env.AZURE_REALTIME_ENDPOINT,
    apiKey: process.env.AZURE_REALTIME_API_KEY,
    deployment: process.env.AZURE_REALTIME_DEPLOYMENT || process.env.AZURE_REALTIME_MODEL,
    apiVersion: process.env.AZURE_REALTIME_API_VERSION || 'v1',
    transcriptionDeployment: process.env.AZURE_REALTIME_TRANSCRIPTION_DEPLOYMENT,
  },

  // Notion export integration
  notion: {
    clientId: process.env.NOTION_CLIENT_ID,
    clientSecret: process.env.NOTION_CLIENT_SECRET,
    redirectUri: process.env.NOTION_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}/api/notion/callback`,
    version: process.env.NOTION_VERSION || '2026-03-11',
    tokenEncryptionKey: process.env.NOTION_TOKEN_ENCRYPTION_KEY,
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // CORS
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'https://visualearn-ai.vercel.app',
        ],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
