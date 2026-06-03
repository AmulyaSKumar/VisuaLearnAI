/**
 * Environment Configuration
 * Load and validate environment variables
 * @module config/environment
 */

import dotenv from 'dotenv';

// Local development should use backend/.env as the source of truth. In
// production, platform variables from Render must not be overwritten.
dotenv.config({ override: process.env.NODE_ENV !== 'production' });

const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:5173';
const DEFAULT_PRODUCTION_FRONTEND_URL = 'https://visualearn-ai.vercel.app';
const DEFAULT_PRODUCTION_BACKEND_URL = 'https://visualearnai-backend.onrender.com';

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

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

const frontendUrl = normalizeUrl(
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? DEFAULT_PRODUCTION_FRONTEND_URL
    : DEFAULT_LOCAL_FRONTEND_URL)
);

const backendPublicUrl = normalizeUrl(
  process.env.BACKEND_PUBLIC_URL ||
  (process.env.NODE_ENV === 'production'
    ? DEFAULT_PRODUCTION_BACKEND_URL
    : `http://localhost:${process.env.PORT || 3001}`)
);

const configuredCorsOrigins = csv(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN);
const defaultCorsOrigins = [
  DEFAULT_LOCAL_FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:4173',
  DEFAULT_PRODUCTION_FRONTEND_URL,
  frontendUrl,
].filter(Boolean);

const corsOrigins = [...new Set(
  configuredCorsOrigins.length > 0
    ? [...configuredCorsOrigins, frontendUrl]
    : defaultCorsOrigins
)];

export function isAllowedCorsOrigin(origin) {
  if (!origin) return true;

  if (corsOrigins.includes(origin)) {
    return true;
  }

  // Allow Vercel preview URLs for this project when explicitly enabled.
  if (
    process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true' &&
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
  ) {
    return true;
  }

  return false;
}

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

  // Notion export integration
  notion: {
    clientId: process.env.NOTION_CLIENT_ID,
    clientSecret: process.env.NOTION_CLIENT_SECRET,
    redirectUri: process.env.NOTION_REDIRECT_URI || `${backendPublicUrl}/api/notion/callback`,
    version: process.env.NOTION_VERSION || '2026-03-11',
    tokenEncryptionKey: process.env.NOTION_TOKEN_ENCRYPTION_KEY,
  },

  frontendUrl,
  backendPublicUrl,

  // CORS
  cors: {
    origin: corsOrigins,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
