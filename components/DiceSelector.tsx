"use client";

import { clsx } from "clsx";
import { SUPPORTED_DICE, type DiceSides } from "../lib/dice";

type DiceSelectorProps = {
  selected: DiceSides;
  onSelect: (sides: DiceSides) => void;
};

export function DiceSelector({ selected, onSelect }: DiceSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
        Dice
      </legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {SUPPORTED_DICE.map((sides) => (
          <button
            key={sides}
            type="button"
            aria-pressed={selected === sides}
            onClick={() => onSelect(sides)}
            className={clsx(
              "h-12 rounded-lg border text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-brass",
              selected === sides
                ? "border-brass bg-brass text-ink-950 shadow-glow"
                : "border-white/10 bg-white/[0.04] text-stone-200 hover:border-brass/60 hover:bg-white/[0.07]"
            )}
          >
            d{sides}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
