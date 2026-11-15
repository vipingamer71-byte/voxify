import React, { useEffect, useState } from 'react';
import { Download, LogOut, Mic, RefreshCw, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { LANGUAGES } from '../data/languages';
import { listAudioInputDevices } from '../services/speechEngine';
import type { NavSection, VoxifySettings } from '../types/voxify';

interface SettingsViewProps {
  userEmail: string;
  settings: VoxifySettings;
  onUpdateSettings: (next: VoxifySettings) => Promise<void>;
  onExportAll: () => string;
  onClearHistory: () => Promise<void>;
  onClearChats: () => Promise<void>;
  onResetAll: () => Promise<void>;
  onLogout: () => Promise<void>;
}

type SettingsTab = 'General' | 'Voice' | 'AI' | 'Privacy';

export const SettingsView: React.FC<SettingsViewProps> = ({
  userEmail,
  settings,
  onUpdateSettings,
  onExportAll,
  onClearHistory,
  onClearChats,
  onResetAll,
  onLogout,
}) => {
  const [tab, setTab] = useState<SettingsTab>('General');
  const [draft, setDraft] = useState<VoxifySettings>(settings);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'history' | 'chats' | 'all' | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const loadMics = async () => {
    const devices = await listAudioInputDevices();
    setMics(devices);
  };

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    loadMics();
  }, []);

  const handleSave = async () => {
    await onUpdateSettings(draft);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleExportAll = () => {
    const json = onExportAll();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxify-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: SettingsTab[] = ['General', 'Voice', 'AI', 'Privacy'];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cloud-synced preferences for {userEmail} across General, Voice, AI, and Privacy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && <span className="text-xs text-cyan-300 font-medium">Saved to Firestore</span>}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            Save Preferences
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0E0F17]/90 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'bg-violet-600/30 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-6 space-y-5 max-w-3xl">
        {tab === 'General' && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Workspace Display Name
              </label>
              <input
                type="text"
                value={draft.general.userName}
                onChange={(e) =>
                  setDraft({ ...draft, general: { ...draft.general, userName: e.target.value } })
                }
                className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Appearance Accent
                </label>
                <select
                  value={draft.general.appearance}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      general: {
                        ...draft.general,
                        appearance: e.target.value as VoxifySettings['general']['appearance'],
                      },
                    })
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                >
                  <option value="obsidian-violet">Obsidian Electric Violet</option>
                  <option value="midnight-cyan">Midnight Acoustic Cyan</option>
                  <option value="carbon-minimal">Carbon Monochrome</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Startup View
                </label>
                <select
                  value={draft.general.startupView}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      general: { ...draft.general, startupView: e.target.value as NavSection },
                    })
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                >
                  <option value="overview">Overview</option>
                  <option value="dictation">Live Dictation</option>
                  <option value="assistant">AI Assistant</option>
                  <option value="rewrite">AI Rewrite</option>
                  <option value="developer">Developer Mode</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Auto-copy on stop</p>
                <p className="text-xs text-slate-400">
                  Automatically copy finished dictation text to your clipboard when stopping.
                </p>
              </div>
              <input
                type="checkbox"
                checked={draft.general.autoCopyOnStop}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    general: { ...draft.general, autoCopyOnStop: e.target.checked },
                  })
                }
                className="h-4 w-4 accent-violet-500"
              />
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Account Session</p>
                <p className="text-xs text-slate-400">Signed in as {userEmail}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.09]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === 'Voice' && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Microphone Input</label>
                <button
                  type="button"
                  onClick={loadMics}
                  className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh Devices
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-violet-400 shrink-0" />
                <select
                  value={draft.voice.selectedMicId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      voice: { ...draft.voice, selectedMicId: e.target.value },
                    })
                  }
                  className="flex-1 rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                >
                  <option value="default">System Default Microphone</option>
                  {mics.map((m, i) => (
                    <option key={m.deviceId || i} value={m.deviceId}>
                      {m.label || `Audio Input ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Default Speech Language
              </label>
              <select
                value={draft.voice.speechLanguageId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    voice: { ...draft.voice, speechLanguageId: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.nativeName}) · {l.bcp47}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              {[
                {
                  key: 'continuousListening' as const,
                  title: 'Continuous listening',
                  desc: 'Keep recording across natural pauses until you click Pause or Stop.',
                },
                {
                  key: 'interimResults' as const,
                  title: 'Live interim captions',
                  desc: 'Show real-time partial words while speaking before finalization.',
                },
                {
                  key: 'applyCustomVocabulary' as const,
                  title: 'Apply Custom Vocabulary automatically',
                  desc: 'Normalize company names, projects, and technical spellings automatically.',
                },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.voice[item.key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        voice: { ...draft.voice, [item.key]: e.target.checked },
                      })
                    }
                    className="h-4 w-4 accent-violet-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'AI' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  AI Provider
                </label>
                <input
                  type="text"
                  readOnly
                  value={draft.ai.provider}
                  className="w-full rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-2 text-sm text-slate-300 cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Gemini Model
                </label>
                <select
                  value={draft.ai.model}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ai: {
                        ...draft.ai,
                        model: e.target.value as VoxifySettings['ai']['model'],
                      },
                    })
                  }
                  className="w-full rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
                >
                  <option value="gemini-4-hydrogen">gemini-4-hydrogen (Balanced &amp; Fast Streaming)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra-Fast Lite)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Global Custom Instructions
              </label>
              <textarea
                rows={4}
                value={draft.ai.customInstructions}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ai: { ...draft.ai, customInstructions: e.target.value },
                  })
                }
                placeholder="Optional style rules applied across AI Assistant and AI Rewrite (e.g., 'Always use British spelling', 'Keep bullet points concise')."
                className="w-full rounded-xl border border-white/[0.09] bg-black/35 p-3.5 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
          </div>
        )}

        {tab === 'Privacy' && (
          <div className="space-y-5">
            <div className="space-y-3">
              {[
                {
                  key: 'autoSaveHistory' as const,
                  title: 'Auto-save voice transcriptions to Firestore',
                  desc: 'Store completed dictation sessions securely under your user UID.',
                },
                {
                  key: 'storeChatLocally' as const,
                  title: 'Persist AI Assistant conversations',
                  desc: 'Sync AI chat threads to Firestore for cross-session continuity.',
                },
                {
                  key: 'analyticsTracking' as const,
                  title: 'Track productivity metrics',
                  desc: 'Compute word count, time saved, and weekly activity for your account.',
                },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.privacy[item.key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        privacy: { ...draft.privacy, [item.key]: e.target.checked },
                      })
                    }
                    className="h-4 w-4 accent-violet-500"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/[0.07] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Export Workspace Data</p>
                  <p className="text-xs text-slate-400">
                    Download your synced history, custom modes, vocabulary, and preferences as JSON.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white hover:bg-white/[0.09]"
                >
                  <Download className="h-3.5 w-3.5 text-cyan-400" />
                  Export JSON
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.07] space-y-3">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-medium">
                <ShieldAlert className="h-4 w-4" />
                <span>Cloud Data Deletion Controls</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmAction('history')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Voice History
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('chats')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear AI Chats
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('all')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-600/20 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-600/35"
                >
                  Reset All Cloud Data
                </button>
              </div>

              {confirmAction && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/35 p-3 text-xs">
                  <span className="text-rose-100">
                    Confirm permanently deleting{' '}
                    {confirmAction === 'history'
                      ? 'all Voice History entries'
                      : confirmAction === 'chats'
                        ? 'all AI Assistant conversations'
                        : 'all cloud VOXIFY data for your account'}
                    ?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => setConfirmAction(null)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-slate-200 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={async () => {
                        setBusyAction(true);
                        try {
                          if (confirmAction === 'history') await onClearHistory();
                          if (confirmAction === 'chats') await onClearChats();
                          if (confirmAction === 'all') await onResetAll();
                        } finally {
                          setBusyAction(false);
                          setConfirmAction(null);
                        }
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1 font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      {busyAction ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
