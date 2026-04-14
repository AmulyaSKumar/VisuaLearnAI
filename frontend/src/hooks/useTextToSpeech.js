import { useState, useRef, useCallback, useEffect } from 'react';

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
  const [voices, setVoices] = useState([]);
  const [currentVoice, setCurrentVoice] = useState(null);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const utteranceRef = useRef(null);
  const synthRef = useRef(null);

  // Initialize speech synthesis and load voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      setError('Text-to-speech is not supported in this browser');
      return;
    }

    synthRef.current = window.speechSynthesis;

    // Load voices
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

    // Chrome loads voices asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Cleanup
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [language, voiceName]);

  // Speak text
  const speak = useCallback((text) => {
    if (!synthRef.current || !text) return;

    // Cancel any current speech
    synthRef.current.cancel();
    setError(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = Math.max(0.1, Math.min(10, rate));
    utterance.pitch = Math.max(0, Math.min(2, pitch));
    utterance.volume = Math.max(0, Math.min(1, volume));

    if (currentVoice) {
      utterance.voice = currentVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        // Not an error, just user action
        return;
      }
      setError(`Speech error: ${event.error}`);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [language, rate, pitch, volume, currentVoice]);

  // Pause speech
  const pause = useCallback(() => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause();
    }
  }, [isSpeaking]);

  // Resume speech
  const resume = useCallback(() => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
    }
  }, [isPaused]);

  // Stop speech
  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

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
