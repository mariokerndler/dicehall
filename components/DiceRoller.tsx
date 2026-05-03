"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { DiceSelector } from "./DiceSelector";
import { formatRollExpression, type DiceSides } from "../lib/dice";

type DiceRollerProps = {
  diceColor: string;
  onRoll: (request: { quantity: number; sides: DiceSides; modifier: number }) => void;
  disabled?: boolean;
};

export function DiceRoller({ diceColor, onRoll, disabled }: DiceRollerProps) {
  const [sides, setSides] = useState<DiceSides>(20);
  const [quantity, setQuantity] = useState(1);
  const [modifier, setModifier] = useState(0);

  const expression = useMemo(
    () => formatRollExpression(quantity, sides, modifier),
    [modifier, quantity, sides]
  );

  return (
    <section className="rounded-xl border border-white/10 bg-ink-900/80 p-5 shadow-card">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-50">Dice controls</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-stone-400">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: diceColor }} />
            Your assigned dice color
          </div>
        </div>
        <div className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-sm font-bold text-brass">
          {expression}
        </div>
      </div>

      <DiceSelector selected={sides} onSelect={setSides} />

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-300">Quantity</span>
          <input
            min={1}
            max={20}
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-stone-50 outline-none focus:border-brass focus:ring-2 focus:ring-brass/30"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-300">Modifier</span>
          <input
            min={-99}
            max={99}
            type="number"
            value={modifier}
            onChange={(event) => setModifier(Number(event.target.value))}
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-stone-50 outline-none focus:border-brass focus:ring-2 focus:ring-brass/30"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onRoll({ quantity, sides, modifier })}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brass px-5 text-sm font-black uppercase tracking-[0.14em] text-ink-950 transition hover:bg-[#e2ad66] focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw size={18} />
        Roll
      </button>
    </section>
  );
}
