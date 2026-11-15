import React from 'react';

interface VoxifyLogoProps {
  compact?: boolean;
}

export const VoxifyLogo: React.FC<VoxifyLogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/25 via-indigo-600/15 to-cyan-500/20 border border-violet-400/25 shadow-[0_0_20px_rgba(124,58,237,0.22)]">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-violet-200"
        >
          <rect x="3" y="9.5" width="2.4" height="5" rx="1.2" fill="url(#voxGrad)" />
          <rect x="7.4" y="6" width="2.4" height="12" rx="1.2" fill="url(#voxGrad)" />
          <rect x="11.8" y="3.5" width="2.4" height="17" rx="1.2" fill="url(#voxGrad)" />
          <rect x="16.2" y="7" width="2.4" height="10" rx="1.2" fill="url(#voxGrad)" />
          <rect x="20.6" y="10" width="1.8" height="4" rx="0.9" fill="#22D3EE" />
          <defs>
            <linearGradient id="voxGrad" x1="3" y1="3.5" x2="20" y2="20.5" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="55%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          VOXIFY
        </span>
      )}
    </div>
  );
};
