"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatRollRequestExpression,
  SUPPORTED_DICE,
  type DiceSides,
  type DiceTerm
} from "../lib/dice";

type DiceRollerProps = {
  diceColor: string;
  onRoll: (request: { terms: DiceTerm[]; modifier: number }) => void;
  disabled?: boolean;
};

type DraftTerm = DiceTerm & {
  id: string;
};

function createDraftTerm(sides: DiceSides = 20): DraftTerm {
  return {
    id: crypto.randomUUID(),
    quantity: 1,
    sides
  };
}

export function DiceRoller({ diceColor, onRoll, disabled }: DiceRollerProps) {
  const [terms, setTerms] = useState<DraftTerm[]>(() => [createDraftTerm(20)]);
  const [modifier, setModifier] = useState(0);

  const expression = useMemo(() => {
    try {
      return formatRollRequestExpression({ terms, modifier });
    } catch {
      return "Fix dice selection";
    }
  }, [modifier, terms]);

  function updateTerm(id: string, patch: Partial<DiceTerm>) {
    setTerms((current) =>
      current.map((term) => (term.id === id ? { ...term, ...patch } : term))
    );
  }

  function removeTerm(id: string) {
    setTerms((current) => (current.length === 1 ? current : current.filter((term) => term.id !== id)));
  }

  function addTerm(sides: DiceSides) {
    setTerms((current) => [...current, createDraftTerm(sides)]);
  }

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

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
            Dice groups
          </h3>
          <span className="text-xs text-stone-500">Max 20 dice total</span>
        </div>

        {terms.map((term, index) => (
          <div
            key={term.id}
            className="grid grid-cols-[4.5rem_1fr_2.75rem] items-end gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3"
          >
            <label className="block">
              <span className="text-xs font-semibold text-stone-400">Qty</span>
              <input
                min={1}
                max={20}
                type="number"
                value={term.quantity}
                onChange={(event) => updateTerm(term.id, { quantity: Number(event.target.value) })}
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 text-stone-50 outline-none focus:border-brass focus:ring-2 focus:ring-brass/30"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-stone-400">Die</span>
              <select
                value={term.sides}
                onChange={(event) => updateTerm(term.id, { sides: Number(event.target.value) })}
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 text-stone-50 outline-none focus:border-brass focus:ring-2 focus:ring-brass/30"
              >
                {SUPPORTED_DICE.map((sides) => (
                  <option key={sides} value={sides}>
                    d{sides}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={terms.length === 1}
              onClick={() => removeTerm(term.id)}
              aria-label={`Remove dice group ${index + 1}`}
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:border-crimson/50 hover:text-crimson focus:outline-none focus:ring-2 focus:ring-crimson disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          {SUPPORTED_DICE.map((sides) => (
            <button
              key={sides}
              type="button"
              onClick={() => addTerm(sides)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-stone-200 transition hover:border-brass/60 hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass"
            >
              <Plus size={13} />
              d{sides}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
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
        onClick={() =>
          onRoll({
            terms: terms.map((term) => ({ quantity: term.quantity, sides: term.sides })),
            modifier
          })
        }
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brass px-5 text-sm font-black uppercase tracking-[0.14em] text-ink-950 transition hover:bg-[#e2ad66] focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw size={18} />
        Roll
      </button>
    </section>
  );
}
