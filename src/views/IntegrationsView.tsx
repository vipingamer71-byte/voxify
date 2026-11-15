import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, Globe, RefreshCw, Save, Server, XCircle } from 'lucide-react';
import { fetchApiHealth, type HealthResponse } from '../services/api';
import { isMicrophoneApiSupported, isWebSpeechSupported } from '../services/speechEngine';
import type { WhisperConfig } from '../types/voxify';

interface IntegrationsViewProps {
  whisperConfig: WhisperConfig;
  onSaveWhisperConfig: (config: WhisperConfig) => Promise<void>;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  whisperConfig,
  onSaveWhisperConfig,
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [whisper, setWhisper] = useState<WhisperConfig>(whisperConfig);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setWhisper(whisperConfig);
  }, [whisperConfig]);

  const checkHealth = async (force = false) => {
    setChecking(true);
    setHealthError(null);
    try {
      const data = await fetchApiHealth(force);
      setHealth(data);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Server unreachable');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth(false);
  }, []);

  const webSpeechReady = isWebSpeechSupported();
  const micReady = isMicrophoneApiSupported();

  const handleSaveWhisper = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveWhisperConfig(whisper);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Integrations</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Live speech engine diagnostics, server-side Gemini streaming proxy verification, and Phase 2 Whisper.cpp configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-600/20 border border-violet-400/25">
                <Globe className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Browser SpeechRecognition API
                </h2>
                <p className="text-xs text-slate-400">Active Phase 1 dictation runtime</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                webSpeechReady ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {webSpeechReady ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {webSpeechReady ? 'Supported' : 'Unsupported'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300 border-t border-white/[0.07] pt-3">
            <div className="flex justify-between py-1">
              <span className="text-slate-400">SpeechRecognition Constructor</span>
              <span className="font-mono text-slate-200">
                {webSpeechReady ? 'Available' : 'Not detected'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Web Audio MediaDevices</span>
              <span className="font-mono text-slate-200">
                {micReady ? 'Available' : 'Not detected'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Offline Transcription</span>
              <span className="font-mono text-slate-400">Phase 2 (Not active in browser)</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/25">
                <Server className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Gemini AI Server Proxy
                </h2>
                <p className="text-xs text-slate-400">Authenticated SSE backend (/api/ai/*)</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => checkHealth(true)}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08] whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              Verify
            </button>
          </div>

          <div className="space-y-2 text-xs text-slate-300 border-t border-white/[0.07] pt-3">
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Backend Status</span>
              <span className="font-mono text-slate-200">
                {healthError ? 'Error' : health?.ok ? 'Connected' : 'Checking...'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Server API Key Configured</span>
              <span
                className={`font-mono ${
                  health?.geminiConfigured ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {health ? (health.geminiConfigured ? 'Yes (Environment)' : 'Not Set in Secrets') : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">SSE Streaming</span>
              <span className="font-mono text-cyan-300">
                {health?.streamingSupported ? 'Enabled' : 'Standard'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSaveWhisper}
        className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/90 p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
              <Cpu className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Whisper.cpp Adapter Configuration (Phase 2 Architecture)
              </h2>
              <p className="text-xs text-slate-400">
                Saved directly to your Firestore profile for Phase 2 desktop bridge integration.
              </p>
            </div>
          </div>
          {savedNotice && <span className="text-xs text-cyan-300 font-medium">Saved to Firestore</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Local Server Endpoint
            </label>
            <input
              type="text"
              value={whisper.endpointUrl}
              onChange={(e) => setWhisper({ ...whisper, endpointUrl: e.target.value })}
              className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3 py-2 font-mono text-xs text-white focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Whisper Model
            </label>
            <select
              value={whisper.modelSize}
              onChange={(e) =>
                setWhisper({
                  ...whisper,
                  modelSize: e.target.value as WhisperConfig['modelSize'],
                })
              }
              className="w-full rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3 py-2 text-xs text-white focus:border-violet-500/50 focus:outline-none"
            >
              <option value="tiny">ggml-tiny (Fastest)</option>
              <option value="base">ggml-base (Balanced)</option>
              <option value="small">ggml-small (High Accuracy)</option>
              <option value="medium">ggml-medium (Multilingual Pro)</option>
              <option value="large-v3">ggml-large-v3 (Studio)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              CPU Threads
            </label>
            <input
              type="number"
              min={1}
              max={32}
              value={whisper.threads}
              onChange={(e) =>
                setWhisper({ ...whisper, threads: Math.max(1, Number(e.target.value) || 4) })
              }
              className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3 py-2 font-mono text-xs text-white tabular-nums focus:border-violet-500/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:bg-white/[0.14] transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            Save Adapter Settings
          </button>
        </div>
      </form>
    </div>
  );
};
