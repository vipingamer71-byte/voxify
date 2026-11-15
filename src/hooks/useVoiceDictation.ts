import { useCallback, useEffect, useRef, useState } from 'react';
import { getLanguageById } from '../data/languages';
import {
  applyDeveloperVoiceTokens,
  applyVocabularyNormalization,
  getBrowserSpeechRecognition,
  mapSpeechErrorMessage,
  type SpeechRecognitionInstance,
} from '../services/speechEngine';
import type { RecordingState, VocabularyItem } from '../types/voxify';

interface UseVoiceDictationOptions {
  languageId: string;
  continuous?: boolean;
  interimResults?: boolean;
  selectedMicId?: string;
  vocabulary?: VocabularyItem[];
  applyVocabulary?: boolean;
  developerMode?: boolean;
  onSessionComplete?: (payload: {
    transcript: string;
    durationSec: number;
    languageId: string;
  }) => void;
}

const BAND_COUNT = 28;
const IDLE_BANDS = new Array(BAND_COUNT).fill(0.08);

export function useVoiceDictation(options: UseVoiceDictationOptions) {
  const {
    languageId,
    continuous = true,
    interimResults = true,
    selectedMicId = 'default',
    vocabulary = [],
    applyVocabulary = true,
    developerMode = false,
    onSessionComplete,
  } = options;

  const [state, setState] = useState<RecordingState>('Ready');
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyBands, setFrequencyBands] = useState<number[]>(IDLE_BANDS);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stateRef = useRef<RecordingState>('Ready');
  const finalTextRef = useRef('');
  const durationRef = useRef(0);
  const manualStopRef = useRef(false);
  const pausedRef = useRef(false);
  const startingRef = useRef(false);
  const lastUiPaintRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);

  useEffect(() => {
    durationRef.current = durationSec;
  }, [durationSec]);

  const stopAudioMonitor = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
    setFrequencyBands(IDLE_BANDS);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  const startAudioMonitor = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) return;
    // Reuse active stream if already capturing
    if (streamRef.current && streamRef.current.active && audioCtxRef.current) {
      return;
    }

    try {
      const audioConstraints: MediaTrackConstraints | boolean =
        selectedMicId && selectedMicId !== 'default'
          ? { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      // If stopped while waiting for permission, clean up immediately
      if (manualStopRef.current || pausedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setPermissionStatus('granted');

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.max(1, Math.floor(dataArray.length / BAND_COUNT));

      const tick = (now: number) => {
        if (!audioCtxRef.current) return;
        // Throttle React state updates to ~30fps (33ms) for buttery UI without excessive re-renders
        if (now - lastUiPaintRef.current >= 33) {
          lastUiPaintRef.current = now;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          const bands = new Array<number>(BAND_COUNT);
          for (let i = 0; i < BAND_COUNT; i++) {
            const val = dataArray[Math.min(i * step, dataArray.length - 1)] / 255;
            bands[i] = Math.max(0.08, Math.min(1, val * 1.25));
            sum += val;
          }
          setAudioLevel(Math.min(1, (sum / BAND_COUNT) * 1.8));
          setFrequencyBands(bands);
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setErrorMessage(
          'Microphone permission was denied. Please grant microphone access in your browser bar.'
        );
      }
    }
  }, [selectedMicId]);

  const normalizeChunk = useCallback(
    (raw: string): string => {
      let processed = raw.trim();
      if (!processed) return '';
      if (developerMode) {
        processed = applyDeveloperVoiceTokens(processed);
      }
      if (applyVocabulary && vocabulary.length > 0) {
        processed = applyVocabularyNormalization(processed, vocabulary);
      }
      return processed;
    },
    [applyVocabulary, developerMode, vocabulary]
  );

  const launchRecognition = useCallback(() => {
    const RecognitionCtor = getBrowserSpeechRecognition();
    if (!RecognitionCtor) {
      setState('Error');
      setErrorMessage(
        'Browser SpeechRecognition API is not supported in this browser. Try Chrome, Edge, or Safari, or type/paste text directly.'
      );
      return false;
    }

    // Abort any dangling instance to prevent duplicate capture
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    const lang = getLanguageById(languageId);
    const rec = new RecognitionCtor();
    rec.continuous = continuous;
    rec.interimResults = interimResults;
    rec.lang = lang.bcp47;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setErrorMessage(null);
      setState('Listening');
    };

    rec.onresult = (event) => {
      let interim = '';
      let addedFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          const cleaned = normalizeChunk(transcript);
          if (cleaned) {
            addedFinal += (addedFinal ? ' ' : '') + cleaned;
          }
        } else {
          interim += transcript;
        }
      }

      if (addedFinal) {
        setFinalText((prev) => {
          const base = prev.trimEnd();
          return base ? `${base} ${addedFinal}` : addedFinal;
        });
      }
      setInterimText(interim);
    };

    rec.onerror = (event) => {
      if (event.error === 'aborted' && (manualStopRef.current || pausedRef.current)) {
        return;
      }
      if (event.error === 'no-speech' && continuous && !manualStopRef.current && !pausedRef.current) {
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermissionStatus('denied');
      }
      setErrorMessage(mapSpeechErrorMessage(event.error));
      setState('Error');
      stopTimer();
      stopAudioMonitor();
    };

    rec.onend = () => {
      setInterimText('');
      if (pausedRef.current) {
        return;
      }
      if (!manualStopRef.current && continuous && stateRef.current === 'Listening') {
        try {
          rec.start();
          return;
        } catch {
          // fall through to completion
        }
      }

      if (manualStopRef.current) {
        const finalSnapshot = finalTextRef.current.trim();
        setState(finalSnapshot ? 'Completed' : 'Ready');
        if (finalSnapshot && onSessionComplete) {
          onSessionComplete({
            transcript: finalSnapshot,
            durationSec: durationRef.current,
            languageId,
          });
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      return true;
    } catch (err) {
      setState('Error');
      setErrorMessage(err instanceof Error ? err.message : 'Unable to start speech recognition.');
      return false;
    }
  }, [
    continuous,
    interimResults,
    languageId,
    normalizeChunk,
    onSessionComplete,
    stopAudioMonitor,
    stopTimer,
  ]);

  const start = useCallback(async () => {
    // Prevent duplicate concurrent microphone requests
    if (startingRef.current || stateRef.current === 'Listening') return;
    startingRef.current = true;
    setErrorMessage(null);
    manualStopRef.current = false;
    pausedRef.current = false;

    if (
      stateRef.current === 'Completed' ||
      stateRef.current === 'Ready' ||
      stateRef.current === 'Error'
    ) {
      setDurationSec(0);
    }

    // Launch SpeechRecognition immediately for instant capture alongside audio analyzer
    setState('Listening');
    const started = launchRecognition();
    if (started) {
      startTimer();
      void startAudioMonitor();
    } else {
      stopAudioMonitor();
    }
    startingRef.current = false;
  }, [launchRecognition, startAudioMonitor, startTimer, stopAudioMonitor]);

  const pause = useCallback(() => {
    if (stateRef.current !== 'Listening') return;
    pausedRef.current = true;
    manualStopRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    stopTimer();
    stopAudioMonitor();
    setInterimText('');
    setState('Paused');
  }, [stopAudioMonitor, stopTimer]);

  const resume = useCallback(async () => {
    if (startingRef.current || stateRef.current !== 'Paused') return;
    startingRef.current = true;
    pausedRef.current = false;
    manualStopRef.current = false;
    setState('Listening');
    const started = launchRecognition();
    if (started) {
      startTimer();
      void startAudioMonitor();
    } else {
      stopAudioMonitor();
    }
    startingRef.current = false;
  }, [launchRecognition, startAudioMonitor, startTimer, stopAudioMonitor]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    pausedRef.current = false;
    startingRef.current = false;
    setState('Processing');
    stopTimer();
    stopAudioMonitor();
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }

    window.setTimeout(() => {
      if (stateRef.current === 'Processing') {
        const snapshot = finalTextRef.current.trim();
        setState(snapshot ? 'Completed' : 'Ready');
      }
    }, 250);
  }, [stopAudioMonitor, stopTimer]);

  const clear = useCallback(() => {
    manualStopRef.current = true;
    pausedRef.current = false;
    startingRef.current = false;
    stopTimer();
    stopAudioMonitor();
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    setFinalText('');
    setInterimText('');
    setDurationSec(0);
    setErrorMessage(null);
    setState('Ready');
  }, [stopAudioMonitor, stopTimer]);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      stopTimer();
      stopAudioMonitor();
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [stopAudioMonitor, stopTimer]);

  const combinedText = interimText
    ? `${finalText}${finalText ? ' ' : ''}${interimText}`
    : finalText;

  return {
    state,
    setState,
    finalText,
    setFinalText,
    interimText,
    combinedText,
    errorMessage,
    setErrorMessage,
    durationSec,
    audioLevel,
    frequencyBands,
    permissionStatus,
    start,
    pause,
    resume,
    stop,
    clear,
  };
}
