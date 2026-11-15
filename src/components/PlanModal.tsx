import React from 'react';
import { Check, X } from 'lucide-react';

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  const plans = [
    {
      name: 'Starter Free',
      audience: 'For individual daily dictation',
      price: '$0',
      cadence: 'Forever free',
      current: true,
      limits: [
        'Unlimited browser SpeechRecognition dictation',
        '50+ language profiles including Hinglish',
        'Custom Vocabulary & 6 built-in modes',
        'Local browser history & analytics',
      ],
    },
    {
      name: 'Voxify Pro',
      audience: 'For power writers & developers',
      price: '$14',
      cadence: 'per month',
      current: false,
      highlighted: true,
      limits: [
        'Priority Gemini AI rewrites & Developer Mode',
        'Phase 2 Whisper.cpp local desktop model bridge',
        'Unlimited Custom Modes & cloud sync',
        'Low-latency streaming voice assistant',
      ],
    },
    {
      name: 'Team Studio',
      audience: 'For engineering & product teams',
      price: '$29',
      cadence: 'per seat / month',
      current: false,
      limits: [
        'Shared team vocabulary & glossary packs',
        'Shared prompt modes & code conventions',
        'Workspace audit & centralized privacy controls',
        'Priority technical support',
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-white/12 bg-[#0D0E17] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <h2 id="plan-modal-title" className="font-display text-2xl font-semibold text-white">
              VOXIFY Plans
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              You are currently running VOXIFY Phase 1 on the Starter Free plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plans dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col justify-between rounded-xl border p-5 ${
                plan.highlighted
                  ? 'border-violet-500/45 bg-gradient-to-b from-violet-950/35 to-[#0E0F17]'
                  : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              <div>
                <p className="text-xs text-slate-400">{plan.audience}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-bold tabular-nums text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-400">{plan.cadence}</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-xs text-slate-300">
                  {plan.limits.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`mt-6 w-full rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  plan.current
                    ? 'border border-white/10 bg-white/[0.05] text-slate-300 cursor-default'
                    : plan.highlighted
                      ? 'bg-violet-600 text-white hover:bg-violet-500'
                      : 'border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.09]'
                }`}
              >
                {plan.current ? 'Active Plan' : 'Waitlist Coming in Phase 2'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
