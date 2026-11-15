import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Code2,
  Copy,
  Info,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Square,
  Wand2,
} from 'lucide-react';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { DEV_STACK_VOCAB } from '../data/defaults';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { streamDeveloperAi } from '../services/api';
import { countWords } from '../services/speechEngine';
import type { ActivityEvent, DevStack, VocabularyItem, VoxifySettings } from '../types/voxify';

interface DeveloperModeViewProps {
  settings: VoxifySettings;
  vocabulary: VocabularyItem[];
  onLogActivity: (event: Omit<ActivityEvent, 'id' | 'date'>) => void;
}

const STACKS: DevStack[] = [
  'React',
  'JavaScript',
  'TypeScript',
  'Python',
  'HTML',
  'CSS',
  'Node.js',
  'SQL',
  'APIs',
];

export const DeveloperModeView: React.FC<DeveloperModeViewProps> = ({
  settings,
  vocabulary,
  onLogActivity,
}) => {
  const [selectedStack, setSelectedStack] = useState<DevStack>('TypeScript');
  const [inputCode, setInputCode] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [loadingTask, setLoadingTask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const voice = useVoiceDictation({
    languageId: 'en-US',
    continuous: true,
    interimResults: true,
    selectedMicId: settings.voice.selectedMicId,
    vocabulary,
    applyVocabulary: true,
    developerMode: true,
  });

  useEffect(() => {
    if (voice.finalText.trim()) {
      setInputCode((prev) => {
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
    setLoadingTask(null);
  };

  const executeTask = async (
    task: 'voice-to-code-prep' | 'code-format' | 'explain' | 'rewrite'
  ) => {
    if (!inputCode.trim() || runningRef.current) return;
    runningRef.current = true;
    setLoadingTask(task);
    setError(null);
    setAiOutput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await streamDeveloperAi(
        {
          input: inputCode,
          task,
          language: selectedStack,
          model: settings.ai.model,
          vocabulary,
        },
        (_delta, fullText) => {
          setAiOutput(fullText);
        },
        controller.signal
      );
      setAiOutput(res.text);
      onLogActivity({
        type: 'ai_request',
        words: countWords(res.text),
        durationSec: 0,
        aiMode: `Developer (${selectedStack})`,
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Developer AI action failed.');
      }
    } finally {
      setLoadingTask(null);
      runningRef.current = false;
      abortRef.current = null;
    }
  };

  const insertToken = (token: string) => {
    setInputCode((prev) => (prev.trim() ? `${prev.trimEnd()} ${token}` : token));
  };

  const handleCopy = async () => {
    if (!aiOutput.trim()) return;
    await navigator.clipboard?.writeText(aiOutput);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Developer Mode</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Technical voice-to-code preparation, code terminology normalization, streaming formatting, and AI refactoring.
          </p>
        </div>
      </div>

      {/* Honest Architecture Notice */}
      <div className="flex items-start sm:items-center gap-2.5 rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-xs text-slate-300">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
        <span>
          Speech recognition captures spoken developer intent and normalizes technical tokens (like{' '}
          <code className="font-mono text-cyan-300">async/await</code> or{' '}
          <code className="font-mono text-cyan-300">useEffect</code>). Gemini streaming AI then translates your prepared intent into structured code or explanations.
        </span>
      </div>

      {/* Stack Selector */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E0F17]/90 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STACKS.map((stack) => (
            <button
              key={stack}
              type="button"
              onClick={() => setSelectedStack(stack)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                selectedStack === stack
                  ? 'border-violet-400/50 bg-violet-600/25 text-white'
                  : 'border-white/[0.07] bg-white/[0.03] text-slate-300 hover:text-white'
              }`}
            >
              {stack}
            </button>
          ))}
        </div>

        <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500 mr-1">{selectedStack} quick terms:</span>
          {DEV_STACK_VOCAB[selectedStack].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => insertToken(term)}
              className="rounded-md border border-white/[0.07] bg-black/30 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:border-cyan-400/40 transition-colors whitespace-nowrap"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual Code Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              Spoken Technical Intent or Source Code
            </span>
            <button
              type="button"
              onClick={() =>
                voice.state === 'Listening' ? voice.stop() : voice.start()
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                voice.state === 'Listening'
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/[0.09] bg-white/[0.04] text-slate-200 hover:border-violet-400/40'
              }`}
            >
              {voice.state === 'Listening' ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {voice.state === 'Listening' ? 'Stop Voice' : 'Voice Dictate'}
            </button>
          </div>

          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Dictate logic (e.g. 'create an async function fetchUserProfile taking userId string with try catch') or paste source code..."
            className="min-h-[290px] w-full flex-1 resize-y rounded-xl border border-white/[0.08] bg-black/45 p-4 font-mono text-xs leading-relaxed text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
          />

          {voice.interimText && (
            <p className="text-xs text-cyan-300 font-mono">Interim: {voice.interimText}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!inputCode.trim() || loadingTask !== null}
              onClick={() => executeTask('voice-to-code-prep')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 whitespace-nowrap"
            >
              {loadingTask === 'voice-to-code-prep' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Voice-to-Code Prep
            </button>

            <button
              type="button"
              disabled={!inputCode.trim() || loadingTask !== null}
              onClick={() => executeTask('code-format')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 whitespace-nowrap"
            >
              {loadingTask === 'code-format' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Code2 className="h-3.5 w-3.5 text-cyan-400" />
              )}
              Format Code
            </button>

            <button
              type="button"
              disabled={!inputCode.trim() || loadingTask !== null}
              onClick={() => executeTask('explain')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 whitespace-nowrap"
            >
              {loadingTask === 'explain' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookOpen className="h-3.5 w-3.5 text-violet-300" />
              )}
              Explain
            </button>

            <button
              type="button"
              disabled={!inputCode.trim() || loadingTask !== null}
              onClick={() => executeTask('rewrite')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 whitespace-nowrap"
            >
              {loadingTask === 'rewrite' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5 text-cyan-400" />
              )}
              AI Code Rewrite
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              AI Output · {selectedStack}
            </span>
            <div className="flex items-center gap-2">
              {loadingTask && (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-500/25"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!aiOutput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08] disabled:opacity-40 whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="min-h-[340px] flex-1 overflow-auto rounded-xl border border-white/[0.08] bg-black/50 p-4">
            {aiOutput ? (
              <MarkdownMessage content={aiOutput} />
            ) : (
              <p className="font-mono text-xs text-slate-500">
                // Dictate or paste code on the left, then choose Voice-to-Code Prep, Format Code, Explain, or AI Code Rewrite.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
