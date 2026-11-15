import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { VocabularyCategory, VocabularyItem } from '../types/voxify';

interface VocabularyViewProps {
  vocabulary: VocabularyItem[];
  onAddItem: (item: Omit<VocabularyItem, 'id' | 'createdAt'>) => void;
  onUpdateItem: (item: VocabularyItem) => void;
  onDeleteItem: (id: string) => void;
}

const CATEGORIES: VocabularyCategory[] = [
  'Names',
  'Company Names',
  'Technical Terminology',
  'Project Names',
  'Frequently Used Phrases',
];

export const VocabularyView: React.FC<VocabularyViewProps> = ({
  vocabulary,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 180);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [term, setTerm] = useState('');
  const [spokenAlias, setSpokenAlias] = useState('');
  const [category, setCategory] = useState<VocabularyCategory>('Technical Terminology');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return vocabulary.filter((item) => {
      const catOk = categoryFilter === 'All' || item.category === categoryFilter;
      const searchOk =
        !q ||
        item.term.toLowerCase().includes(q) ||
        item.spokenAlias.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return catOk && searchOk;
    });
  }, [categoryFilter, debouncedSearch, vocabulary]);

  const resetForm = () => {
    setEditingId(null);
    setTerm('');
    setSpokenAlias('');
    setCategory('Technical Terminology');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;

    if (editingId) {
      const existing = vocabulary.find((v) => v.id === editingId);
      if (existing) {
        onUpdateItem({
          ...existing,
          term: term.trim(),
          spokenAlias: spokenAlias.trim(),
          category,
          notes: notes.trim(),
        });
      }
    } else {
      onAddItem({
        term: term.trim(),
        spokenAlias: spokenAlias.trim(),
        category,
        notes: notes.trim(),
      });
    }
    resetForm();
  };

  const startEdit = (item: VocabularyItem) => {
    setEditingId(item.id);
    setTerm(item.term);
    setSpokenAlias(item.spokenAlias);
    setCategory(item.category);
    setNotes(item.notes || '');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Custom Vocabulary</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Add specialized terms, people, companies, and phrases. Live dictation automatically normalizes spoken aliases into exact spelling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-4 rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
            <h2 className="font-display text-base font-semibold text-white">
              {editingId ? 'Edit Vocabulary Term' : 'Add Vocabulary Term'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Exact Written Term
            </label>
            <input
              type="text"
              required
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Kubernetes, Ananya Sharma, VOXIFY"
              className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Spoken Alias (Optional)
            </label>
            <input
              type="text"
              value={spokenAlias}
              onChange={(e) => setSpokenAlias(e.target.value)}
              placeholder="e.g. cooper netties, vox if i"
              className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VocabularyCategory)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0B0C13] px-3.5 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Context Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Client stakeholder or API name"
              className="w-full rounded-xl border border-white/[0.09] bg-black/35 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {editingId ? 'Save Changes' : 'Add to Dictionary'}
          </button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0E0F17] px-3.5 py-2">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search custom vocabulary..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-[#0E0F17] px-3 py-2 text-xs text-white focus:border-violet-500/50 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center space-y-1">
                <p className="text-sm font-medium text-white">No vocabulary terms yet</p>
                <p className="text-xs text-slate-400">
                  {vocabulary.length === 0
                    ? 'Add your first custom word, brand name, or technical phrase on the left.'
                    : 'No entries match your search or category filter.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium text-white">
                          {item.term}
                        </span>
                        {item.spokenAlias && (
                          <span className="text-xs text-cyan-300">
                            ← &ldquo;{item.spokenAlias}&rdquo;
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.category}
                        {item.notes ? ` · ${item.notes}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={`Edit ${item.term}`}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-slate-300 hover:text-white hover:bg-white/[0.08]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        aria-label={`Delete ${item.term}`}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-slate-400 hover:border-rose-500/35 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
