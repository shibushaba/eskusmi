import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION } from "../lib/motion";
import { PanelHeader } from "./common/PanelChrome";

type ProfileSetupProps = {
  visible: boolean;
  onContinue: (name: string) => Promise<void>;
};

export function ProfileSetup({ visible, onContinue }: ProfileSetupProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim().slice(0, 64);
    if (!trimmed || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await onContinue(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.section
      aria-hidden={!visible}
      initial={false}
      animate={
        visible
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 6, scale: 0.97 }
      }
      transition={{ duration: MOTION.standard, ease: EASE.out }}
      className={cn(
        "esk-panel flex h-full w-full flex-col overflow-hidden",
        visible ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <PanelHeader />

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-1 flex-col px-5 pb-5 pt-4"
      >
        <label
          htmlFor="eskusmi-name"
          className="text-[0.82rem] font-medium tracking-wide text-[color:var(--color-esk-text)]"
        >
          What&apos;s your name?
        </label>

        <input
          id="eskusmi-name"
          name="name"
          autoFocus
          autoComplete="nickname"
          spellCheck={false}
          maxLength={64}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className={cn(
            "esk-focus-ring mt-3 h-9 w-full rounded-[var(--esk-radius-md)]",
            "border border-[color:var(--color-esk-border)] bg-black/25 px-3",
            "text-[0.82rem] text-[color:var(--color-esk-text)]",
            "placeholder:text-[color:var(--color-esk-text-muted)]",
            "focus:border-[color:var(--color-esk-border-strong)]",
          )}
        />

        <p className="esk-meta mt-3 leading-relaxed">
          This is how people nearby will see you.
        </p>

        <button
          type="submit"
          disabled={!name.trim() || submitting}
          className={cn(
            "esk-focus-ring mt-auto h-9 w-full rounded-[var(--esk-radius-md)]",
            "border border-[color:var(--color-esk-border-strong)] bg-white/[0.045]",
            "text-[0.78rem] font-medium tracking-wide text-[color:var(--color-esk-text)]",
            "transition-colors duration-[var(--esk-dur-fast)] hover:bg-white/[0.07]",
            "disabled:cursor-default disabled:opacity-40",
          )}
        >
          Continue
        </button>
      </form>
    </motion.section>
  );
}
