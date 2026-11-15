import type {
  AiAssistantMode,
  CustomMode,
  DevStack,
  RewriteAction,
  VocabularyItem,
} from '../types/voxify';

export interface HealthResponse {
  ok: boolean;
  geminiConfigured: boolean;
  defaultModel: string;
  streamingSupported?: boolean;
}

// Short-lived health cache (30s) to avoid redundant health calls across tab switches
let healthCache: { data: HealthResponse; ts: number } | null = null;

// Session LRU cache (max 25 entries) for identical deterministic rewrite calls
const rewriteCache = new Map<string, { text: string; model: string }>();

function setRewriteCache(key: string, value: { text: string; model: string }) {
  if (rewriteCache.size >= 25) {
    const oldest = rewriteCache.keys().next().value;
    if (oldest) rewriteCache.delete(oldest);
  }
  rewriteCache.set(key, value);
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

async function readSseStream(
  url: string,
  body: unknown,
  handlers: {
    onChunk: (delta: string, fullText: string) => void;
    onMeta?: (meta: { model?: string }) => void;
    signal?: AbortSignal;
  }
): Promise<{ text: string; model: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Streaming request failed (${res.status})`);
  }

  if (!res.body) {
    throw new Error('Streaming response body is unavailable.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let model = 'gemini-4-hydrogen';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const rawEvent of events) {
      const lines = rawEvent.split('\n');
      let eventType = 'message';
      let dataLine = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLine += line.slice(5).trim();
        }
      }

      if (!dataLine) continue;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(dataLine);
      } catch {
        continue;
      }

      if (eventType === 'meta') {
        if (typeof parsed.model === 'string') {
          model = parsed.model;
        }
        handlers.onMeta?.({ model });
      } else if (eventType === 'chunk') {
        const delta = typeof parsed.text === 'string' ? parsed.text : '';
        if (delta) {
          fullText += delta;
          handlers.onChunk(delta, fullText);
        }
      } else if (eventType === 'error') {
        throw new Error(
          typeof parsed.error === 'string' ? parsed.error : 'Gemini streaming error.'
        );
      } else if (eventType === 'done') {
        if (typeof parsed.model === 'string') model = parsed.model;
      }
    }
  }

  if (!fullText.trim()) {
    throw new Error('Gemini stream ended with an empty response.');
  }

  return { text: fullText, model };
}

export async function fetchApiHealth(forceRefresh = false): Promise<HealthResponse> {
  if (!forceRefresh && healthCache && Date.now() - healthCache.ts < 30000) {
    return healthCache.data;
  }
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error('Unable to reach VOXIFY backend server.');
  }
  const data = (await res.json()) as HealthResponse;
  healthCache = { data, ts: Date.now() };
  return data;
}

export async function streamAssistantChat(
  params: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    mode: AiAssistantMode;
    customMode?: CustomMode | null;
    targetLanguage?: string;
    model: string;
    customInstructions?: string;
    vocabulary?: VocabularyItem[];
  },
  onChunk: (delta: string, fullText: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; model: string }> {
  return readSseStream('/api/ai/chat/stream', params, { onChunk, signal });
}

export async function sendAssistantChat(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  mode: AiAssistantMode;
  customMode?: CustomMode | null;
  targetLanguage?: string;
  model: string;
  customInstructions?: string;
  vocabulary?: VocabularyItem[];
}): Promise<{ text: string; model: string }> {
  return postJson('/api/ai/chat', params);
}

export async function streamAiRewrite(
  params: {
    text: string;
    action?: RewriteAction;
    targetLanguage?: string;
    customMode?: CustomMode;
    model: string;
    customInstructions?: string;
    vocabulary?: VocabularyItem[];
  },
  onChunk: (delta: string, fullText: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; model: string }> {
  const cacheKey = JSON.stringify({
    text: params.text.trim(),
    action: params.action,
    targetLanguage: params.targetLanguage,
    modeId: params.customMode?.id,
    modeUpdated: params.customMode?.updatedAt,
    model: params.model,
    customInstructions: params.customInstructions,
  });

  const cached = rewriteCache.get(cacheKey);
  if (cached) {
    onChunk(cached.text, cached.text);
    return cached;
  }

  const res = await readSseStream('/api/ai/rewrite/stream', params, { onChunk, signal });
  setRewriteCache(cacheKey, res);
  return res;
}

export async function runAiRewrite(params: {
  text: string;
  action?: RewriteAction;
  targetLanguage?: string;
  customMode?: CustomMode;
  model: string;
  customInstructions?: string;
  vocabulary?: VocabularyItem[];
}): Promise<{ text: string; model: string }> {
  const cacheKey = JSON.stringify({
    text: params.text.trim(),
    action: params.action,
    targetLanguage: params.targetLanguage,
    modeId: params.customMode?.id,
    modeUpdated: params.customMode?.updatedAt,
    model: params.model,
    customInstructions: params.customInstructions,
  });
  const cached = rewriteCache.get(cacheKey);
  if (cached) return cached;

  const res = await postJson<{ text: string; model: string }>('/api/ai/rewrite', params);
  setRewriteCache(cacheKey, res);
  return res;
}

export async function streamDeveloperAi(
  params: {
    input: string;
    task: 'voice-to-code-prep' | 'code-format' | 'explain' | 'rewrite';
    language: DevStack;
    model: string;
    vocabulary?: VocabularyItem[];
  },
  onChunk: (delta: string, fullText: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; model: string }> {
  return readSseStream('/api/ai/developer/stream', params, { onChunk, signal });
}

export async function runDeveloperAi(params: {
  input: string;
  task: 'voice-to-code-prep' | 'code-format' | 'explain' | 'rewrite';
  language: DevStack;
  model: string;
  vocabulary?: VocabularyItem[];
}): Promise<{ text: string; model: string }> {
  return postJson('/api/ai/developer', params);
}
