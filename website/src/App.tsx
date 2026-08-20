import { useReducedMotion } from "motion/react";
import { DownloadButton } from "./components/DownloadButton";
import { Hero } from "./components/Hero";
import { APP_VERSION } from "./lib/version";

export function App() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10 sm:px-8 sm:py-14">
      <main className="flex flex-1 flex-col">
        <Hero reduceMotion={!!reduceMotion} />

        <section className="mx-auto mt-20 max-w-md text-center sm:mt-24">
          <p className="text-[0.95rem] leading-relaxed tracking-wide text-[color:var(--color-esk-text-secondary)]">
            You put on your headphones to focus.
            <br />
            eskusmi gives the people around you
            <br />a quiet way to get your attention.
          </p>
        </section>

        <section className="mx-auto mt-16 w-full max-w-sm text-center sm:mt-20">
          <p className="mb-6 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-[color:var(--color-esk-text-muted)]">
            How it works
          </p>
          <ol className="space-y-3 text-[0.88rem] tracking-wide text-[color:var(--color-esk-text)]">
            <li>See who&apos;s around</li>
            <li className="text-[color:var(--color-esk-text-muted)]" aria-hidden="true">
              ↓
            </li>
            <li>Ping them</li>
            <li className="text-[color:var(--color-esk-text-muted)]" aria-hidden="true">
              ↓
            </li>
            <li>Get their attention</li>
          </ol>
        </section>

        <section className="mx-auto mt-20 flex w-full max-w-md flex-col items-center text-center sm:mt-24">
          <p className="text-[1.05rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
            Ready to stop disappearing?
          </p>
          <p className="mt-2 text-[0.78rem] tracking-wide text-[color:var(--color-esk-text-muted)]">
            Stay focused. Stay reachable.
          </p>
          <div className="mt-6">
            <DownloadButton />
          </div>
          <p className="mt-3 text-[0.68rem] tracking-wide text-[color:var(--color-esk-text-muted)]">
            Windows · v{APP_VERSION}
          </p>
        </section>
      </main>

      <footer className="mt-24 border-t border-[color:var(--color-esk-border)] pt-8 text-center sm:mt-28">
        <p className="text-[0.78rem] font-medium tracking-[0.08em] text-[color:var(--color-esk-text)]">
          eskusmi
        </p>
        <p className="mt-1.5 text-[0.72rem] tracking-wide text-[color:var(--color-esk-text-secondary)]">
          Interrupt, without interrupting.
        </p>
        <p className="mt-4 text-[0.64rem] tracking-wide text-[color:var(--color-esk-text-muted)]">
          Windows · Local network · Free
        </p>
      </footer>
    </div>
  );
}
