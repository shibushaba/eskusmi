import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  loadAutostartConfigured,
  loadAutostartPreference,
  markAutostartConfigured,
  saveAutostartPreference,
} from "../lib/storage";

/**
 * Single source of truth for Windows "Start with Windows".
 *
 * First successful launch: enable autostart once, then mark configured.
 * After the user toggles: respect their stored preference forever.
 */
export function useAutostart() {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isTauri()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const boot = async () => {
      try {
        const configured = await loadAutostartConfigured();

        if (!configured) {
          // First run — product default is ON.
          try {
            await enable();
          } catch (error) {
            console.error("[eskusmi] first-run autostart enable failed", error);
          }
          await saveAutostartPreference(true);
          await markAutostartConfigured();
          if (!cancelled) {
            setEnabled(true);
          }
          return;
        }

        const preferred = await loadAutostartPreference();
        const currently = await isEnabled();

        if (preferred && !currently) {
          await enable();
        } else if (!preferred && currently) {
          await disable();
        }

        if (!cancelled) {
          setEnabled(preferred);
        }
      } catch (error) {
        console.error("[eskusmi] autostart sync failed", error);
        if (!cancelled) {
          setEnabled(true);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const setAutostart = async (next: boolean) => {
    setEnabled(next);
    await saveAutostartPreference(next);

    if (!isTauri()) {
      return;
    }

    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
    } catch (error) {
      console.error("[eskusmi] autostart toggle failed", error);
    }
  };

  return {
    autostartEnabled: enabled,
    autostartReady: ready,
    setAutostart,
  };
}
