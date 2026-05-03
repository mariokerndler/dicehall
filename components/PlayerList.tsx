"use client";

import { Crown, UserMinus, Users } from "lucide-react";
import type { Player } from "../lib/lobby";

type PlayerListProps = {
  players: Player[];
  currentPlayerId: string;
  isHost: boolean;
  onRemovePlayer: (playerId: string) => void;
};

export function PlayerList({ players, currentPlayerId, isHost, onRemovePlayer }: PlayerListProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-ink-900/80 p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-brass" />
          <h2 className="text-lg font-bold text-stone-50">Players</h2>
        </div>
        <span className="text-sm text-stone-400">{players.length}</span>
      </div>

      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: player.diceColor }}
                />
                <p className="truncate font-bold text-stone-100">
                  {player.username}
                  {player.id === currentPlayerId ? " (you)" : ""}
                </p>
                {player.isHost ? <Crown size={15} className="shrink-0 text-brass" /> : null}
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {player.connected ? "Online" : "Disconnected"}
              </p>
            </div>
            {isHost && !player.isHost ? (
              <button
                type="button"
                onClick={() => onRemovePlayer(player.id)}
                aria-label={`Remove ${player.username}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:border-crimson/50 hover:text-crimson focus:outline-none focus:ring-2 focus:ring-crimson"
              >
                <UserMinus size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
