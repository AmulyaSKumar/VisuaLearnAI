/**
 * Environment Configuration
 * Load and validate environment variables
 * @module config/environment
 */

import dotenv from 'dotenv';

// Load .env file
dotenv.config();

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
    imageEndpoint: process.env.AZURE_IMAGE_ENDPOINT,
    imageApiVersion: process.env.AZURE_IMAGE_API_VERSION || '2024-02-01',
    ttsModel: process.env.AZURE_TTS_MODEL,
    // Realtime Voice API - provide full URL with deployment
    // e.g., https://your-resource.cognitiveservices.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-realtime-1.5
    realtimeEndpoint: process.env.AZURE_REALTIME_ENDPOINT,
    realtimeApiKey: process.env.AZURE_REALTIME_API_KEY,
    realtimeModel: process.env.AZURE_REALTIME_MODEL || 'gpt-realtime-1.5',
  },

  // Notion export integration
  notion: {
    clientId: process.env.NOTION_CLIENT_ID,
    clientSecret: process.env.NOTION_CLIENT_SECRET,
    redirectUri: process.env.NOTION_REDIRECT_URI,
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
