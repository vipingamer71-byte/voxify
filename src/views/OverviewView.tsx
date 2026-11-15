import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
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
import { VoiceOrb } from '../components/VoiceOrb';
import { getLanguageById } from '../data/languages';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { streamAiRewrite } from '../services/api';
import { countWords, formatDuration, isWebSpeechSupported } from '../services/speechEngine';
import type {
  ActivityEvent,
  RewriteAction,
  VocabularyItem,
  VoiceHistoryEntry,
  VoxifySettings,
} from '../types/voxify';

interface OverviewViewProps {
  settings: VoxifySettings;
  vocabulary: VocabularyItem[];
  history: VoiceHistoryEntry[];
  activity: ActivityEvent[];
  onSaveTranscript: (entry: Omit<VoiceHistoryEntry, 'id' | 'createdAt'>) => void;
  onLogActivity: (event: Omit<ActivityEvent, 'id' | 'date'>) => void;
  onOpenRewriteWithText: (text: string) => void;
}

const VOICE_INTELLIGENCE_ACTIONS: Array<{ label: string; action: RewriteAction }> = [
  { label: 'Clean Up & Remove Fillers', action: 'Clean Up Dictation' },
  { label: 'Fix Grammar', action: 'Fix Grammar' },
  { label: 'Hinglish → English', action: 'Convert Hinglish to English' },
  { label: 'English → Hinglish', action: 'Convert English to Hinglish' },
  { label: 'Format Text', action: 'Format Dictation' },
  { label: 'Professional Email', action: 'Speech to Professional Email' },
  { label: 'Developer Code', action: 'Speech to Developer Code' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  settings,
  vocabulary,
  history,
  activity,
  onSaveTranscript,
  onLogActivity,
  onOpenRewriteWithText,
}) => {
  const [languageId, setLanguageId] = useState(settings.voice.speechLanguageId);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [activeAiAction, setActiveAiAction] = useState<string | null>(null);
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
          title: transcript.split(/\s+/).slice(0, 6).join(' ') || 'Quick Voice Note',
          transcript,
          durationSec,
          wordCount: countWords(transcript),
          languageId: lang.id,
          languageName: lang.name,
          engineUsed: 'Web Speech API',
        });
        setSavedNotice(true);
        window.setTimeout(() => setSavedNotice(false), 2500);
      }
    },
  });

  const totalWords = activity
    .filter((a) => a.type === 'dictation')
    .reduce((acc, a) => acc + a.words, 0);
  const totalSessions = history.length;
  const totalAiRequests = activity.filter((a) => a.type === 'ai_request').length;
  const minutesSaved = totalWords > 0 ? Math.max(1, Math.round(totalWords / 40 - totalWords / 130)) : 0;

  const handleOrbToggle = () => {
    if (dictation.state === 'Listening') {
      dictation.pause();
    } else if (dictation.state === 'Paused') {
      dictation.resume();
    } else {
      dictation.start();
    }
  };

  const handleCopy = async () => {
    const text = dictation.finalText.trim();
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const text = dictation.finalText.trim();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxify-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoiceIntelligence = async (action: RewriteAction) => {
    const sourceText = dictation.finalText.trim();
    if (!sourceText || activeAiAction) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setActiveAiAction(action);
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
        setAiError(err instanceof Error ? err.message : 'Voice Intelligence processing failed.');
      }
    } finally {
      setActiveAiAction(null);
      abortRef.current = null;
    }
  };

  const handleCancelAi = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveAiAction(null);
  };

  const handleManualSave = () => {
    const text = dictation.finalText.trim();
    if (!text) return;
    const lang = getLanguageById(languageId);
    onSaveTranscript({
      title: text.split(/\s+/).slice(0, 6).join(' ') || 'Voice Workspace Note',
      transcript: text,
      durationSec: dictation.durationSec,
      wordCount: countWords(text),
      languageId: lang.id,
      languageName: lang.name,
      engineUsed: 'Web Speech API',
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  const stateColorMap: Record<string, string> = {
    Ready: 'text-slate-300',
    Listening: 'text-cyan-300',
    Paused: 'text-amber-300',
    Processing: 'text-violet-300',
    Completed: 'text-emerald-300',
    Error: 'text-rose-300',
  };

  const stats = [
    { label: 'Words dictated', value: totalWords.toLocaleString(), detail: 'Cumulative workspace output' },
    { label: 'Minutes saved', value: `${minutesSaved} min`, detail: 'Voice vs. 40 WPM keyboard' },
    { label: 'Total sessions', value: totalSessions.toLocaleString(), detail: 'Saved voice transcripts' },
    { label: 'AI requests', value: totalAiRequests.toLocaleString(), detail: 'Rewrites, chat & dev assist' },
  ];

  const speechAvailable = isWebSpeechSupported();

  return (
    <div className="space-y-6">
      {/* Hero Greeting Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-violet-300/90 tracking-wide">
            Don&apos;t Type It. Just Voxify It.
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white text-balance">
            Your voice, your workspace.
          </h1>
        </div>
        <div className="w-full md:w-72">
          <LanguageSelector value={languageId} onChange={setLanguageId} compact />
        </div>
      </div>

      {/* 4 Statistics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.08] bg-[#0E0F17]/90 px-4 py-3.5"
          >
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-white">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{stat.detail}</p>
          </div>
        ))}
      </div>

      {/* Main Voice Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Voice Orb + Acoustic Controls */}
        <div className="xl:col-span-5 flex flex-col justify-between rounded-2xl border border-white/[0.09] bg-gradient-to-b from-[#121322]/90 to-[#0B0C13]/95 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Engine</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-200 font-medium">
                {speechAvailable ? 'Browser SpeechRecognition' : 'Unsupported Browser'}
              </span>
            </div>
            <span className={`font-mono font-medium tabular-nums ${stateColorMap[dictation.state]}`}>
              {dictation.state}
            </span>
          </div>

          <div className="my-5 flex flex-col items-center">
            <VoiceOrb
              state={dictation.state}
              audioLevel={dictation.audioLevel}
              onToggle={handleOrbToggle}
              size="lg"
            />
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
              <span className="font-mono tabular-nums text-slate-200">
                {formatDuration(dictation.durationSec)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{getLanguageById(languageId).name}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{countWords(dictation.combinedText)} words</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-black/35 py-2.5 px-3">
              <AudioWaveform bands={dictation.frequencyBands} state={dictation.state} height={42} />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {dictation.state === 'Listening' ? (
                <button
                  type="button"
                  onClick={dictation.pause}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause Recording
                </button>
              ) : dictation.state === 'Paused' ? (
                <button
                  type="button"
                  onClick={dictation.resume}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                >
                  <Play className="h-3.5 w-3.5" />
                  Resume Dictation
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dictation.start}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Start Dictation
                </button>
              )}

              {(dictation.state === 'Listening' || dictation.state === 'Paused') && (
                <button
                  type="button"
                  onClick={dictation.stop}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 px-4 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/25 transition-colors whitespace-nowrap shrink-0"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop Recording
                </button>
              )}
            </div>

            {dictation.errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{dictation.errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Transcription & VOXIFY Voice Intelligence */}
        <div className="xl:col-span-7 flex flex-col justify-between rounded-2xl border border-white/[0.09] bg-[#0D0E16]/90 backdrop-blur-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Live Transcription &amp; Voice Intelligence
              </h2>
              <p className="text-xs text-slate-400">
                Instant capture with real-time Gemini cleanup, Hinglish translation, email, and code formatting.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedNotice && (
                <span className="text-xs text-cyan-300 font-medium">Saved to Firestore</span>
              )}
              <button
                type="button"
                onClick={handleManualSave}
                disabled={!dictation.finalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="h-3.5 w-3.5 text-cyan-400" />
                Save
              </button>
            </div>
          </div>

          <div className="relative my-4 flex-1 min-h-[230px] flex flex-col">
            <textarea
              value={dictation.finalText}
              onChange={(e) => dictation.setFinalText(e.target.value)}
              placeholder="Click Start Dictation or tap the Voice Orb and begin speaking. Your live transcript appears here instantly..."
              className="w-full flex-1 min-h-[200px] resize-none rounded-xl border border-white/[0.07] bg-black/30 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
            {dictation.interimText && (
              <div className="mt-2.5 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
                <span className="text-cyan-400 font-medium mr-2">Live caption:</span>
                {dictation.interimText}
              </div>
            )}
            {aiError && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}
          </div>

          {/* Voice Intelligence Quick Bar */}
          <div className="mb-4 pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">
                Voice Intelligence Actions
              </span>
              {activeAiAction && (
                <button
                  type="button"
                  onClick={handleCancelAi}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Stop Generation
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {VOICE_INTELLIGENCE_ACTIONS.map((item) => {
                const running = activeAiAction === item.action;
                return (
                  <button
                    key={item.action}
                    type="button"
                    disabled={!dictation.finalText.trim() || activeAiAction !== null}
                    onClick={() => handleVoiceIntelligence(item.action)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
                      running
                        ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-violet-400/40 hover:bg-white/[0.07]'
                    }`}
                  >
                    {running && <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.07]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!dictation.finalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>

              <button
                type="button"
                onClick={dictation.clear}
                disabled={!dictation.finalText.trim() && dictation.state === 'Ready'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.09] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!dictation.finalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenRewriteWithText(dictation.finalText)}
              disabled={!dictation.finalText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open in AI Rewrite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
