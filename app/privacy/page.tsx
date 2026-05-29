import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";

export default function PrivacyPage() {
  return (
    <>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-ink-900/85 p-5 shadow-card sm:p-7">
          <Link className="text-sm font-black uppercase tracking-[0.14em] text-brass" href="/">
            Dicehall
          </Link>
          <h1 className="mt-4 text-3xl font-black text-stone-50">Privacy Notice</h1>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Controller</h2>
            <p className="text-sm leading-7 text-stone-300">
              Site operator: Mario Kerndler. Contact: mariokerndler@gmail.com. Address:
              Donaustadtstraße 30/9/4/14, 1220 Vienna, Austria.
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Data processed by Dicehall</h2>
            <ul className="grid gap-2 text-sm leading-7 text-stone-300">
              <li>Lobby and dice data are held in server memory while a lobby is active.</li>
              <li>Browser session storage keeps your local lobby identity for the current browser session.</li>
              <li>Realtime connection data is processed technically to run Socket.IO lobbies.</li>
              <li>Anonymous feedback stores only the selected type, message, page context, ID, and timestamp.</li>
              <li>The hosting provider may keep server access or error logs under its own retention policy.</li>
            </ul>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Purpose and legal basis</h2>
            <p className="text-sm leading-7 text-stone-300">
              Dicehall processes technical and lobby data to provide the dice rolling service requested by
              users. Anonymous feedback is used to maintain and improve the service. If hosting logs are
              processed, they are used for security, reliability, and troubleshooting.
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Retention</h2>
            <p className="text-sm leading-7 text-stone-300">
              Active lobby data expires from memory when the lobby expires, the server restarts, or the app
              is redeployed. Anonymous feedback should be reviewed and deleted when no longer needed; the
              recommended maximum retention is 180 days. Hosting logs follow the hosting provider&apos;s
              configured retention period.
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Cookies and local storage</h2>
            <p className="text-sm leading-7 text-stone-300">
              Dicehall does not use analytics, advertising, or marketing cookies. It uses only storage and
              connection mechanisms needed to provide the requested realtime lobby experience. Add a consent
              banner before introducing non-essential analytics, ads, embedded third-party media, or similar
              tracking.
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-black text-stone-50">Your rights</h2>
            <p className="text-sm leading-7 text-stone-300">
              Where GDPR applies, you may have rights to information, access, rectification, erasure,
              restriction, portability, objection, and complaint to a data protection authority. Contact
              mariokerndler@gmail.com to exercise these rights.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
