import type { SpeechEngineType, VocabularyItem } from '../types/voxify';

// Minimal TypeScript declarations for Web Speech API
export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function getBrowserSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isWebSpeechSupported(): boolean {
  return getBrowserSpeechRecognition() !== null;
}

export function isMicrophoneApiSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator?.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}

/**
 * Applies user-defined Custom Vocabulary aliases/casing to dictated text.
 */
export function applyVocabularyNormalization(
  text: string,
  vocabulary: VocabularyItem[]
): string {
  let result = text;
  for (const item of vocabulary) {
    const term = item.term.trim();
    if (!term) continue;

    // Replace spoken alias if provided
    const alias = item.spokenAlias.trim();
    if (alias) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const aliasRegex = new RegExp(`\\b${escapedAlias}\\b`, 'gi');
      result = result.replace(aliasRegex, term);
    }

    // Enforce exact casing of the term
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const termRegex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
    result = result.replace(termRegex, term);
  }
  return result;
}

/**
 * Normalizes spoken developer terminology into crisp code tokens prior to AI code prep.
 */
export function applyDeveloperVoiceTokens(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bopen paren\b/gi, '('],
    [/\bclose paren\b/gi, ')'],
    [/\bopen brace\b/gi, '{'],
    [/\bclose brace\b/gi, '}'],
    [/\bopen bracket\b/gi, '['],
    [/\bclose bracket\b/gi, ']'],
    [/\barrow function\b/gi, '=>'],
    [/\btriple equals\b/gi, '==='],
    [/\bdouble equals\b/gi, '=='],
    [/\bnot equals\b/gi, '!=='],
    [/\bsemicolon\b/gi, ';'],
    [/\bnew line\b/gi, '\n'],
    [/\buse state\b/gi, 'useState'],
    [/\buse effect\b/gi, 'useEffect'],
    [/\buse memo\b/gi, 'useMemo'],
    [/\buse callback\b/gi, 'useCallback'],
    [/\basync await\b/gi, 'async/await'],
    [/\btry catch\b/gi, 'try/catch'],
    [/\btype script\b/gi, 'TypeScript'],
    [/\bjava script\b/gi, 'JavaScript'],
    [/\bnode js\b/gi, 'Node.js'],
  ];

  let out = text;
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Extensible Speech Engine descriptor so Phase 2 Whisper.cpp (WASM / local daemon)
 * can plug into the exact same session lifecycle without rewriting UI views.
 */
export interface SpeechEngineAdapterInfo {
  id: SpeechEngineType;
  label: string;
  available: boolean;
  offlineCapable: boolean;
  description: string;
}

export const SPEECH_ENGINE_ADAPTERS: SpeechEngineAdapterInfo[] = [
  {
    id: 'web-speech',
    label: 'Browser SpeechRecognition API',
    available: isWebSpeechSupported(),
    offlineCapable: false,
    description:
      'Active Phase 1 engine using your browser’s built-in SpeechRecognition service with real-time interim captions.',
  },
  {
    id: 'whisper-cpp-planned',
    label: 'Whisper.cpp Local Adapter (Phase 2)',
    available: false,
    offlineCapable: true,
    description:
      'Architecture slot prepared for local whisper.cpp WASM or desktop bridge integration. Offline inference is not active in Phase 1.',
  },
];

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function mapSpeechErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow microphone permission in your browser site settings and try again.';
    case 'audio-capture':
      return 'No active microphone was detected. Connect an input device or select another microphone in Settings.';
    case 'no-speech':
      return 'No speech was detected. Speak clearly near your microphone and try again.';
    case 'network':
      return 'Browser speech recognition requires an active network connection in this browser.';
    case 'aborted':
      return 'Dictation session was stopped.';
    default:
      return `Speech recognition reported an error (${errorCode}).`;
  }
}
