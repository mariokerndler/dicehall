import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 pb-6 pt-2 text-xs font-semibold text-stone-400 sm:px-6 lg:px-8">
      <Link className="transition hover:text-brass focus:text-brass focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950" href="/privacy">
        Privacy
      </Link>
      <Link className="transition hover:text-brass focus:text-brass focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950" href="/legal">
        Legal Notice / Impressum
      </Link>
      <Link className="transition hover:text-brass focus:text-brass focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950" href="/contact">
        Contact
      </Link>
      {children}
    </footer>
  );
}
