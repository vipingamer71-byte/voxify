import React from 'react';
import { Mic, MicOff, Pause, Loader2, Check } from 'lucide-react';
import type { RecordingState } from '../types/voxify';

interface VoiceOrbProps {
  state: RecordingState;
  audioLevel: number;
  onToggle: () => void;
  size?: 'lg' | 'md';
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  audioLevel,
  onToggle,
  size = 'lg',
}) => {
  const isListening = state === 'Listening';
  const isPaused = state === 'Paused';
  const isProcessing = state === 'Processing';
  const isError = state === 'Error';
  const isCompleted = state === 'Completed';

  const dynamicScale = isListening ? 1 + audioLevel * 0.14 : 1;
  const ringScale = isListening ? 1.12 + audioLevel * 0.25 : 1.04;

  const containerDim = size === 'lg' ? 'h-48 w-48 sm:h-52 sm:w-52' : 'h-36 w-36';
  const coreDim = size === 'lg' ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-22 w-22';

  return (
    <div className="relative flex flex-col items-center justify-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label={isListening ? 'Pause or stop voice dictation' : 'Start voice dictation'}
        className={`group relative flex ${containerDim} items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70`}
      >
        {/* Outer Ambient Acoustic Halo */}
        <span
          aria-hidden="true"
          style={{
            transform: `scale(${ringScale})`,
            opacity: isListening ? 0.45 + audioLevel * 0.35 : isPaused ? 0.25 : 0.16,
          }}
          className={`pointer-events-none absolute inset-4 rounded-full blur-2xl transition-[transform,opacity] duration-150 ${
            isError
              ? 'bg-rose-600/50'
              : isCompleted
                ? 'bg-cyan-500/40'
                : 'bg-gradient-to-tr from-violet-700/70 via-purple-600/60 to-cyan-400/50'
          }`}
        />

        {/* Secondary Orbital Ring */}
        <span
          aria-hidden="true"
          style={{
            transform: `scale(${isListening ? 1 + audioLevel * 0.18 : 1})`,
          }}
          className={`pointer-events-none absolute inset-3 rounded-full border transition-transform duration-150 ${
            isListening
              ? 'border-cyan-400/40 shadow-[0_0_40px_rgba(34,211,238,0.2)]'
              : isError
                ? 'border-rose-500/35'
                : 'border-violet-500/25 group-hover:border-violet-400/45'
          }`}
        />

        {/* Inner Acoustic Ring */}
        <span
          aria-hidden="true"
          style={{
            transform: `scale(${isListening ? 1 + audioLevel * 0.1 : 1})`,
          }}
          className={`pointer-events-none absolute inset-8 rounded-full border transition-transform duration-150 ${
            isListening
              ? 'border-violet-400/50'
              : isPaused
                ? 'border-amber-400/35'
                : 'border-white/10 group-hover:border-violet-400/30'
          }`}
        />

        {/* Main Violet-Cyan Luminous Core */}
        <span
          style={{ transform: `scale(${dynamicScale})` }}
          className={`relative flex ${coreDim} items-center justify-center rounded-full border backdrop-blur-xl transition-transform duration-150 ${
            isListening
              ? 'border-violet-300/50 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 shadow-[0_0_55px_rgba(124,58,237,0.65)]'
              : isError
                ? 'border-rose-400/40 bg-gradient-to-br from-rose-900/80 to-slate-900 shadow-[0_0_32px_rgba(244,63,94,0.25)]'
                : isPaused
                  ? 'border-amber-400/40 bg-gradient-to-br from-violet-900/75 to-slate-900 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                  : 'border-violet-400/30 bg-gradient-to-br from-violet-700/80 via-[#2E1A5F] to-[#12162A] shadow-[0_0_40px_rgba(124,58,237,0.32)] group-hover:border-violet-300/55 group-hover:shadow-[0_0_48px_rgba(139,92,246,0.45)]'
          }`}
        >
          {/* Specular Top Sheen */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-1.5 rounded-full bg-gradient-to-b from-white/20 via-transparent to-transparent"
          />

          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
          ) : isError ? (
            <MicOff className="h-8 w-8 text-rose-200" />
          ) : isPaused ? (
            <Pause className="h-8 w-8 text-amber-200" />
          ) : isCompleted ? (
            <Check className="h-8 w-8 text-cyan-200" />
          ) : (
            <Mic
              className={`h-8 w-8 transition-transform duration-150 ${
                isListening ? 'scale-110 text-white' : 'text-violet-100 group-hover:scale-105'
              }`}
            />
          )}
        </span>
      </button>
    </div>
  );
};
