import React, { useMemo, useState } from 'react';
import type { ActivityEvent, VoiceHistoryEntry } from '../types/voxify';

interface AnalyticsViewProps {
  activity: ActivityEvent[];
  history: VoiceHistoryEntry[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ activity, history }) => {
  const [hoverDayIdx, setHoverDayIdx] = useState<number | null>(null);

  const metrics = useMemo(() => {
    const dictEvents = activity.filter((a) => a.type === 'dictation');
    const aiEvents = activity.filter((a) => a.type === 'ai_request');

    const totalWords = dictEvents.reduce((sum, a) => sum + a.words, 0);
    const timeSavedMin = totalWords > 0 ? Math.max(1, Math.round(totalWords / 40 - totalWords / 130)) : 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyWords = dictEvents
      .filter((a) => a.date === todayStr)
      .reduce((sum, a) => sum + a.words, 0);

    const langCounts: Record<string, number> = {};
    for (const h of history) {
      langCounts[h.languageName] = (langCounts[h.languageName] || 0) + h.wordCount;
    }
    for (const a of dictEvents) {
      if (a.languageName) {
        langCounts[a.languageName] = (langCounts[a.languageName] || 0) + a.words;
      }
    }
    const langEntries = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
    const topLanguage = langEntries[0]?.[0] || '—';

    const modeCounts: Record<string, number> = {};
    for (const a of aiEvents) {
      const m = a.aiMode || 'General Assistant';
      modeCounts[m] = (modeCounts[m] || 0) + 1;
    }
    const modeEntries = Object.entries(modeCounts).sort((a, b) => b[1] - a[1]);
    const topAiMode = modeEntries[0]?.[0] || '—';

    const days: Array<{ date: string; label: string; words: number; aiCount: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const words = dictEvents
        .filter((e) => e.date === iso)
        .reduce((s, e) => s + e.words, 0);
      const aiCount = aiEvents.filter((e) => e.date === iso).length;
      days.push({ date: iso, label, words, aiCount });
    }

    const maxDayWords = Math.max(100, ...days.map((d) => d.words));

    return {
      totalWords,
      dailyWords,
      timeSavedMin,
      topLanguage,
      topAiMode,
      days,
      maxDayWords,
      langEntries: langEntries.slice(0, 5),
      modeEntries: modeEntries.slice(0, 5),
      totalAiRequests: aiEvents.length,
    };
  }, [activity, history]);

  const kpis = [
    { label: 'Total words dictated', value: metrics.totalWords.toLocaleString() },
    { label: 'Daily usage (today)', value: `${metrics.dailyWords.toLocaleString()} words` },
    { label: 'Estimated time saved', value: `${metrics.timeSavedMin} min` },
    { label: 'Most-used language', value: metrics.topLanguage },
    { label: 'Most-used AI mode', value: metrics.topAiMode },
  ];

  const totalLangWords = Math.max(
    1,
    metrics.langEntries.reduce((s, [, w]) => s + w, 0)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Analytics</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Real dictation volume, velocity gains, language distribution, and AI workflow utilization from your account.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-white/[0.08] bg-[#0E0F17]/90 px-4 py-3.5"
          >
            <p className="text-xs text-slate-400">{kpi.label}</p>
            <p className="mt-1.5 font-display text-xl font-semibold tabular-nums text-white truncate">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl border border-white/[0.09] bg-[#0D0E16]/95 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Weekly Dictation Activity
              </h2>
              <p className="text-xs text-slate-400">
                Words captured per day over the past 7 days
              </p>
            </div>
            {hoverDayIdx !== null && metrics.days[hoverDayIdx] && (
              <div className="font-mono text-xs text-cyan-300 tabular-nums">
                {metrics.days[hoverDayIdx].date} · {metrics.days[hoverDayIdx].words.toLocaleString()} words ·{' '}
                {metrics.days[hoverDayIdx].aiCount} AI runs
              </div>
            )}
          </div>

          <div className="mt-6 h-60 flex items-end justify-between gap-3 px-2">
            {metrics.days.map((day, idx) => {
              const pct = day.words > 0 ? Math.max(8, Math.round((day.words / metrics.maxDayWords) * 100)) : 4;
              const isHovered = hoverDayIdx === idx;
              return (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoverDayIdx(idx)}
                  onMouseLeave={() => setHoverDayIdx(null)}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-2 group cursor-pointer"
                >
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums opacity-80 group-hover:text-cyan-300">
                    {day.words}
                  </span>
                  <div className="w-full max-w-[44px] h-44 flex items-end rounded-lg bg-white/[0.03] p-1">
                    <div
                      style={{ height: `${pct}%` }}
                      className={`w-full rounded-md transition-all duration-200 ${
                        day.words === 0
                          ? 'bg-white/[0.06]'
                          : isHovered
                            ? 'bg-gradient-to-t from-violet-600 to-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                            : 'bg-gradient-to-t from-violet-700/80 to-violet-400/90'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-white">Language Share</h2>
            {metrics.langEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                No dictation languages recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {metrics.langEntries.map(([lang, words]) => {
                  const share = Math.round((words / totalLangWords) * 100);
                  return (
                    <div key={lang} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200">{lang}</span>
                        <span className="font-mono text-slate-400 tabular-nums">{share}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          style={{ width: `${share}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0E16]/90 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">AI Mode Usage</h2>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {metrics.totalAiRequests} total
              </span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {metrics.modeEntries.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No AI requests logged yet.</p>
              ) : (
                metrics.modeEntries.map(([mode, count]) => (
                  <div key={mode} className="flex justify-between py-2 text-xs">
                    <span className="text-slate-300">{mode}</span>
                    <span className="font-mono text-cyan-300 tabular-nums">{count} runs</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
