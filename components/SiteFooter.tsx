import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 pb-6 pt-2 text-xs font-semibold text-stone-500 sm:px-6 lg:px-8">
      <Link className="transition hover:text-brass focus:text-brass focus:outline-none" href="/privacy">
        Privacy
      </Link>
      <Link className="transition hover:text-brass focus:text-brass focus:outline-none" href="/legal">
        Legal Notice / Impressum
      </Link>
      <Link className="transition hover:text-brass focus:text-brass focus:outline-none" href="/contact">
        Contact
      </Link>
    </footer>
  );
}
