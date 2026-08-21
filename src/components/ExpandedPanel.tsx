import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION, SPRING } from "../lib/motion";
import { statusHint } from "../lib/status";
import type { PresenceStatus, UserProfile } from "../types/user";
import type { Peer } from "../types/peer";
import type { NetworkStatus } from "../types/network";
import type { PeerPingState } from "../hooks/usePing";
import {
  CloseIcon,
  IconButton,
  PanelHeader,
} from "./common/PanelChrome";
import { PeerList } from "./PeerList";
import { StatusSelector } from "./StatusSelector";

type ExpandedPanelProps = {
  visible: boolean;
  profile: UserProfile;
  peers: Peer[];
  networkStatus: NetworkStatus;
  pingFeedback: string | null;
  peerPingState: PeerPingState | null;
  autostartEnabled: boolean;
  onCollapse: () => void;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateStatus: (status: PresenceStatus) => Promise<void>;
  onPingPeer: (peerId: string) => void;
  onToggleAutostart: (enabled: boolean) => Promise<void>;
  onQuit: () => void;
};

function initialFor(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toLowerCase() : "e";
}

export function ExpandedPanel({
  visible,
  profile,
  peers,
  networkStatus,
  pingFeedback,
  peerPingState,
  autostartEnabled,
  onCollapse,
  onUpdateName,
  onUpdateStatus,
  onPingPeer,
  onToggleAutostart,
  onQuit,
}: ExpandedPanelProps) {
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);

  useEffect(() => {
    setDraftName(profile.name);
    setEditing(false);
  }, [profile.name]);

  async function commitName(value: string) {
    const trimmed = value.trim().slice(0, 64);
    if (!trimmed) {
      setDraftName(profile.name);
      setEditing(false);
      return;
    }
    await onUpdateName(trimmed);
    setEditing(false);
  }

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await commitName(draftName);
  }

  const enter = reduceMotion
    ? { duration: 0 }
    : { duration: MOTION.smooth, ease: EASE.enter };
  const exit = reduceMotion
    ? { duration: 0 }
    : { duration: MOTION.fast, ease: EASE.exit };
  const stagger = (delay: number) =>
    reduceMotion
      ? { duration: 0 }
      : {
          duration: MOTION.standard,
          delay: visible ? delay : 0,
          ease: EASE.soft,
        };

  return (
    <motion.section
      aria-hidden={!visible}
      initial={false}
      animate={
        visible
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: reduceMotion ? 0 : 10 }
      }
      transition={visible ? enter : exit}
      className={cn(
        "esk-panel flex h-full w-full flex-col overflow-hidden",
        visible ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <motion.div
        initial={false}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
        transition={stagger(0.02)}
      >
        <PanelHeader
          brand={false}
          trailing={
            <IconButton label="Close eskusmi panel" onClick={onCollapse}>
              <CloseIcon />
            </IconButton>
          }
        />
      </motion.div>

      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3.5">
        <motion.div
          initial={false}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={stagger(0.05)}
          className="esk-card shrink-0 px-3 py-3"
        >
          <div className="flex items-center gap-2.5">
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={
                visible
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.92 }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : visible
                    ? SPRING.soft
                    : { duration: MOTION.fast, ease: EASE.exit }
              }
              className="eskusmi-orb flex h-9 w-9 shrink-0 items-center justify-center"
            >
              <span className="eskusmi-orb__mark text-[0.92rem] font-light leading-none">
                {initialFor(profile.name)}
              </span>
            </motion.span>

            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.form
                    key="edit"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: MOTION.fast, ease: EASE.out }}
                    onSubmit={(event) => void handleSaveName(event)}
                  >
                    <input
                      autoFocus
                      value={draftName}
                      maxLength={64}
                      spellCheck={false}
                      aria-label="Display name"
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => {
                        void commitName(draftName);
                      }}
                      className={cn(
                        "esk-focus-ring h-8 w-full rounded-[var(--esk-radius-sm)]",
                        "border border-[color:var(--color-esk-border-strong)] bg-black/25 px-2",
                        "text-[0.88rem] font-medium tracking-wide text-[color:var(--color-esk-text)]",
                      )}
                    />
                  </motion.form>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: MOTION.fast, ease: EASE.out }}
                    className="flex items-center gap-2"
                  >
                    <p className="esk-name min-w-0 flex-1 truncate">
                      {profile.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="esk-focus-ring shrink-0 text-[0.62rem] tracking-wide text-[color:var(--color-esk-text-muted)] transition-colors hover:text-[color:var(--color-esk-text)]"
                    >
                      Edit
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="esk-meta mt-0.5 leading-snug">
                {statusHint(profile.status)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <StatusSelector
              status={profile.status}
              onChange={(next) => {
                void onUpdateStatus(next);
              }}
            />
          </div>
        </motion.div>

        <motion.div
          className="mt-3.5 flex min-h-0 flex-1 flex-col overflow-hidden"
          initial={false}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={stagger(0.09)}
        >
          <PeerList
            peers={peers}
            networkStatus={networkStatus}
            peerPingState={peerPingState}
            onPing={onPingPeer}
          />
        </motion.div>

        <div className="mt-2 shrink-0">
          <AnimatePresence>
            {pingFeedback ? (
              <motion.p
                key={pingFeedback}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: MOTION.fast, ease: EASE.out }}
                className="esk-meta mb-2 px-0.5"
                role="status"
                aria-live="polite"
              >
                {pingFeedback}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <motion.label
            className="flex cursor-pointer items-center justify-between gap-3 px-0.5"
            initial={false}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={stagger(0.12)}
          >
            <span className="esk-meta">Launch at login</span>
            <button
              type="button"
              role="switch"
              aria-checked={autostartEnabled}
              aria-label="Launch eskusmi at login"
              data-on={autostartEnabled}
              onClick={() => {
                void onToggleAutostart(!autostartEnabled);
              }}
              className="esk-focus-ring esk-switch"
            >
              <span className="esk-switch__thumb" />
            </button>
          </motion.label>

          <motion.div
            className="mt-2 flex items-center justify-between gap-3 px-0.5"
            initial={false}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={stagger(0.14)}
          >
            <span className="esk-meta">Turn off</span>
            <button
              type="button"
              onClick={onQuit}
              className="esk-focus-ring esk-meta esk-quit"
              aria-label="Quit eskusmi"
            >
              Quit
            </button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
