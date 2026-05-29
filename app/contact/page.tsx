import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";

export default function ContactPage() {
  return (
    <>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-ink-900/85 p-5 shadow-card sm:p-7">
          <Link className="text-sm font-black uppercase tracking-[0.14em] text-brass" href="/">
            Dicehall
          </Link>
          <h1 className="mt-4 text-3xl font-black text-stone-50">Contact</h1>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            For privacy requests, legal notices, or operational questions, contact the Dicehall operator.
          </p>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Operator contact</h2>
            <p className="text-sm leading-7 text-stone-300">
              General contact: mariokerndler@gmail.com
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Anonymous feedback</h2>
            <p className="text-sm leading-7 text-stone-300">
              Use the feedback button on the Dicehall start or lobby screen for anonymous bug reports and
              feature requests. Do not include names, emails, lobby codes, or other personal data in the
              message.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
