import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Edit3,
  Loader2,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
} from 'lucide-react';
import { streamAiRewrite } from '../services/api';
import { countWords } from '../services/speechEngine';
import type { ActivityEvent, CustomMode, VocabularyItem, VoxifySettings } from '../types/voxify';

interface CustomModesViewProps {
  modes: CustomMode[];
  settings: VoxifySettings;
  vocabulary: VocabularyItem[];
  onSaveMode: (mode: CustomMode, isNew: boolean) => Promise<void>;
  onDeleteMode: (id: string) => Promise<void>;
  onLogActivity: (event: Omit<ActivityEvent, 'id' | 'date'>) => void;
}

export const CustomModesView: React.FC<CustomModesViewProps> = ({
  modes,
  settings,
  vocabulary,
  onSaveMode,
  onDeleteMode,
  onLogActivity,
}) => {
  const [selectedId, setSelectedId] = useState<string>(modes[0]?.id || '');
  const [editingNew, setEditingNew] = useState(false);

  const selectedMode = modes.find((m) => m.id === selectedId) || modes[0];

  const [name, setName] = useState(selectedMode?.name || '');
  const [description, setDescription] = useState(selectedMode?.description || '');
  const [instructions, setInstructions] = useState(selectedMode?.instructions || '');
  const [tone, setTone] = useState(selectedMode?.tone || 'Balanced');
  const [language, setLanguage] = useState(selectedMode?.language || 'Same as input');
  const [savedFlag, setSavedFlag] = useState(false);

  const [sampleText, setSampleText] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [copiedTest, setCopiedTest] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadIntoForm = (mode: CustomMode) => {
    setEditingNew(false);
    setSelectedId(mode.id);
    setName(mode.name);
    setDescription(mode.description);
    setInstructions(mode.instructions);
    setTone(mode.tone);
    setLanguage(mode.language);
    setSavedFlag(false);
  };

  const startNewMode = () => {
    setEditingNew(true);
    setSelectedId('');
    setName('');
    setDescription('');
    setInstructions('');
    setTone('Professional & Clear');
    setLanguage('Same as input');
    setSavedFlag(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) return;

    const isPredefinedOnlyTemplate = Boolean(selectedMode?.isPredefined && !selectedMode?.uid);
    const isNew = editingNew || isPredefinedOnlyTemplate;
    const newId = editingNew
      ? `mode_${Date.now()}`
      : selectedMode?.id || `mode_${Date.now()}`;

    const newMode: CustomMode = {
      id: newId,
      name: name.trim(),
      description: description.trim() || 'Custom VOXIFY writing style',
      instructions: instructions.trim(),
      tone: tone.trim() || 'Balanced',
      language: language.trim() || 'Same as input',
      isPredefined: editingNew ? false : selectedMode?.isPredefined,
      updatedAt: new Date().toISOString(),
    };

    await onSaveMode(newMode, isNew);
    setEditingNew(false);
    setSelectedId(newMode.id);
    setSavedFlag(true);
    window.setTimeout(() => setSavedFlag(false), 2000);
  };

  const handleRunTest = async () => {
    if (!sampleText.trim() || !instructions.trim() || testing) return;
    setTesting(true);
    setTestError(null);
    setTestOutput('');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await streamAiRewrite(
        {
          text: sampleText,
          customMode: {
            id: selectedId || 'preview',
            name: name || 'Custom Mode',
            description,
            instructions,
            tone,
            language,
            updatedAt: new Date().toISOString(),
          },
          model: settings.ai.model,
          customInstructions: settings.ai.customInstructions,
          vocabulary,
        },
        (_delta, fullText) => {
          setTestOutput(fullText);
        },
        controller.signal
      );
      setTestOutput(res.text);
      onLogActivity({
        type: 'ai_request',
        words: countWords(res.text),
        durationSec: 0,
        aiMode: name || 'Custom Mode',
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setTestError(err instanceof Error ? err.message : 'Mode test failed.');
      }
    } finally {
      setTesting(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Custom Modes</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure reusable voice-to-writing presets synced to your Firestore profile.
          </p>
        </div>

        <button
          type="button"
          onClick={startNewMode}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Custom Mode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-3 space-y-1.5">
          {modes.map((m) => {
            const active = !editingNew && m.id === selectedId;
            return (
              <div
                key={m.id}
                className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-colors ${
                  active
                    ? 'border-violet-400/45 bg-violet-600/20 text-white'
                    : 'border-transparent hover:bg-white/[0.04] text-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadIntoForm(m)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate">{m.name}</span>
                    {m.isPredefined && (
                      <span className="text-[10px] text-slate-500">· Built-in</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400 truncate">{m.description}</p>
                </button>
                {!m.isPredefined && m.uid && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteMode(m.id);
                      if (selectedId === m.id && modes.length > 1) {
                        const next = modes.find((x) => x.id !== m.id);
                        if (next) loadIntoForm(next);
                      }
                    }}
                    aria-label={`Delete ${m.name}`}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-8 space-y-5">
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-violet-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  {editingNew ? 'Create Custom Mode' : `Edit Mode: ${name || 'Mode'}`}
                </h2>
              </div>
              {savedFlag && <span className="text-xs text-cyan-300 font-medium">Saved to Firestore</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Executive Brief"
                  className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Tone</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="e.g. Direct & Concise"
                  className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary of when to use this mode"
                  className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="Same as input, English, Hindi..."
                  className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Instructions
              </label>
              <textarea
                rows={4}
                required
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe exact formatting, structure, and voice transformation rules..."
                className="w-full rounded-xl border border-white/[0.09] bg-black/35 p-3.5 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                Save Mode
              </button>
            </div>
          </form>

          {/* Live Mode Tester */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-white">
                Test Mode on Input Text
              </h3>
              <div className="flex items-center gap-2">
                {testing && (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-100"
                  >
                    <Square className="h-3 w-3" />
                    Stop
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={testing || !sampleText.trim() || !instructions.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-600/25 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600/40 disabled:opacity-40 whitespace-nowrap"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-cyan-400" />
                  )}
                  Run Mode
                </button>
              </div>
            </div>

            <textarea
              rows={2}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Enter or paste any rough note to test this custom mode..."
              className="w-full rounded-xl border border-white/[0.07] bg-black/30 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
            />

            {testError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {testOutput && (
              <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-cyan-300">Mode Output</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(testOutput);
                      setCopiedTest(true);
                      window.setTimeout(() => setCopiedTest(false), 1600);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
                  >
                    {copiedTest ? (
                      <Check className="h-3 w-3 text-cyan-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedTest ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {testOutput}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
