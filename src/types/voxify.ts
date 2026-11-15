export type NavSection =
  | 'overview'
  | 'dictation'
  | 'assistant'
  | 'rewrite'
  | 'history'
  | 'modes'
  | 'developer'
  | 'vocabulary'
  | 'integrations'
  | 'analytics'
  | 'settings';

export type RecordingState =
  | 'Ready'
  | 'Listening'
  | 'Paused'
  | 'Processing'
  | 'Completed'
  | 'Error';

export type SpeechEngineType = 'web-speech' | 'whisper-cpp-planned';

export type AiAssistantMode =
  | 'General Assistant'
  | 'Professional'
  | 'Developer'
  | 'Hinglish'
  | 'Email Writer'
  | 'Casual Chat'
  | 'Translator'
  | 'Summarizer'
  | 'Custom Mode';

export type RewriteAction =
  | 'Rewrite Text'
  | 'Fix Grammar'
  | 'Improve Professional Tone'
  | 'Make Friendly'
  | 'Shorten'
  | 'Expand Text'
  | 'Summarize'
  | 'Improve Clarity'
  | 'Translate'
  | 'Generate Email'
  | 'Generate Message'
  | 'Explain Text'
  | 'Convert to Bullet Points'
  | 'Clean Up Dictation'
  | 'Convert Hinglish to English'
  | 'Convert English to Hinglish'
  | 'Format Dictation'
  | 'Speech to Professional Email'
  | 'Speech to Developer Code';

export type DevStack =
  | 'React'
  | 'JavaScript'
  | 'TypeScript'
  | 'Python'
  | 'HTML'
  | 'CSS'
  | 'Node.js'
  | 'SQL'
  | 'APIs';

export type VocabularyCategory =
  | 'Names'
  | 'Company Names'
  | 'Technical Terminology'
  | 'Project Names'
  | 'Frequently Used Phrases';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName: string;
  bcp47: string;
  region: string;
  featured?: boolean;
  note?: string;
}

export interface VoiceHistoryEntry {
  id: string;
  uid?: string;
  title: string;
  transcript: string;
  createdAt: string;
  updatedAt?: string;
  durationSec: number;
  wordCount: number;
  languageId: string;
  languageName: string;
  engineUsed: string;
  modeUsed?: string;
}

export interface CustomMode {
  id: string;
  uid?: string;
  name: string;
  description: string;
  instructions: string;
  tone: string;
  language: string;
  isPredefined?: boolean;
  createdAt?: string;
  updatedAt: string;
}

export interface VocabularyItem {
  id: string;
  uid?: string;
  term: string;
  spokenAlias: string;
  category: VocabularyCategory;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

export interface ChatConversation {
  id: string;
  uid?: string;
  title: string;
  mode: AiAssistantMode;
  messages: ChatMessage[];
  createdAt?: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  uid?: string;
  date: string; // YYYY-MM-DD
  type: 'dictation' | 'ai_request';
  words: number;
  durationSec: number;
  languageName?: string;
  aiMode?: string;
  createdAt?: string;
}

export interface WhisperConfig {
  endpointUrl: string;
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  threads: number;
}

export interface VoxifySettings {
  general: {
    userName: string;
    appearance: 'obsidian-violet' | 'midnight-cyan' | 'carbon-minimal';
    compactDensity: boolean;
    defaultLanguageId: string;
    startupView: NavSection;
    autoCopyOnStop: boolean;
  };
  voice: {
    selectedMicId: string;
    speechLanguageId: string;
    autoPunctuation: boolean;
    continuousListening: boolean;
    interimResults: boolean;
    applyCustomVocabulary: boolean;
    preferredEngine: SpeechEngineType;
  };
  ai: {
    provider: 'Google Gemini (Server Proxy)';
    model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
    customInstructions: string;
  };
  privacy: {
    autoSaveHistory: boolean;
    storeChatLocally: boolean;
    analyticsTracking: boolean;
  };
}

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  email: string;
  plan: 'Free' | 'Pro' | 'Team';
  settings: VoxifySettings;
  whisperConfig?: WhisperConfig;
  createdAt?: string;
  updatedAt?: string;
}
