"use client";

import { Check, Copy, LogOut } from "lucide-react";
import { useState } from "react";

type LobbyHeaderProps = {
  code: string;
  username: string;
  isHost: boolean;
  onLeave: () => void;
};

export function LobbyHeader({ code, username, isHost, onLeave }: LobbyHeaderProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <header className="rounded-xl border border-white/10 bg-ink-900/80 p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-400">
            {isHost ? "Hosting as DM" : "Joined as player"} · {username}
          </p>
          <h1 className="mt-1 text-3xl font-black text-stone-50">Dicehall</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-brass/40 bg-brass/10 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">Lobby code</p>
            <p className="text-2xl font-black tracking-[0.22em] text-stone-50">{code}</p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-stone-100 transition hover:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-stone-100 transition hover:border-crimson/60 hover:text-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
          >
            <LogOut size={18} />
            Leave
          </button>
        </div>
      </div>
    </header>
  );
}
