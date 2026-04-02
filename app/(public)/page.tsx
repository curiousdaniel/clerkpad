import Link from "next/link";
import { getServerSession } from "next-auth";
import { Fraunces, DM_Sans } from "next/font/google";
import { authOptions } from "@/lib/auth/options";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";
const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-navy/20 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:border-navy/40 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-950";

const features = [
  {
    title: "Built for the block",
    body: "Register bidders, call lots, and record hammer prices with a workflow tuned for live auctions—not generic spreadsheets.",
  },
  {
    title: "Invoices & reports",
    body: "Track sales and follow up with simple invoicing and reports so your team stays aligned after the last lot.",
  },
  {
    title: "Works when the hall is noisy",
    body: "Install ClerkBid as a PWA and clerk offline; when you are signed in online, events back up to your account in the cloud so you can move between devices.",
  },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  return (
    <div
      className={`${body.className} relative min-h-screen overflow-x-hidden text-ink dark:bg-slate-950 dark:text-slate-100`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(212,168,67,0.18),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(30,58,95,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(212,168,67,0.12),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(30,58,95,0.15),transparent_50%)]"
        aria-hidden
      />
      <div className="relative">
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
          <Link
            href="/"
            className={`${display.className} text-xl font-semibold tracking-tight text-navy dark:text-slate-100`}
          >
            Clerk<span className="text-gold">Bid</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {session ? (
              <Link href="/dashboard/" className={btnPrimary}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login/" className={btnSecondary}>
                  Sign in
                </Link>
                <Link href="/register/" className={btnPrimary}>
                  Get started free
                </Link>
              </>
            )}
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-20 pt-4 sm:px-8 sm:pb-28 sm:pt-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-muted dark:text-gold">
              Live auction clerking
            </p>
            <h1
              className={`${display.className} mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-navy dark:text-slate-100 sm:text-5xl sm:leading-[1.08]`}
            >
              A calm, capable clerk&apos;s companion for sale day.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted dark:text-slate-400">
              ClerkBid is a free, straightforward tool for auctioneers who need
              to clerk live auctions without wrestling complex software. Manage
              events, bidders, and sales from one place—on the floor or at the
              desk.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              {session ? (
                <Link href="/dashboard/" className={btnPrimary}>
                  Go to your dashboard
                </Link>
              ) : (
                <>
                  <Link href="/register/" className={btnPrimary}>
                    Create a free account
                  </Link>
                  <Link href="/login/" className={btnSecondary}>
                    I already have an account
                  </Link>
                </>
              )}
            </div>
          </div>

          <ul className="mt-20 grid gap-6 sm:grid-cols-3">
            {features.map(({ title, body: text }) => (
              <li
                key={title}
                className="rounded-2xl border border-navy/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80"
              >
                <h2
                  className={`${display.className} text-lg font-semibold text-navy dark:text-slate-100`}
                >
                  {title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted dark:text-slate-400">
                  {text}
                </p>
              </li>
            ))}
          </ul>

          <section className="mt-20 rounded-2xl border border-navy/10 bg-navy px-8 py-10 text-white sm:px-10 sm:py-12">
            <h2
              className={`${display.className} text-2xl font-semibold sm:text-3xl`}
            >
              Free for the auction community
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              ClerkBid is provided at no cost by{" "}
              <a
                href="https://auctionmethod.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gold underline decoration-gold/50 underline-offset-4 transition hover:decoration-gold"
              >
                AuctionMethod.com
              </a>
              —supporting auctioneers with practical software for real sale
              days. No credit card, no trial countdown—just sign up and clerk
              your next event.
            </p>
          </section>
        </main>

        <footer className="border-t border-navy/10 bg-white/60 py-8 text-center text-sm text-muted backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} ClerkBid · A free tool from{" "}
            <a
              href="https://auctionmethod.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-navy underline decoration-navy/25 underline-offset-4 hover:decoration-navy dark:text-slate-200 dark:decoration-slate-500 dark:hover:decoration-slate-300"
            >
              AuctionMethod.com
            </a>
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link
              href="/user-agreement/"
              className="font-medium text-navy underline decoration-navy/25 underline-offset-4 hover:decoration-navy dark:text-slate-200 dark:decoration-slate-500 dark:hover:decoration-slate-300"
            >
              User agreement
            </Link>
            <span className="text-navy/20 dark:text-slate-600" aria-hidden>
              ·
            </span>
            <Link
              href="/privacy-policy/"
              className="font-medium text-navy underline decoration-navy/25 underline-offset-4 hover:decoration-navy dark:text-slate-200 dark:decoration-slate-500 dark:hover:decoration-slate-300"
            >
              Privacy policy
            </Link>
            <span className="text-navy/20 dark:text-slate-600" aria-hidden>
              ·
            </span>
            <Link
              href="/feedback/"
              className="font-medium text-navy underline decoration-navy/25 underline-offset-4 hover:decoration-navy dark:text-slate-200 dark:decoration-slate-500 dark:hover:decoration-slate-300"
            >
              Feedback
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
