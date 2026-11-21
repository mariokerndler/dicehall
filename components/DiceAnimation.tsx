"use client";

type PendingRoll = {
  id: string;
  playerName: string;
  diceColor: string;
  expression: string;
};

type DiceAnimationProps = {
  pendingRolls: PendingRoll[];
};

function getDiceCount(expression?: string): number {
  const quantities = Array.from(expression?.matchAll(/(\d+)d\d+/g) ?? []).map((match) =>
    Number(match[1])
  );
  const quantity = quantities.reduce((sum, value) => sum + value, 0) || 1;
  return Math.min(Math.max(quantity, 1), 6);
}

function getDieLabel(expression?: string): string {
  const labels = Array.from(expression?.matchAll(/\dd(\d+)/g) ?? []).map((match) => match[1]);
  return labels.length > 1 ? "*" : labels[0] ?? "?";
}

function DiceFace({
  color,
  label,
  index,
  count
}: {
  color: string;
  label: string;
  index: number;
  count: number;
}) {
  const left = (index - (count - 1) / 2) * 36 - 30;
  const top = -64 + (index % 2 === 0 ? -8 : 10);

  return (
    <div
      aria-hidden="true"
      className="dice-piece absolute grid place-items-center"
      style={
        {
          "--dice-color": color,
          "--delay": `${index * 90}ms`,
          "--start-x": `${-42 - index * 8}px`,
          "--mid-x": `${8 + index * 14}px`,
          "--end-x": `${left}px`,
          "--start-y": `${-16 + index * 5}px`,
          "--mid-y": `${-34 - index * 3}px`,
          "--end-y": `${top}px`
        } as React.CSSProperties
      }
    >
      <span className="relative text-base font-bold rounded bg-ink-950 px-1 text-stone-50">d{label}</span>
    </div>
  );
}

export function DiceAnimation({ pendingRolls }: DiceAnimationProps) {
  const active = pendingRolls[0];
  const diceCount = getDiceCount(active?.expression);
  const dieLabel = getDieLabel(active?.expression);

  return (
    <section className="panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-50">Rolling tray</h2>
          <p className="text-sm text-stone-400">Results reveal after the toss lands.</p>
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="relative min-h-48 overflow-hidden rounded-lg bg-ink-950">

        {active ? (
          <div className="relative h-48 overflow-hidden px-6">

            <div className="absolute inset-0">
              {Array.from({ length: diceCount }).map((_, index) => (
                <DiceFace
                  key={`${active.id}-${index}`}
                  color={active.diceColor}
                  label={dieLabel}
                  index={index}
                  count={diceCount}
                />
              ))}
            </div>

            <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/10 bg-ink-900 px-4 py-3">
              <p className="text-sm font-semibold text-stone-200">{active.playerName} is rolling</p>
              <p className="mt-1 text-2xl font-bold text-stone-50">{active.expression}</p>
            </div>
          </div>
        ) : (
          <div className="relative flex h-48 flex-col justify-center px-6">
            <p className="text-lg font-bold text-stone-50">Choose dice and roll</p>
            <p className="mt-2 max-w-sm text-sm text-stone-400">
              Public rolls are shared with the lobby. DM-only results stay private.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .dice-piece {
          left: 50%;
          top: 50%;
          height: 3.75rem;
          width: 3.75rem;
          border: 1px solid rgba(255, 255, 255, 0.38);
          background: var(--dice-color);
          clip-path: polygon(50% 0%, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%);
          animation: dice-roll 920ms cubic-bezier(0.14, 0.82, 0.28, 1) var(--delay) both;
          transform-origin: 50% 55%;
        }

        .dice-piece:nth-child(2n) {
          height: 3.25rem;
          width: 3.25rem;
        }

        .dice-piece:nth-child(3n) {
          clip-path: polygon(50% 2%, 96% 82%, 4% 82%);
        }

        @keyframes dice-roll {
          0% {
            opacity: 0;
            transform: translate3d(var(--start-x), var(--start-y), 0) rotate(-80deg) scale(0.68);
          }
          18% {
            opacity: 1;
          }
          62% {
            transform: translate3d(var(--mid-x), var(--mid-y), 0) rotate(360deg) scale(1.08);
            filter: blur(0.2px);
          }
          84% {
            transform: translate3d(var(--end-x), calc(var(--end-y) + 8px), 0) rotate(590deg) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate3d(var(--end-x), var(--end-y), 0) rotate(620deg) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dice-piece {
            animation: none;
            opacity: 1;
            transform: translate3d(var(--end-x), var(--end-y), 0);
          }
        }
      `}</style>
    </section>
  );
}
