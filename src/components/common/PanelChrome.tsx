import { cn } from "../../lib/cn";
import { statusDotClass } from "../../lib/status";
import type { PresenceStatus } from "../../types/user";

type PanelHeaderProps = {
  trailing?: React.ReactNode;
  drag?: boolean;
};

export function PanelHeader({ trailing, drag = true }: PanelHeaderProps) {
  const dragProps = drag ? ({ "data-tauri-drag-region": true } as const) : {};

  return (
    <>
      <header
        className="flex h-11 shrink-0 items-center gap-2.5 px-3.5"
        {...dragProps}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--color-esk-border)] text-[0.74rem] font-light leading-none text-[color:var(--color-esk-text)]"
          {...dragProps}
        >
          e
        </span>
        <span className="esk-title flex-1" {...dragProps}>
          eskusmi
        </span>
        {trailing}
      </header>
      <div className="mx-3.5 h-px bg-[color:var(--color-esk-divider)]" />
    </>
  );
}

type IconButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
};

export function IconButton({
  label,
  onClick,
  children,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "esk-focus-ring flex h-8 w-8 items-center justify-center rounded-full",
        "text-[color:var(--color-esk-text-muted)]",
        "transition-colors duration-[var(--esk-dur-fast)]",
        "hover:bg-[color:var(--color-esk-surface-hover)] hover:text-[color:var(--color-esk-text)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FocusGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.2 6.8C2.2 4.4 3.9 2.6 6 2.6C8.1 2.6 9.8 4.4 9.8 6.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M1.6 6.8H2.8V8.6C2.8 9 2.5 9.3 2.2 9.3C1.9 9.3 1.6 9 1.6 8.6V6.8Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 6.8H10.4V8.6C10.4 9 10.1 9.3 9.8 9.3C9.5 9.3 9.2 9 9.2 8.6V6.8Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusDot({
  status,
  className = "",
}: {
  status: PresenceStatus;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn(statusDotClass(status), className)} />
  );
}
