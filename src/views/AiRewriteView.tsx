import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Square,
} from 'lucide-react';
import { LANGUAGES, getLanguageById } from '../data/languages';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { streamAiRewrite } from '../services/api';
import { countWords } from '../services/speechEngine';
import type {
  ActivityEvent,
  CustomMode,
  RewriteAction,
  VocabularyItem,
  VoxifySettings,
} from '../types/voxify';

interface AiRewriteViewProps {
  initialText: string;
  settings: VoxifySettings;
  customModes: CustomMode[];
  vocabulary: VocabularyItem[];
  onLogActivity: (event: Omit<ActivityEvent, 'id' | 'date'>) => void;
}

const WRITING_TOOLS: RewriteAction[] = [
  'Rewrite Text',
  'Fix Grammar',
  'Improve Professional Tone',
  'Summarize',
  'Expand Text',
  'Translate',
  'Generate Email',
  'Generate Message',
  'Explain Text',
  'Make Friendly',
  'Shorten',
  'Improve Clarity',
  'Convert to Bullet Points',
];

const VOICE_INTELLIGENCE_TOOLS: RewriteAction[] = [
  'Clean Up Dictation',
  'Convert Hinglish to English',
  'Convert English to Hinglish',
  'Format Dictation',
  'Speech to Professional Email',
  'Speech to Developer Code',
];

export const AiRewriteView: React.FC<AiRewriteViewProps> = ({
  initialText,
  settings,
  customModes,
  vocabulary,
  onLogActivity,
}) => {
  const [original, setOriginal] = useState(initialText);
  const [output, setOutput] = useState('');
  const [activeAction, setActiveAction] = useState<string>('Rewrite Text');
  const [translateLangId, setTranslateLangId] = useState('es-ES');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const voice = useVoiceDictation({
    languageId: settings.voice.speechLanguageId,
    continuous: true,
    interimResults: true,
    selectedMicId: settings.voice.selectedMicId,
    vocabulary,
    applyVocabulary: settings.voice.applyCustomVocabulary,
  });

  useEffect(() => {
    if (initialText) setOriginal(initialText);
  }, [initialText]);

  useEffect(() => {
    if (voice.finalText.trim()) {
      setOriginal((prev) => {
        const spoken = voice.finalText.trim();
        return prev ? `${prev.trim()} ${spoken}` : spoken;
      });
      voice.setFinalText('');
    }
  }, [voice.finalText, voice.setFinalText]);

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    setLoading(false);
  };

  const executeRewrite = async (action: RewriteAction) => {
    if (!original.trim() || runningRef.current) return;
    runningRef.current = true;
    setActiveAction(action);
    setLoading(true);
    setError(null);
    setOutput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const targetLang = getLanguageById(translateLangId).name;
      const res = await streamAiRewrite(
        {
          text: original,
          action,
          targetLanguage: action === 'Translate' ? targetLang : undefined,
          model: settings.ai.model,
          customInstructions: settings.ai.customInstructions,
          vocabulary,
        },
        (_delta, fullText) => {
          setOutput(fullText);
        },
        controller.signal
      );
      setOutput(res.text);
      onLogActivity({
        type: 'ai_request',
        words: countWords(res.text),
        durationSec: 0,
        aiMode: action,
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Rewrite failed.');
      }
    } finally {
      setLoading(false);
      runningRef.current = false;
      abortRef.current = null;
    }
  };

  const executeCustomMode = async (mode: CustomMode) => {
    if (!original.trim() || runningRef.current) return;
    runningRef.current = true;
    setActiveAction(mode.name);
    setLoading(true);
    setError(null);
    setOutput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await streamAiRewrite(
        {
          text: original,
          customMode: mode,
          model: settings.ai.model,
          customInstructions: settings.ai.customInstructions,
          vocabulary,
        },
        (_delta, fullText) => {
          setOutput(fullText);
        },
        controller.signal
      );
      setOutput(res.text);
      onLogActivity({
        type: 'ai_request',
        words: countWords(res.text),
        durationSec: 0,
        aiMode: mode.name,
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Custom mode execution failed.');
      }
    } finally {
      setLoading(false);
      runningRef.current = false;
      abortRef.current = null;
    }
  };

  const handleCopy = async () => {
    if (!output.trim()) return;
    await navigator.clipboard?.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleReplace = () => {
    if (!output.trim()) return;
    setOriginal(output);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            AI Writing &amp; Voice Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time streaming Gemini writing tools, translation, Hinglish conversion, and speech cleanup.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Translate target:</label>
          <select
            value={translateLangId}
            onChange={(e) => setTranslateLangId(e.target.value)}
            className="rounded-lg border border-white/[0.09] bg-[#0E0F17] px-2.5 py-1.5 text-xs text-white focus:border-violet-500/50 focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E0F17]/90 p-4 space-y-3">
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-slate-400">AI Writing Tools</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {WRITING_TOOLS.map((action) => (
              <button
                key={action}
                type="button"
                disabled={!original.trim() || loading}
                onClick={() => executeRewrite(action)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors border disabled:opacity-40 ${
                  activeAction === action
                    ? 'border-violet-400/50 bg-violet-600/25 text-white'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3 text-cyan-400" />
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2.5 border-t border-white/[0.06] space-y-2">
          <span className="text-[11px] font-medium text-slate-400">
            VOXIFY Voice Intelligence
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {VOICE_INTELLIGENCE_TOOLS.map((action) => (
              <button
                key={action}
                type="button"
                disabled={!original.trim() || loading}
                onClick={() => executeRewrite(action)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors border disabled:opacity-40 ${
                  activeAction === action
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-cyan-400/35 hover:text-white'
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {customModes.length > 0 && (
          <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 mr-1">Custom Modes:</span>
            {customModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                disabled={!original.trim() || loading}
                onClick={() => executeCustomMode(mode)}
                className={`rounded-lg px-2.5 py-1 text-xs whitespace-nowrap shrink-0 transition-colors border disabled:opacity-40 ${
                  activeAction === mode.name
                    ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-100'
                    : 'border-white/[0.07] bg-white/[0.02] text-slate-300 hover:bg-white/[0.07]'
                }`}
              >
                {mode.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Split Input / Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/90 p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
            <span className="text-sm font-medium text-white">Original or Dictated Text</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {countWords(original)} words
              </span>
              <button
                type="button"
                onClick={() =>
                  voice.state === 'Listening' ? voice.stop() : voice.start()
                }
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                  voice.state === 'Listening'
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:text-white'
                }`}
              >
                {voice.state === 'Listening' ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {voice.state === 'Listening' ? 'Stop Mic' : 'Dictate'}
              </button>
            </div>
          </div>

          <textarea
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="Paste or dictate the text you want to rewrite, clean up, translate, or transform..."
            className="mt-4 min-h-[300px] w-full flex-1 resize-y rounded-xl border border-white/[0.07] bg-black/30 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
          />
          {voice.interimText && (
            <p className="mt-2 text-xs text-cyan-300">Live: {voice.interimText}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">AI Output</span>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-500/25"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              )}
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {countWords(output)} words
              </span>
            </div>
          </div>

          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="Select any AI Writing or Voice Intelligence action above to stream results here..."
            className="mt-4 min-h-[300px] w-full flex-1 resize-y rounded-xl border border-white/[0.07] bg-black/35 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleReplace}
              disabled={!output.trim() || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 whitespace-nowrap"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Replace Original
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!output.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 whitespace-nowrap"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy Output'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
