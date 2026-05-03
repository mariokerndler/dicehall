"use client";

import { Clock3, ScrollText } from "lucide-react";
import type { Roll } from "../lib/dice";

type RollLogProps = {
  rolls: Roll[];
};

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(timestamp);
}

function resultText(roll: Roll) {
  const results = roll.terms?.length
    ? roll.terms
        .map((term) => `${term.quantity}d${term.sides} [${term.results.join(", ")}]`)
        .join(" + ")
    : `[${roll.results.join(", ")}]`;

  if (roll.modifier > 0) {
    return `${results} + ${roll.modifier} = ${roll.total}`;
  }

  if (roll.modifier < 0) {
    return `${results} - ${Math.abs(roll.modifier)} = ${roll.total}`;
  }

  return `${results} = ${roll.total}`;
}

export function RollLog({ rolls }: RollLogProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-ink-900/80 p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <ScrollText size={18} className="text-brass" />
        <h2 className="text-lg font-bold text-stone-50">Roll log</h2>
      </div>

      {rolls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm text-stone-400">
          No rolls yet. The next toss will land here for everyone.
        </div>
      ) : (
        <div className="space-y-3">
          {rolls.map((roll, index) => (
            <article
              key={roll.id}
              className="rounded-lg border bg-white/[0.035] p-4"
              style={{
                borderColor: index === 0 ? roll.diceColor : "rgba(255,255,255,0.10)",
                boxShadow: index === 0 ? `0 0 0 1px ${roll.diceColor}55` : undefined
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-stone-50">
                    <span style={{ color: roll.diceColor }}>{roll.playerName}</span> rolled{" "}
                    {roll.expression}
                  </p>
                  <p className="mt-1 text-sm text-stone-300">{resultText(roll)}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <Clock3 size={13} />
                  {formatTime(roll.timestamp)}
                </div>
              </div>
              <p className="mt-3 text-3xl font-black text-stone-50">{roll.total}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
