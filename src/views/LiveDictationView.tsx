import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  Copy,
  Info,
  Loader2,
  Mic,
  Pause,
  Play,
  Save,
  Sparkles,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';
import { AudioWaveform } from '../components/AudioWaveform';
import { LanguageSelector } from '../components/LanguageSelector';
import { getLanguageById } from '../data/languages';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { streamAiRewrite } from '../services/api';
import {
  countWords,
  formatDuration,
  isMicrophoneApiSupported,
  isWebSpeechSupported,
} from '../services/speechEngine';
import type {
  ActivityEvent,
  RewriteAction,
  VocabularyItem,
  VoiceHistoryEntry,
  VoxifySettings,
} from '../types/voxify';

interface LiveDictationViewProps {
  settings: VoxifySettings;
  vocabulary: VocabularyItem[];
  history: VoiceHistoryEntry[];
  onSaveTranscript: (entry: Omit<VoiceHistoryEntry, 'id' | 'createdAt'>) => void;
  onLogActivity: (event: Omit<ActivityEvent, 'id' | 'date'>) => void;
  onOpenRewriteWithText: (text: string) => void;
}

const VOICE_AI_PRESETS: Array<{ label: string; action: RewriteAction }> = [
  { label: 'Clean Fillers', action: 'Clean Up Dictation' },
  { label: 'Fix Grammar', action: 'Fix Grammar' },
  { label: 'Hinglish → English', action: 'Convert Hinglish to English' },
  { label: 'English → Hinglish', action: 'Convert English to Hinglish' },
  { label: 'Format Paragraphs', action: 'Format Dictation' },
  { label: 'Draft Email', action: 'Speech to Professional Email' },
  { label: 'To Dev Code', action: 'Speech to Developer Code' },
];

export const LiveDictationView: React.FC<LiveDictationViewProps> = ({
  settings,
  vocabulary,
  history,
  onSaveTranscript,
  onLogActivity,
  onOpenRewriteWithText,
}) => {
  const [languageId, setLanguageId] = useState(settings.voice.speechLanguageId);
  const [title, setTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [runningAiAction, setRunningAiAction] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dictation = useVoiceDictation({
    languageId,
    continuous: settings.voice.continuousListening,
    interimResults: settings.voice.interimResults,
    selectedMicId: settings.voice.selectedMicId,
    vocabulary,
    applyVocabulary: settings.voice.applyCustomVocabulary,
    onSessionComplete: ({ transcript, durationSec, languageId: langId }) => {
      if (settings.general.autoCopyOnStop && transcript) {
        navigator.clipboard?.writeText(transcript).catch(() => {});
      }
      if (settings.privacy.autoSaveHistory && transcript.trim()) {
        const lang = getLanguageById(langId);
        onSaveTranscript({
          title: title.trim() || transcript.split(/\s+/).slice(0, 6).join(' ') || 'Live Dictation',
          transcript,
          durationSec,
          wordCount: countWords(transcript),
          languageId: lang.id,
          languageName: lang.name,
          engineUsed: 'Browser SpeechRecognition',
        });
        setSavedBanner(true);
        window.setTimeout(() => setSavedBanner(false), 2500);
      }
    },
  });

  const activeLang = getLanguageById(languageId);
  const webSpeechOk = isWebSpeechSupported();
  const micApiOk = isMicrophoneApiSupported();

  const handleRequestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      dictation.setErrorMessage(null);
      setPasteNotice('Microphone permission granted.');
      window.setTimeout(() => setPasteNotice(null), 2200);
    } catch {
      dictation.setErrorMessage(
        'Microphone permission denied. Enable microphone access in your browser site settings.'
      );
    }
  };

  const handleCopy = async () => {
    if (!dictation.finalText.trim()) return;
    await navigator.clipboard?.writeText(dictation.finalText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard?.readText();
      if (clip) {
        dictation.setFinalText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${clip}` : clip));
      } else {
        setPasteNotice('Clipboard is empty.');
        window.setTimeout(() => setPasteNotice(null), 2000);
      }
    } catch {
      setPasteNotice('Clipboard read permission declined. Paste directly with Ctrl/Cmd+V.');
      window.setTimeout(() => setPasteNotice(null), 2800);
    }
  };

  const handleSaveManual = () => {
    const text = dictation.finalText.trim();
    if (!text) return;
    onSaveTranscript({
      title: title.trim() || text.split(/\s+/).slice(0, 6).join(' ') || 'Live Dictation',
      transcript: text,
      durationSec: dictation.durationSec,
      wordCount: countWords(text),
      languageId: activeLang.id,
      languageName: activeLang.name,
      engineUsed: 'Browser SpeechRecognition',
    });
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 2200);
  };

  const handleVoiceAi = async (action: RewriteAction) => {
    const sourceText = dictation.finalText.trim();
    if (!sourceText || runningAiAction) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setRunningAiAction(action);
    setAiError(null);

    try {
      const res = await streamAiRewrite(
        {
          text: sourceText,
          action,
          model: settings.ai.model,
          customInstructions: settings.ai.customInstructions,
          vocabulary,
        },
        (_delta, fullText) => {
          dictation.setFinalText(fullText);
        },
        controller.signal
      );

      onLogActivity({
        type: 'ai_request',
        words: countWords(res.text),
        durationSec: 0,
        aiMode: action,
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setAiError(err instanceof Error ? err.message : 'Gemini voice intelligence failed.');
      }
    } finally {
      setRunningAiAction(null);
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Live Dictation</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant speech recognition with live Gemini voice cleanup, Hinglish conversion, and Firestore sync.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRequestPermission}
          className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          Check Mic Permission
        </button>
      </div>

      {/* Engine Transparency Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 text-slate-300">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Active engine: <strong className="text-white">Browser SpeechRecognition API</strong> (
            {webSpeechOk ? 'Supported' : 'Unsupported'} · Mic API:{' '}
            {micApiOk ? 'Available' : 'Unavailable'}). Whisper.cpp local adapter is prepared for Phase 2.
          </span>
        </div>
        <span className="font-mono text-[11px] text-cyan-300 shrink-0 tabular-nums">
          {dictation.state} · {formatDuration(dictation.durationSec)}
        </span>
      </div>

      {/* Language Selection Row */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0E0F17]/90 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">
            Speech Recognition Language (50+ languages ready)
          </span>
          {activeLang.note && <span className="text-[11px] text-cyan-300">{activeLang.note}</span>}
        </div>
        <LanguageSelector value={languageId} onChange={setLanguageId} showFeaturedChips />
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (optional, auto-generated if empty)"
              className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
            <div className="flex items-center gap-2 shrink-0">
              {dictation.state === 'Listening' ? (
                <button
                  type="button"
                  onClick={dictation.pause}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/15 px-3.5 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              ) : dictation.state === 'Paused' ? (
                <button
                  type="button"
                  onClick={dictation.resume}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dictation.start}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Start Dictation
                </button>
              )}

              {(dictation.state === 'Listening' || dictation.state === 'Paused') && (
                <button
                  type="button"
                  onClick={dictation.stop}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-500/15 px-3.5 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/25 transition-colors whitespace-nowrap"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/35 px-3 py-2">
            <AudioWaveform bands={dictation.frequencyBands} state={dictation.state} height={36} />
          </div>

          {dictation.errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{dictation.errorMessage}</span>
            </div>
          )}

          {aiError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}

          {pasteNotice && (
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-200">
              {pasteNotice}
            </div>
          )}

          <textarea
            value={dictation.finalText}
            onChange={(e) => dictation.setFinalText(e.target.value)}
            placeholder="Start speaking in your selected language. Edit any line manually or transform with VOXIFY Voice Intelligence below..."
            className="min-h-[250px] w-full resize-y rounded-xl border border-white/[0.08] bg-black/35 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
          />

          {dictation.interimText && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
              <span className="font-medium text-cyan-400 mr-2">Interim:</span>
              {dictation.interimText}
            </div>
          )}

          {/* Voice Intelligence Bar */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">
                VOXIFY Voice Intelligence (Gemini Streaming)
              </span>
              {runningAiAction && (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    setRunningAiAction(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Stop Generation
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {VOICE_AI_PRESETS.map((preset) => {
                const active = runningAiAction === preset.action;
                return (
                  <button
                    key={preset.action}
                    type="button"
                    disabled={!dictation.finalText.trim() || runningAiAction !== null}
                    onClick={() => handleVoiceAi(preset.action)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
                      active
                        ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-violet-400/40 hover:bg-white/[0.07]'
                    }`}
                  >
                    {active && <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!dictation.finalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-40 whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] whitespace-nowrap"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste
              </button>

              <button
                type="button"
                onClick={dictation.clear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              {savedBanner && <span className="text-xs text-cyan-300">Saved</span>}
              <button
                type="button"
                onClick={handleSaveManual}
                disabled={!dictation.finalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-40 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5 text-cyan-400" />
                Save Entry
              </button>
              <button
                type="button"
                onClick={() => onOpenRewriteWithText(dictation.finalText)}
                disabled={!dictation.finalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Send to AI Rewrite
              </button>
            </div>
          </div>
        </div>

        {/* Right: Recent Dictation Sessions */}
        <div className="lg:col-span-4 rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
            <h2 className="font-display text-sm font-semibold text-white">Recent Sessions</h2>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {history.length} saved
            </span>
          </div>

          <div className="mt-3 space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
            {history.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                No dictation sessions yet. Start speaking to record and save your first transcript.
              </p>
            ) : (
              history.slice(0, 8).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    dictation.setFinalText(entry.transcript);
                    setTitle(entry.title);
                  }}
                  className="w-full text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-violet-400/35 hover:bg-white/[0.04] transition-colors"
                >
                  <p className="text-xs font-medium text-slate-100 truncate">{entry.title}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{entry.languageName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatDuration(entry.durationSec)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{entry.wordCount} words</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">{entry.transcript}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
