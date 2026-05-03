"use client";

import { Shield, Trash2 } from "lucide-react";

type HostControlsProps = {
  canUse: boolean;
  onClearLog: () => void;
};

export function HostControls({ canUse, onClearLog }: HostControlsProps) {
  if (!canUse) {
    return null;
  }

  return (
    <section className="rounded-xl border border-brass/30 bg-brass/10 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-brass">
        <Shield size={16} />
        DM controls
      </div>
      <button
        type="button"
        onClick={onClearLog}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-brass/40 bg-ink-950/40 text-sm font-bold text-stone-100 transition hover:bg-brass/15 focus:outline-none focus:ring-2 focus:ring-brass"
      >
        <Trash2 size={16} />
        Clear roll log
      </button>
    </section>
  );
}
