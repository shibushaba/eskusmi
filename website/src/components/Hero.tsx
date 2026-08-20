import { motion } from "motion/react";
import { DownloadButton } from "./DownloadButton";

type HeroProps = {
  reduceMotion: boolean;
};

export function Hero({ reduceMotion }: HeroProps) {
  const enter = reduceMotion
    ? { duration: 0 }
    : { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <section className="flex flex-col items-center pt-8 text-center sm:pt-14">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={enter}
        className="esk-orb flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="esk-orb__mark">e</span>
      </motion.div>

      <motion.h1
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { ...enter, delay: 0.08 }
        }
        className="mt-7 text-[0.9rem] font-medium tracking-[0.14em] text-[color:var(--color-esk-text)]"
      >
        eskusmi
      </motion.h1>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { ...enter, delay: 0.16 }
        }
        className="mt-4 max-w-sm text-[1.35rem] font-medium leading-snug tracking-wide text-[color:var(--color-esk-text)] sm:text-[1.55rem]"
      >
        Interrupt, without interrupting.
      </motion.p>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { ...enter, delay: 0.24 }
        }
        className="mt-4 max-w-sm text-[0.86rem] leading-relaxed tracking-wide text-[color:var(--color-esk-text-secondary)]"
      >
        A tiny attention network for people working around you.
      </motion.p>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.32 }
        }
        className="mt-5 max-w-md text-[0.78rem] leading-relaxed tracking-wide text-[color:var(--color-esk-text-muted)]"
      >
        Wearing headphones shouldn&apos;t mean disappearing.
      </motion.p>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { ...enter, delay: 0.38 }
        }
        className="mt-9 flex flex-col items-center"
      >
        <DownloadButton />
        <p className="mt-3 text-[0.68rem] tracking-wide text-[color:var(--color-esk-text-muted)]">
          Free · Windows · Local network
        </p>
      </motion.div>
    </section>
  );
}
