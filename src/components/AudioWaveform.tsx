import React from 'react';
import type { RecordingState } from '../types/voxify';

interface AudioWaveformProps {
  bands: number[];
  state: RecordingState;
  height?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  bands,
  state,
  height = 48,
}) => {
  const isListening = state === 'Listening';
  const isPaused = state === 'Paused';
  const isError = state === 'Error';

  return (
    <div
      className="flex items-center justify-center gap-1 w-full px-2"
      style={{ height }}
      aria-label="Live audio waveform"
    >
      {bands.map((amp, idx) => {
        const centerDist = Math.abs(idx - (bands.length - 1) / 2) / (bands.length / 2);
        const envelope = 1 - centerDist * 0.45;
        const activeScale = isListening
          ? Math.max(0.14, Math.min(1, amp * envelope))
          : isPaused
            ? 0.22 * envelope
            : 0.14 + Math.sin(idx * 0.55) * 0.05;

        return (
          <span
            key={idx}
            style={{
              height: `${height}px`,
              transform: `scaleY(${activeScale})`,
              opacity: isListening ? 0.55 + activeScale * 0.45 : 0.35,
            }}
            className={`w-1 rounded-full origin-center transition-[transform,opacity] duration-100 ${
              isError
                ? 'bg-rose-400/70'
                : isListening
                  ? idx % 3 === 0
                    ? 'bg-cyan-400'
                    : 'bg-gradient-to-t from-violet-600 to-violet-300'
                  : 'bg-violet-400/50'
            }`}
          />
        );
      })}
    </div>
  );
};
