import React, { useMemo, useState } from 'react';
import { ChevronDown, Globe, Search } from 'lucide-react';
import { LANGUAGES, getLanguageById } from '../data/languages';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface LanguageSelectorProps {
  value: string;
  onChange: (languageId: string) => void;
  showFeaturedChips?: boolean;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  showFeaturedChips = false,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 150);

  const activeLang = getLanguageById(value);
  const featured = useMemo(() => LANGUAGES.filter((l) => l.featured), []);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.bcp47.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q)
    );
  }, [debouncedQuery]);

  return (
    <div className="space-y-2.5">
      {showFeaturedChips && (
        <div className="flex flex-wrap items-center gap-1.5">
          {featured.map((lang) => {
            const selected = lang.id === value;
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => onChange(lang.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                  selected
                    ? 'bg-violet-600/25 text-violet-100 border-violet-400/50 shadow-[0_0_15px_rgba(124,58,237,0.2)]'
                    : 'bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                {lang.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center justify-between gap-2 rounded-xl border border-white/[0.09] bg-[#0E0F17] text-slate-100 hover:border-violet-400/40 transition-colors ${
            compact ? 'px-3 py-1.5 text-xs' : 'w-full px-3.5 py-2.5 text-sm'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="truncate font-medium">{activeLang.name}</span>
            <span className="text-xs text-slate-400 truncate hidden sm:inline">
              {activeLang.nativeName} · {activeLang.bcp47}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-0 right-0 z-40 mt-2 min-w-[260px] rounded-xl border border-white/12 bg-[#0F101A]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 border border-white/[0.06]">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search 50+ languages..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">
                    No matching language found.
                  </p>
                ) : (
                  filtered.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => {
                        onChange(lang.id);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                        lang.id === value
                          ? 'bg-violet-600/25 text-white'
                          : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="truncate font-medium">
                        {lang.name}{' '}
                        <span className="text-slate-400 font-normal">({lang.nativeName})</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {lang.bcp47}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
