/**
 * TTS (Text-to-Speech) API Routes
 * Uses Azure OpenAI gpt-audio model for audio generation
 */
import { Router } from 'express';
import https from 'https';

const router = Router();

// Azure OpenAI configuration (from environment or fallback)
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://amuly-mh65e9uu-eastus2.cognitiveservices.azure.com';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const TTS_MODEL = 'gpt-audio-1.5';
const API_VERSION = '2025-01-01-preview';

/**
 * POST /api/tts
 * Convert text to speech
 */
router.post('/', async (req, res) => {
  const { text, voice = 'alloy' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  // If no API key configured, return a graceful fallback
  if (!AZURE_API_KEY) {
    console.warn('[TTS] Azure OpenAI API key not configured');
    return res.status(503).json({
      error: 'TTS service not configured',
      message: 'Audio playback is not available. Please configure Azure OpenAI credentials.'
    });
  }

  try {
    const hostname = new URL(AZURE_ENDPOINT).hostname;
    const path = `/openai/deployments/${TTS_MODEL}/chat/completions?api-version=${API_VERSION}`;

    const body = JSON.stringify({
      messages: [{ role: 'user', content: text }],
      modalities: ['text', 'audio'],
      audio: { voice, format: 'mp3' },
      max_tokens: 1000,
    });

    const result = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname,
        path,
        method: 'POST',
        headers: {
          'api-key': AZURE_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              const audioData = parsed.choices?.[0]?.message?.audio?.data;
              const transcript = parsed.choices?.[0]?.message?.audio?.transcript;

              if (audioData) {
                resolve({ audio: audioData, transcript });
              } else {
                resolve({ error: 'No audio in response', text: parsed.choices?.[0]?.message?.content });
              }
            } catch (e) {
              reject(new Error('Failed to parse TTS response'));
            }
          } else {
            reject(new Error(`TTS API error: ${response.statusCode}`));
          }
        });
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });

    res.json(result);

  } catch (error) {
    console.error('[TTS] Error:', error.message);
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
});

export default router;
