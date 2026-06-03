import { useState, useRef, useCallback, useEffect } from 'react';
import { cleanTextForSpeech } from '../utils/cleanTextForSpeech';

const MAX_UTTERANCE_LENGTH = 180;
const SPEECH_KEEPALIVE_MS = 9000;

function splitTextForSpeech(text, maxLength = MAX_UTTERANCE_LENGTH) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?;:]+[.!?;:]?/g) || [normalized];
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = '';
  };

  for (const sentence of sentences) {
    const value = sentence.trim();
    if (!value) continue;

    if (value.length > maxLength) {
      pushCurrent();
      const words = value.split(/\s+/);
      let wordChunk = '';
      for (const word of words) {
        const next = wordChunk ? `${wordChunk} ${word}` : word;
        if (next.length > maxLength) {
          if (wordChunk) chunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = next;
        }
      }
      if (wordChunk) chunks.push(wordChunk);
      continue;
    }

    const next = current ? `${current} ${value}` : value;
    if (next.length > maxLength) {
      pushCurrent();
      current = value;
    } else {
      current = next;
    }
  }

  pushCurrent();
  return chunks;
}

/**
 * Hook for Text-to-Speech using Web Speech API
 * Handles voice selection, rate/pitch control, and playback state
 * @param {Object} options - Configuration options
 * @param {string} options.language - BCP 47 language tag (default: 'en-US')
 * @param {number} options.rate - Speech rate 0.1-10 (default: 1)
 * @param {number} options.pitch - Speech pitch 0-2 (default: 1)
 * @param {number} options.volume - Volume 0-1 (default: 1)
 * @param {string} options.voiceName - Preferred voice name (optional)
 */
export default function useTextToSpeech(options = {}) {
  const {
    language = 'en-US',
    rate = 1,
    pitch = 1,
    volume = 1,
    voiceName,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voices, setVoices] = useState([]);
  const [currentVoice, setCurrentVoice] = useState(null);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const utteranceRef = useRef(null);
  const synthRef = useRef(null);
  const chunksRef = useRef([]);
  const chunkIndexRef = useRef(0);
  const playbackIdRef = useRef(0);
  const keepAliveRef = useRef(null);

  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      window.clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const startKeepAlive = useCallback(() => {
    clearKeepAlive();
    keepAliveRef.current = window.setInterval(() => {
      const synth = synthRef.current;
      if (!synth || synth.paused || !synth.speaking) return;
      // Chrome can silently stall long speech queues; resume nudges it without restarting.
      synth.resume();
    }, SPEECH_KEEPALIVE_MS);
  }, [clearKeepAlive]);

  // Initialize speech synthesis and load voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      setError('Text-to-speech is not supported in this browser');
      return;
    }

    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      setVoices(availableVoices);

      // Find the best voice for the language
      const langVoices = availableVoices.filter(v => v.lang.startsWith(language.split('-')[0]));

      // Priority: specified voiceName > Google voices > default
      let selectedVoice = null;

      if (voiceName) {
        selectedVoice = availableVoices.find(v => v.name === voiceName);
      }

      if (!selectedVoice) {
        // Prefer Google voices as they tend to be higher quality
        selectedVoice = langVoices.find(v => v.name.includes('Google')) ||
                        langVoices.find(v => v.localService === false) ||
                        langVoices[0] ||
                        availableVoices[0];
      }

      if (selectedVoice) {
        setCurrentVoice(selectedVoice);
      }
    };

    loadVoices();

    if (typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      clearKeepAlive();
      if (speechSynthesis.removeEventListener) {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
      if (synthRef.current && utteranceRef.current) {
        playbackIdRef.current += 1;
        synthRef.current.cancel();
      }
    };
  }, [clearKeepAlive, language, voiceName]);

  const finishPlayback = useCallback((playbackId) => {
    if (playbackId !== playbackIdRef.current) return;
    clearKeepAlive();
    utteranceRef.current = null;
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
  }, [clearKeepAlive]);

  const speakChunk = useCallback((playbackId) => {
    const synth = synthRef.current;
    const chunk = chunksRef.current[chunkIndexRef.current];
    if (!synth || playbackId !== playbackIdRef.current) return;
    if (!chunk) {
      finishPlayback(playbackId);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = language;
    utterance.rate = Math.max(0.1, Math.min(10, rate));
    utterance.pitch = Math.max(0, Math.min(2, pitch));
    utterance.volume = Math.max(0, Math.min(1, volume));

    if (currentVoice) {
      utterance.voice = currentVoice;
    }

    utterance.onstart = () => {
      if (playbackId !== playbackIdRef.current) return;
      setIsLoading(false);
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      if (playbackId !== playbackIdRef.current) return;
      chunkIndexRef.current += 1;
      window.setTimeout(() => speakChunk(playbackId), 40);
    };

    utterance.onerror = (event) => {
      if (playbackId !== playbackIdRef.current) return;
      if (event.error === 'canceled' || event.error === 'interrupted') {
        setIsLoading(false);
        return;
      }
      clearKeepAlive();
      setError(`Speech error: ${event.error || 'playback failed'}`);
      setIsSpeaking(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    utterance.onpause = () => {
      if (playbackId !== playbackIdRef.current) return;
      setIsPaused(true);
    };

    utterance.onresume = () => {
      if (playbackId !== playbackIdRef.current) return;
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  }, [clearKeepAlive, currentVoice, finishPlayback, language, pitch, rate, volume]);

  // Speak text
  const speak = useCallback((text) => {
    if (!synthRef.current || !text) return;

    const speechText = cleanTextForSpeech(text);
    if (!speechText) return;
    const chunks = splitTextForSpeech(speechText);
    if (chunks.length === 0) return;

    playbackIdRef.current += 1;
    const playbackId = playbackIdRef.current;
    synthRef.current.cancel();
    chunksRef.current = chunks;
    chunkIndexRef.current = 0;
    setError(null);
    setIsLoading(true);
    startKeepAlive();

    window.setTimeout(() => speakChunk(playbackId), 60);
  }, [speakChunk, startKeepAlive]);

  // Pause speech
  const pause = useCallback(() => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking]);

  // Resume speech
  const resume = useCallback(() => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  // Stop speech
  const stop = useCallback(() => {
    if (synthRef.current) {
      playbackIdRef.current += 1;
      clearKeepAlive();
      synthRef.current.cancel();
      utteranceRef.current = null;
      chunksRef.current = [];
      chunkIndexRef.current = 0;
      setIsSpeaking(false);
      setIsPaused(false);
      setIsLoading(false);
    }
  }, [clearKeepAlive]);

  // Toggle pause/resume
  const togglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else if (isSpeaking) {
      pause();
    }
  }, [isPaused, isSpeaking, pause, resume]);

  // Change voice
  const setVoice = useCallback((voice) => {
    if (voice) {
      setCurrentVoice(voice);
    }
  }, []);

  // Get voices for a specific language
  const getVoicesForLanguage = useCallback((lang) => {
    return voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
  }, [voices]);

  return {
    isSpeaking,
    isPaused,
    isLoading,
    isSupported,
    voices,
    currentVoice,
    error,
    speak,
    pause,
    resume,
    stop,
    togglePause,
    setVoice,
    getVoicesForLanguage,
  };
}

// Named export for tree-shaking
export { useTextToSpeech };
