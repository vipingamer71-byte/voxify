import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Eye,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDuration } from '../services/speechEngine';
import type { VoiceHistoryEntry } from '../types/voxify';

interface VoiceHistoryViewProps {
  history: VoiceHistoryEntry[];
  hasMoreHistory: boolean;
  onLoadMoreHistory: () => void;
  onUpdateEntry: (entry: VoiceHistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onSendToRewrite: (text: string) => void;
}

export const VoiceHistoryView: React.FC<VoiceHistoryViewProps> = ({
  history,
  hasMoreHistory,
  onLoadMoreHistory,
  onUpdateEntry,
  onDeleteEntry,
  onSendToRewrite,
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [langFilter, setLangFilter] = useState('All');
  const [selectedEntry, setSelectedEntry] = useState<VoiceHistoryEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTranscript, setDraftTranscript] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const availableLanguages = useMemo(() => {
    const names = Array.from(new Set(history.map((h) => h.languageName)));
    return ['All', ...names];
  }, [history]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return history.filter((item) => {
      const matchesLang = langFilter === 'All' || item.languageName === langFilter;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.transcript.toLowerCase().includes(q) ||
        item.languageName.toLowerCase().includes(q);
      return matchesLang && matchesSearch;
    });
  }, [history, langFilter, debouncedSearch]);

  const openEntry = (entry: VoiceHistoryEntry, editMode = false) => {
    setSelectedEntry(entry);
    setDraftTitle(entry.title);
    setDraftTranscript(entry.transcript);
    setEditing(editMode);
  };

  const handleSaveEdit = () => {
    if (!selectedEntry) return;
    const words = draftTranscript.trim() ? draftTranscript.trim().split(/\s+/).length : 0;
    const updated: VoiceHistoryEntry = {
      ...selectedEntry,
      title: draftTitle.trim() || 'Untitled Transcript',
      transcript: draftTranscript,
      wordCount: words,
    };
    onUpdateEntry(updated);
    setSelectedEntry(updated);
    setEditing(false);
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard?.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Voice History</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Search, open, edit, copy, or refine your cloud-synced dictation sessions.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">
          {filtered.length} of {history.length} loaded
        </span>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0E0F17] px-3.5 py-2.5">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts by title, keyword, or language..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0E0F17] p-1">
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLangFilter(lang)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                langFilter === lang
                  ? 'bg-violet-600/30 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-12 text-center">
          <p className="font-display text-base font-medium text-white">No transcripts yet</p>
          <p className="mt-1 text-xs text-slate-400">
            {history.length === 0
              ? 'Record your first voice session in Overview or Live Dictation to see it synced here.'
              : 'Try adjusting your search query or language filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 overflow-hidden">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openEntry(entry, false)}
                    className="text-left font-display text-sm font-semibold text-white hover:text-violet-300 transition-colors truncate block max-w-full"
                  >
                    {entry.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatDuration(entry.durationSec)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.languageName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{entry.wordCount} words</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {entry.transcript}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEntry(entry, false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08] whitespace-nowrap"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => openEntry(entry, true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08] whitespace-nowrap"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(entry.id, entry.transcript)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08] whitespace-nowrap"
                  >
                    {copiedId === entry.id ? (
                      <Check className="h-3.5 w-3.5 text-cyan-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedId === entry.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteEntry(entry.id);
                      if (selectedEntry?.id === entry.id) setSelectedEntry(null);
                    }}
                    aria-label="Delete entry"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-slate-400 hover:border-rose-500/35 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hasMoreHistory && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onLoadMoreHistory}
                className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
              >
                Load Older Transcripts
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-white/12 bg-[#0D0E17] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/[0.08]">
              <div className="flex-1 min-w-0">
                {editing ? (
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-1.5 text-base font-semibold text-white focus:border-violet-500 focus:outline-none"
                  />
                ) : (
                  <h2 className="font-display text-lg font-semibold text-white truncate">
                    {selectedEntry.title}
                  </h2>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(selectedEntry.createdAt).toLocaleString()} · {selectedEntry.languageName} ·{' '}
                  {formatDuration(selectedEntry.durationSec)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editing ? (
              <textarea
                rows={9}
                value={draftTranscript}
                onChange={(e) => setDraftTranscript(e.target.value)}
                className="w-full rounded-xl border border-white/12 bg-black/40 p-4 text-sm leading-relaxed text-slate-100 focus:border-violet-500 focus:outline-none"
              />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/30 p-4 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                {selectedEntry.transcript}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSendToRewrite(selectedEntry.transcript)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-600/35"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Rewrite
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedEntry.id, selectedEntry.transcript)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>

              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-lg bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/[0.14]"
                  >
                    Edit Transcript
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
