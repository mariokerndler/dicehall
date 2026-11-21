import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";

export default function LegalPage() {
  return (
    <>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl panel sm:p-8">
          <Link className="text-sm font-bold text-brass" href="/">
            Dicehall
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-stone-50">Legal Notice / Impressum</h1>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-bold text-stone-50">Media owner and operator</h2>
            <p className="text-sm leading-7 text-stone-300">
              Mario Kerndler
              <br />
              Donaustadtstraße 30/9/4/14
              <br />
              1220 Vienna
              <br />
              Austria
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-bold text-stone-50">Contact</h2>
            <p className="text-sm leading-7 text-stone-300">
              Email: mariokerndler@gmail.com
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-bold text-stone-50">Purpose of this website</h2>
            <p className="text-sm leading-7 text-stone-300">
              Dicehall provides a small realtime dice rolling tool for tabletop role-playing sessions.
              The site does not publish public user profiles, public posts, advertising, marketplace offers,
              or paid services in this deployment.
            </p>
          </section>

          <section className="mt-7 grid gap-3">
            <h2 className="text-lg font-bold text-stone-50">Commercial use note</h2>
            <p className="text-sm leading-7 text-stone-300">
              If this website is operated commercially, monetized, used for a business, or expanded with
              public user-generated content, the operator should review Austrian disclosure obligations,
              e-commerce information duties, consumer rules, and Digital Services Act duties before launch.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
