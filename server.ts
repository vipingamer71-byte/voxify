import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);

function resolveModel(requestedModel: unknown): string {
  if (typeof requestedModel === 'string' && ALLOWED_MODELS.has(requestedModel)) {
    return requestedModel;
  }
  return 'gemini-4-hydrogen';
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable AI features.'
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; code?: number; message?: string };
  const rawMessage = errObj?.message || 'Unknown error communicating with Gemini API.';
  const status =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.code === 'number'
        ? errObj.code
        : 500;

  if (rawMessage.includes('API_KEY_INVALID') || status === 400) {
    if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
      return { status: 400, message: rawMessage };
    }
    return {
      status: 400,
      message: 'Gemini API request failed or API key is invalid. Verify your key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('PERMISSION_DENIED') || status === 403) {
    return {
      status: 403,
      message: 'Permission denied by Gemini API. Check your API key permissions in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
    return {
      status: 429,
      message: 'Gemini API quota exceeded. Wait briefly or check billing/quota in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('NOT_FOUND') || status === 404) {
    return {
      status: 404,
      message: 'Requested Gemini model was not found. Switch to gemini-4-hydrogen in AI Settings.',
    };
  }

  return { status: status >= 400 && status < 600 ? status : 500, message: rawMessage };
}

function buildChatSystemInstruction(params: {
  mode?: unknown;
  customMode?: { name?: string; instructions?: string; tone?: string; language?: string } | null;
  customInstructions?: unknown;
  vocabulary?: unknown;
  targetLanguage?: unknown;
}): string {
  const mode = String(params.mode || 'General Assistant');
  const targetLang =
    typeof params.targetLanguage === 'string' && params.targetLanguage.trim()
      ? params.targetLanguage.trim()
      : 'Spanish';

  const modeInstructions: Record<string, string> = {
    'General Assistant':
      'You are VOXIFY Assistant, an intelligent, fast, concise productivity partner. Respond in clean Markdown with clear structure.',
    Professional:
      'You are VOXIFY Executive Assistant. Respond with crisp executive clarity, structured takeaways, and polished business tone.',
    Developer:
      'You are VOXIFY Developer Copilot. Provide accurate, production-grade TypeScript, React, Python, SQL, Node.js, and API guidance with clean fenced code blocks and concise technical explanations.',
    Hinglish:
      'You are VOXIFY Hinglish Assistant. Communicate fluently in natural conversational Hinglish (Latin-script Hindi mixed naturally with English) matching modern Indian tech and everyday phrasing while keeping clarity high.',
    'Email Writer':
      'You are VOXIFY Email Writer. Draft complete, ready-to-send emails including a crisp Subject line, well-paced paragraphs or bullets, and an appropriate sign-off.',
    'Casual Chat':
      'You are VOXIFY Casual Companion. Keep responses warm, natural, concise, and conversational without stiff corporate phrasing.',
    Translator: `You are VOXIFY Precision Translator. Translate user inputs accurately into ${targetLang} while preserving nuance, idioms, and speaker intent. Include brief notes only if ambiguity exists.`,
    Summarizer:
      'You are VOXIFY Summarizer. Distill any pasted or dictated text into a tight executive summary followed by crisp bulleted key points and action items.',
    'Custom Mode': params.customMode
      ? `You are VOXIFY Custom Mode "${params.customMode.name || 'Custom'}". Follow these exact instructions: ${params.customMode.instructions || ''}. Tone: ${params.customMode.tone || 'Balanced'}. Output language: ${params.customMode.language || 'Same as input'}.`
      : 'You are VOXIFY Assistant following the user’s custom style instructions.',
  };

  const vocabHint =
    Array.isArray(params.vocabulary) && params.vocabulary.length > 0
      ? `\nUser domain vocabulary to spell and respect accurately: ${params.vocabulary
          .slice(0, 50)
          .map((v: { term?: string }) => v?.term)
          .filter(Boolean)
          .join(', ')}.`
      : '';

  const customHint =
    typeof params.customInstructions === 'string' && params.customInstructions.trim()
      ? `\nAdditional user preferences: ${params.customInstructions.trim()}`
      : '';

  return `${modeInstructions[mode] || modeInstructions['General Assistant']}${vocabHint}${customHint}`;
}

function buildRewriteDirective(params: {
  action?: unknown;
  targetLanguage?: unknown;
  customMode?: { name?: string; instructions?: string; tone?: string; language?: string } | null;
}): { taskDirective: string; systemInstructionPrefix: string } {
  const targetLang =
    typeof params.targetLanguage === 'string' && params.targetLanguage.trim()
      ? params.targetLanguage.trim()
      : 'Spanish';

  const actionPrompts: Record<string, string> = {
    'Rewrite Text':
      'Rewrite and elevate this text for clarity, flow, and impact while preserving the exact original meaning.',
    'Fix Grammar':
      'Fix all grammar, spelling, punctuation, and transcription artifacts while keeping the speaker’s exact voice and meaning.',
    'Improve Professional Tone':
      'Rewrite this text to sound polished, executive, and ready for professional or client communication while preserving meaning.',
    'Make Friendly':
      'Rewrite this text to sound warm, approachable, natural, and conversational without losing clarity.',
    Shorten:
      'Condense this text cleanly into fewer words while keeping every essential point intact.',
    'Expand Text':
      'Expand and enrich this text with helpful detail, smooth transitions, and fuller context while staying true to the core message.',
    Summarize: 'Summarize the key points clearly and concisely.',
    'Improve Clarity':
      'Restructure and refine this text for maximum readability, crisp flow, and zero ambiguity.',
    Translate: `Translate this text accurately and naturally into ${targetLang}, preserving tone and meaning.`,
    'Generate Email':
      'Turn this input into a complete, ready-to-send professional email with a concise Subject line, clear body, and polite closing.',
    'Generate Message':
      'Turn this input into a crisp, natural instant message ready for Slack, Teams, or WhatsApp.',
    'Explain Text':
      'Provide a clear, accessible explanation breaking down the meaning, intent, and key nuances of this text.',
    'Convert to Bullet Points':
      'Transform this text into clean, scannable, action-oriented bullet points.',
    // VOXIFY Voice Intelligence actions
    'Clean Up Dictation':
      'Clean up this raw voice dictation: remove filler words (um, uh, like, you know, basically), fix punctuation, capitalization, and run-on speech while strictly preserving the speaker’s exact meaning.',
    'Convert Hinglish to English':
      'Convert this Hinglish (mixed Hindi-English) spoken transcript into crisp, natural, grammatically accurate English while strictly preserving the original meaning and intent.',
    'Convert English to Hinglish':
      'Convert this English text into natural, conversational Hinglish (Latin-script Hindi mixed organically with everyday English) while preserving the original meaning.',
    'Format Dictation':
      'Format this raw spoken dictation into well-structured prose with logical paragraph breaks, clean punctuation, and clear formatting without changing the speaker’s meaning.',
    'Speech to Professional Email':
      'Convert this raw spoken voice note into a polished, ready-to-send professional email with a concise Subject line, clear paragraphs, and sign-off, preserving every detail.',
    'Speech to Developer Code':
      'Convert this spoken developer dictation into clean, idiomatic code with brief inline comments where helpful, matching the described intent.',
  };

  const actionStr = String(params.action || 'Improve Clarity');
  let taskDirective = actionPrompts[actionStr] || 'Improve and polish this text while preserving its original meaning.';

  if (params.customMode && typeof params.customMode === 'object') {
    const modeName = String(params.customMode.name || 'Custom');
    const modeInstructions = String(params.customMode.instructions || '');
    const modeTone = String(params.customMode.tone || 'Balanced');
    const modeLang = String(params.customMode.language || 'Same as input');
    taskDirective = `Apply the custom writing mode "${modeName}".
Instructions: ${modeInstructions}
Target tone: ${modeTone}
Output language: ${modeLang}`;
  }

  const isCodeOrExplain = actionStr === 'Speech to Developer Code' || actionStr === 'Explain Text';
  const systemInstructionPrefix = isCodeOrExplain
    ? 'You are VOXIFY Voice Intelligence Engine. Provide clean, accurate Markdown output directly without conversational filler.'
    : 'You are VOXIFY Voice Intelligence & Rewrite Engine. Return ONLY the resulting text—no preamble, no surrounding quotes, no meta-commentary.';

  return { taskDirective, systemInstructionPrefix };
}

function initSseHeaders(res: express.Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function sendSseEvent(res: express.Response, event: string, data: unknown) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const key = process.env.GEMINI_API_KEY?.trim();
    res.json({
      ok: true,
      geminiConfigured: Boolean(key && key !== 'MY_GEMINI_API_KEY'),
      defaultModel: 'gemini-4-hydrogen',
      streamingSupported: true,
    });
  });

  // Streaming Multi-turn AI Assistant chat endpoint (SSE)
  app.post('/api/ai/chat/stream', async (req, res) => {
    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    try {
      const { messages, mode, customMode, targetLanguage, model, customInstructions, vocabulary } =
        req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'At least one message is required.' });
      }

      const ai = getGeminiClient();
      const selectedModel = resolveModel(model);
      const systemInstruction = buildChatSystemInstruction({
        mode,
        customMode,
        customInstructions,
        vocabulary,
        targetLanguage,
      });

      const contents = messages.map((m: { role?: string; content?: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      }));

      const config: Record<string, unknown> = { systemInstruction };
      if (selectedModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      initSseHeaders(res);
      sendSseEvent(res, 'meta', { model: selectedModel });

      const stream = await ai.models.generateContentStream({
        model: selectedModel,
        contents,
        config,
      });

      let fullText = '';
      for await (const chunk of stream) {
        if (clientClosed || res.writableEnded) break;
        const delta = chunk.text || '';
        if (delta) {
          fullText += delta;
          sendSseEvent(res, 'chunk', { text: delta });
        }
      }

      if (!clientClosed && !res.writableEnded) {
        if (!fullText.trim()) {
          sendSseEvent(res, 'error', { error: 'Gemini returned an empty response.' });
        } else {
          sendSseEvent(res, 'done', { model: selectedModel });
        }
        res.end();
      }
    } catch (error) {
      const formatted = formatGeminiError(error);
      if (res.headersSent) {
        sendSseEvent(res, 'error', { error: formatted.message, status: formatted.status });
        res.end();
      } else {
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  });

  // Non-streaming chat fallback
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, mode, customMode, targetLanguage, model, customInstructions, vocabulary } =
        req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'At least one message is required.' });
      }

      const ai = getGeminiClient();
      const selectedModel = resolveModel(model);
      const systemInstruction = buildChatSystemInstruction({
        mode,
        customMode,
        customInstructions,
        vocabulary,
        targetLanguage,
      });

      const contents = messages.map((m: { role?: string; content?: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      }));

      const config: Record<string, unknown> = { systemInstruction };
      if (selectedModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      const text = response.text?.trim();
      if (!text) {
        return res.status(502).json({ error: 'Gemini returned an empty response.' });
      }

      return res.json({ text, model: selectedModel });
    } catch (error) {
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Streaming AI Rewrite & Voice Intelligence endpoint (SSE)
  app.post('/api/ai/rewrite/stream', async (req, res) => {
    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    try {
      const { text, action, targetLanguage, customMode, model, customInstructions, vocabulary } =
        req.body ?? {};

      if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Input text is required to process.' });
      }

      const ai = getGeminiClient();
      const selectedModel = resolveModel(model);
      const { taskDirective, systemInstructionPrefix } = buildRewriteDirective({
        action,
        targetLanguage,
        customMode,
      });

      const vocabHint =
        Array.isArray(vocabulary) && vocabulary.length > 0
          ? `\nPreserve these custom domain terms/spellings accurately when relevant: ${vocabulary
              .slice(0, 50)
              .map((v: { term?: string }) => v?.term)
              .filter(Boolean)
              .join(', ')}.`
          : '';

      const extraHint =
        typeof customInstructions === 'string' && customInstructions.trim()
          ? `\nGlobal user instructions: ${customInstructions.trim()}`
          : '';

      const systemInstruction = `${systemInstructionPrefix}${vocabHint}${extraHint}`;

      const config: Record<string, unknown> = { systemInstruction };
      if (selectedModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      initSseHeaders(res);
      sendSseEvent(res, 'meta', { model: selectedModel });

      const stream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: `${taskDirective}\n\nOriginal text:\n"""\n${text.trim()}\n"""`,
        config,
      });

      let fullText = '';
      for await (const chunk of stream) {
        if (clientClosed || res.writableEnded) break;
        const delta = chunk.text || '';
        if (delta) {
          fullText += delta;
          sendSseEvent(res, 'chunk', { text: delta });
        }
      }

      if (!clientClosed && !res.writableEnded) {
        if (!fullText.trim()) {
          sendSseEvent(res, 'error', { error: 'Gemini returned an empty rewrite.' });
        } else {
          sendSseEvent(res, 'done', { model: selectedModel });
        }
        res.end();
      }
    } catch (error) {
      const formatted = formatGeminiError(error);
      if (res.headersSent) {
        sendSseEvent(res, 'error', { error: formatted.message, status: formatted.status });
        res.end();
      } else {
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  });

  // Non-streaming AI Rewrite & Voice Intelligence endpoint
  app.post('/api/ai/rewrite', async (req, res) => {
    try {
      const { text, action, targetLanguage, customMode, model, customInstructions, vocabulary } =
        req.body ?? {};

      if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Input text is required to rewrite.' });
      }

      const ai = getGeminiClient();
      const selectedModel = resolveModel(model);
      const { taskDirective, systemInstructionPrefix } = buildRewriteDirective({
        action,
        targetLanguage,
        customMode,
      });

      const vocabHint =
        Array.isArray(vocabulary) && vocabulary.length > 0
          ? `\nPreserve these custom domain terms/spellings accurately when relevant: ${vocabulary
              .slice(0, 50)
              .map((v: { term?: string }) => v?.term)
              .filter(Boolean)
              .join(', ')}.`
          : '';

      const extraHint =
        typeof customInstructions === 'string' && customInstructions.trim()
          ? `\nGlobal user instructions: ${customInstructions.trim()}`
          : '';

      const systemInstruction = `${systemInstructionPrefix}${vocabHint}${extraHint}`;

      const config: Record<string, unknown> = { systemInstruction };
      if (selectedModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `${taskDirective}\n\nOriginal text:\n"""\n${text.trim()}\n"""`,
        config,
      });

      const rewritten = response.text?.trim();
      if (!rewritten) {
        return res.status(502).json({ error: 'Gemini returned an empty rewrite.' });
      }

      return res.json({ text: rewritten, model: selectedModel });
    } catch (error) {
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Streaming Developer Mode AI endpoint (SSE)
  app.post('/api/ai/developer/stream', async (req, res) => {
    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    try {
      const { input, task, language, model, vocabulary } = req.body ?? {};
      if (typeof input !== 'string' || !input.trim()) {
        return res.status(400).json({ error: 'Code or spoken developer intent is required.' });
      }

      const ai = getGeminiClient();
      const selectedModel = resolveModel(model);
      const stack = typeof language === 'string' && language.trim() ? language.trim() : 'TypeScript';

      const taskMap: Record<string, string> = {
        'voice-to-code-prep': `The user dictated a technical intent or spoken pseudocode for ${stack}.
1. First normalize their spoken intent into a crisp 1-2 line engineering specification.
2. Then generate clean, idiomatic, production-ready ${stack} code implementing that intent.
Be explicit about any assumptions made if spoken input was underspecified.`,
        'code-format': `Cleanly format, structure, add accurate types/docstrings where helpful, and improve readability of this ${stack} code without changing its behavior. Return clean markdown with the formatted code block.`,
        explain: `Provide a clear, senior-engineer technical explanation of what this ${stack} snippet or concept does, covering control flow, edge cases, and complexity.`,
        rewrite: `Refactor and rewrite this ${stack} code to be cleaner, safer, more idiomatic, and modern. Briefly list the key improvements after the code block.`,
      };

      const directive = taskMap[String(task || 'voice-to-code-prep')] || taskMap['voice-to-code-prep'];
      const vocabHint =
        Array.isArray(vocabulary) && vocabulary.length > 0
          ? `\nProject/technical vocabulary to respect: ${vocabulary
              .slice(0, 50)
              .map((v: { term?: string }) => v?.term)
              .filter(Boolean)
              .join(', ')}.`
          : '';

      const config: Record<string, unknown> = {
        systemInstruction: `You are VOXIFY Developer Mode AI. Focus on ${stack} and modern software engineering best practices.${vocabHint}`,
      };
      if (selectedModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      initSseHeaders(res);
      sendSseEvent(res, 'meta', { model: selectedModel });

      const stream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: `${directive}\n\nInput:\n\`\`\`\n${input.trim()}\n\`\`\``,
        config,
      });

      let fullText = '';
      for await (const chunk of stream) {
        if (clientClosed || res.writableEnded) break;
        const delta = chunk.text || '';
        if (delta) {
          fullText += delta;
          sendSseEvent(res, 'chunk', { text: delta });
        }
      }

      if (!clientClosed && !res.writableEnded) {
        if (!fullText.trim()) {
          sendSseEvent(res, 'error', { error: 'Gemini returned an empty response.' });
        } else {
          sendSseEvent(res, 'done', { model: selectedModel });
        }
        res.end();
      }
    } catch (error) {
      const formatted = formatGeminiError(error);
      if (res.headersSent) {
        sendSseEvent(res, 'error', { error: formatted.message, status: formatted.status });
        res.end();
      } else {
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  });

  // Non-streaming Developer endpoint kept for compatibility
  app.post('/api/ai/developer', async (req, res) => {
    try {
      const { input, task, language, model, vocabulary } = req.body ?? {};
      if (typeof input !== 'string' || !input.trim()) {
        return res.status(400).json({ error: 'Code or spoken developer intent is required.' });
      }

      const ai = getGeminiClient();
      const selectedModel = resolveModel(model);
      const stack = typeof language === 'string' && language.trim() ? language.trim() : 'TypeScript';

      const taskMap: Record<string, string> = {
        'voice-to-code-prep': `The user dictated a technical intent or spoken pseudocode for ${stack}.
1. First normalize their spoken intent into a crisp 1-2 line engineering specification.
2. Then generate clean, idiomatic, production-ready ${stack} code implementing that intent.
Be explicit about any assumptions made if spoken input was underspecified.`,
        'code-format': `Cleanly format, structure, add accurate types/docstrings where helpful, and improve readability of this ${stack} code without changing its behavior. Return clean markdown with the formatted code block.`,
        explain: `Provide a clear, senior-engineer technical explanation of what this ${stack} snippet or concept does, covering control flow, edge cases, and complexity.`,
        rewrite: `Refactor and rewrite this ${stack} code to be cleaner, safer, more idiomatic, and modern. Briefly list the key improvements after the code block.`,
      };

      const directive = taskMap[String(task || 'voice-to-code-prep')] || taskMap['voice-to-code-prep'];
      const vocabHint =
        Array.isArray(vocabulary) && vocabulary.length > 0
          ? `\nProject/technical vocabulary to respect: ${vocabulary
              .slice(0, 50)
              .map((v: { term?: string }) => v?.term)
              .filter(Boolean)
              .join(', ')}.`
          : '';

      const config: Record<string, unknown> = {
        systemInstruction: `You are VOXIFY Developer Mode AI. Focus on ${stack} and modern software engineering best practices.${vocabHint}`,
      };
      if (selectedModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `${directive}\n\nInput:\n\`\`\`\n${input.trim()}\n\`\`\``,
        config,
      });

      const output = response.text?.trim();
      if (!output) {
        return res.status(502).json({ error: 'Gemini returned an empty response.' });
      }

      return res.json({ text: output, model: selectedModel });
    } catch (error) {
      const formatted = formatGeminiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VOXIFY server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
