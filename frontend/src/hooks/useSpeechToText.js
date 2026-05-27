import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook for Speech-to-Text using Web Speech API
 * Handles browser compatibility, continuous listening, and interim results
 * @param {Object} options - Configuration options
 * @param {string} options.language - BCP 47 language tag (default: 'en-US')
 * @param {boolean} options.continuous - Keep listening after speech ends (default: false)
 * @param {boolean} options.interimResults - Return interim results (default: true)
 * @param {number} options.silenceTimeoutMs - Stop after silence/idle time (default: 3000)
 * @param {Function} options.onResult - Callback when speech is recognized
 * @param {Function} options.onError - Callback when an error occurs
 */
export default function useSpeechToText(options = {}) {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    silenceTimeoutMs = 3000,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (!silenceTimeoutMs) return;
    silenceTimerRef.current = window.setTimeout(() => {
      recognitionRef.current?.stop();
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs]);

  // Keep callbacks up to date
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      resetSilenceTimer();
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      resetSilenceTimer();

      if (finalText) {
        setTranscript(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${finalText}`.trimStart());
        onResultRef.current?.(finalText);
      }

      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error occurred. Please check your connection.';
          break;
        case 'aborted':
          // User aborted, not an error
          return;
        default:
          errorMessage = `Error: ${event.error}`;
      }

      setError(errorMessage);
      setIsListening(false);
      onErrorRef.current?.(errorMessage);
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [clearSilenceTimer, continuous, interimResults, language, resetSilenceTimer]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not initialized');
      return;
    }

    setTranscript('');
    setInterimTranscript('');
    setError(null);

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Recognition might already be running
      if (err.name === 'InvalidStateError') {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            setError('Failed to start speech recognition');
          }
        }, 100);
      } else {
        setError('Failed to start speech recognition');
      }
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [clearSilenceTimer]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}

// Named export for tree-shaking
export { useSpeechToText };
