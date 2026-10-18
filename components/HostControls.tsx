"use client";

import { Clock, RefreshCw, Shield, Trash2 } from "lucide-react";

type HostControlsProps = {
  canUse: boolean;
  disabled?: boolean;
  onClearLog: () => void;
  onRenewSession: () => void;
  sessionTimeLeftLabel: string;
  renewalTimeLeftLabel: string | null;
};

export function HostControls({
  canUse,
  disabled,
  onClearLog,
  onRenewSession,
  sessionTimeLeftLabel,
  renewalTimeLeftLabel
}: HostControlsProps) {
  if (!canUse) {
    return null;
  }

  return (
    <section className="rounded-xl border border-brass/30 bg-brass/10 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-brass">
        <Shield size={16} />
        DM controls
      </div>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-ink-950/35 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-300">
          <Clock size={16} className="text-brass" />
          Session time
        </div>
        <span className="text-sm font-black tabular-nums text-stone-50">{sessionTimeLeftLabel}</span>
      </div>
      <button
        type="button"
        onClick={onClearLog}
        disabled={disabled}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-brass/40 bg-ink-950/40 text-sm font-bold text-stone-100 transition hover:bg-brass/15 focus:outline-none focus:ring-2 focus:ring-brass"
      >
        <Trash2 size={16} />
        Clear roll log
      </button>
      {renewalTimeLeftLabel ? (
        <div className="mt-3 rounded-lg border border-crimson/40 bg-crimson/10 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-crimson">
            <Clock size={16} />
            Session expires in {renewalTimeLeftLabel}
          </div>
          <button
            type="button"
            onClick={onRenewSession}
            disabled={disabled}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brass px-3 text-sm font-black uppercase tracking-[0.12em] text-ink-950 transition hover:bg-[#e2ad66] focus:outline-none focus:ring-2 focus:ring-brass"
          >
            <RefreshCw size={16} />
            Renew session
          </button>
        </div>
      ) : null}
    </section>
  );
}
