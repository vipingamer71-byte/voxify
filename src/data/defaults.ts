import type { CustomMode, DevStack, VoxifySettings, WhisperConfig } from '../types/voxify';

export const PREDEFINED_MODES: CustomMode[] = [
  {
    id: 'mode-email',
    name: 'Email',
    description: 'Clean greeting, crisp paragraphs, clear action items, and sign-off.',
    instructions:
      'Format the dictated thoughts as a clear, ready-to-send email with an optional concise Subject line, structured body, and polite closing.',
    tone: 'Polite & Executive',
    language: 'Same as input',
    isPredefined: true,
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'mode-whatsapp',
    name: 'WhatsApp',
    description: 'Snappy, conversational messaging ready for instant chat.',
    instructions:
      'Convert the transcript into a brief, natural WhatsApp or Slack message. Keep sentences short, clear, and easy to read on mobile.',
    tone: 'Warm & Direct',
    language: 'Same as input',
    isPredefined: true,
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'mode-coding',
    name: 'Coding',
    description: 'Turns technical voice notes into structured specs, PR notes, or docstrings.',
    instructions:
      'Clean up technical terms, format identifiers in inline backticks, and organize into crisp engineering notes or PR summary bullets.',
    tone: 'Technical & Precise',
    language: 'English',
    isPredefined: true,
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'mode-professional',
    name: 'Professional',
    description: 'High-clarity business prose for proposals, briefs, and memos.',
    instructions:
      'Remove filler words and hesitations. Elevate phrasing for executive stakeholders while keeping the message concise and factual.',
    tone: 'Formal & Persuasive',
    language: 'Same as input',
    isPredefined: true,
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'mode-casual',
    name: 'Casual',
    description: 'Natural, relaxed phrasing that preserves everyday voice.',
    instructions:
      'Fix obvious typos and punctuation while keeping a relaxed, authentic conversational flow.',
    tone: 'Friendly & Natural',
    language: 'Same as input',
    isPredefined: true,
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'mode-social',
    name: 'Social Media',
    description: 'Punchy hook, clean rhythm, and high-engagement formatting for posts.',
    instructions:
      'Turn the spoken idea into an engaging LinkedIn or X post with a strong opening line, crisp line breaks, and zero fluff.',
    tone: 'Bold & Engaging',
    language: 'Same as input',
    isPredefined: true,
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
];

export const DEFAULT_SETTINGS: VoxifySettings = {
  general: {
    userName: '',
    appearance: 'obsidian-violet',
    compactDensity: false,
    defaultLanguageId: 'en-US',
    startupView: 'overview',
    autoCopyOnStop: false,
  },
  voice: {
    selectedMicId: 'default',
    speechLanguageId: 'en-US',
    autoPunctuation: true,
    continuousListening: true,
    interimResults: true,
    applyCustomVocabulary: true,
    preferredEngine: 'web-speech',
  },
  ai: {
    provider: 'Google Gemini (Server Proxy)',
    model: 'gemini-4-hydrogen',
    customInstructions: '',
  },
  privacy: {
    autoSaveHistory: true,
    storeChatLocally: true,
    analyticsTracking: true,
  },
};

export const DEFAULT_WHISPER_CONFIG: WhisperConfig = {
  endpointUrl: 'http://127.0.0.1:8080/inference',
  modelSize: 'base',
  threads: 4,
};

export const DEV_STACK_VOCAB: Record<DevStack, string[]> = {
  React: ['useState', 'useEffect', 'useCallback', 'useMemo', 'Suspense', 'JSX', 'Props', 'Server Components'],
  JavaScript: ['async/await', 'Promise.all', 'destructuring', 'Map/Set', 'fetch', 'AbortController', 'Closure'],
  TypeScript: ['interface', 'type union', 'generic <T>', 'Record<K, V>', 'Readonly', 'discriminated union', 'satisfies'],
  Python: ['FastAPI', 'Pydantic', 'asyncio', 'list comprehension', 'dataclass', 'pytest', 'typing.Optional'],
  HTML: ['semantic <main>', 'aria-label', '<section>', 'data-* attributes', 'tabindex', '<dialog>'],
  CSS: ['Tailwind grid', 'backdrop-filter', 'clamp()', 'tabular-nums', 'CSS variables', 'flexbox'],
  'Node.js': ['Express router', 'middleware', 'ReadableStream', 'EventEmitter', 'process.env', 'Buffer'],
  SQL: ['SELECT DISTINCT', 'INNER JOIN', 'GROUP BY', 'CTE WITH', 'PostgreSQL JSONB', 'CREATE INDEX'],
  APIs: ['RESTful GET/POST', 'Bearer Auth', 'Rate Limiting', 'OpenAPI 3.1', 'WebSockets', 'SSE Streaming'],
};
