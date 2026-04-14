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
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL',
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

  // Anthropic
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
  },

  // Azure OpenAI
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    imageEndpoint: process.env.AZURE_IMAGE_ENDPOINT,
    imageApiVersion: process.env.AZURE_IMAGE_API_VERSION || '2024-02-01',
    ttsModel: process.env.AZURE_TTS_MODEL,
    realtimeEndpoint: process.env.AZURE_REALTIME_ENDPOINT,
    realtimeApiKey: process.env.AZURE_REALTIME_API_KEY,
  },

  // CORS
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
