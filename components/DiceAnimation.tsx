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
  const quantity = Number(expression?.match(/^(\d+)d/)?.[1] ?? 1);
  return Math.min(Math.max(quantity, 1), 6);
}

function getDieLabel(expression?: string): string {
  return expression?.match(/\dd(\d+)/)?.[1] ?? "?";
}

function DiceFace({
  color,
  label,
  index
}: {
  color: string;
  label: string;
  index: number;
}) {
  const left = 16 + index * 11;
  const top = 48 + (index % 2 === 0 ? -8 : 10);

  return (
    <div
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
      <span className="dice-shine" />
      <span className="relative text-base font-black text-white drop-shadow">d{label}</span>
      <span className="pip pip-a" />
      <span className="pip pip-b" />
      <span className="pip pip-c" />
    </div>
  );
}

export function DiceAnimation({ pendingRolls }: DiceAnimationProps) {
  const active = pendingRolls[0];
  const diceCount = getDiceCount(active?.expression);
  const dieLabel = getDieLabel(active?.expression);

  return (
    <section className="rounded-xl border border-white/10 bg-ink-900/80 p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-50">Rolling tray</h2>
          <p className="text-sm text-stone-400">Results reveal after the toss lands.</p>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
          Live
        </div>
      </div>

      <div className="relative min-h-44 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_center,rgba(215,155,74,0.12),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:28px_28px]" />

        {active ? (
          <div className="relative h-44 overflow-hidden px-6">
            <div className="absolute inset-x-6 bottom-7 h-8 rounded-[50%] bg-black/30 blur-md" />
            <div className="absolute left-1/2 top-7 h-24 w-56 -translate-x-1/2 rounded-full border border-brass/20 bg-brass/5 blur-sm" />

            <div className="absolute inset-0">
              {Array.from({ length: diceCount }).map((_, index) => (
                <DiceFace
                  key={`${active.id}-${index}`}
                  color={active.diceColor}
                  label={dieLabel}
                  index={index}
                />
              ))}
            </div>

            <div className="absolute inset-x-5 bottom-4 rounded-lg border border-white/10 bg-ink-950/70 px-4 py-3 text-center shadow-card backdrop-blur">
              <p className="text-sm font-semibold text-stone-200">{active.playerName} is rolling</p>
              <p className="mt-1 text-2xl font-black text-stone-50">{active.expression}</p>
            </div>
          </div>
        ) : (
          <div className="relative flex h-44 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brass">Ready</p>
            <p className="mt-2 text-2xl font-black text-stone-50">Choose dice and roll</p>
            <p className="mt-2 max-w-sm text-sm text-stone-400">
              Everyone in the lobby sees the same roll animation and final result.
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
          background:
            radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.42), transparent 0.9rem),
            linear-gradient(135deg, var(--dice-color), rgba(255, 255, 255, 0.16));
          box-shadow:
            inset -10px -12px 18px rgba(0, 0, 0, 0.28),
            inset 7px 8px 14px rgba(255, 255, 255, 0.18),
            0 18px 36px rgba(0, 0, 0, 0.42);
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

        .dice-shine {
          position: absolute;
          inset: 0.5rem 0.75rem auto auto;
          height: 0.8rem;
          width: 1.1rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.34);
          filter: blur(1px);
          transform: rotate(-28deg);
        }

        .pip {
          position: absolute;
          height: 0.28rem;
          width: 0.28rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.28);
        }

        .pip-a {
          left: 1rem;
          top: 1rem;
        }

        .pip-b {
          bottom: 1rem;
          right: 1rem;
        }

        .pip-c {
          bottom: 0.9rem;
          left: 1.35rem;
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
            animation-duration: 1ms;
          }
        }
      `}</style>
    </section>
  );
}
