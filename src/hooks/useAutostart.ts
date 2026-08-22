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
 * Launch-at-login preference (Windows / macOS via Tauri autostart).
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
          // First run — product default is ON on Windows and macOS.
          let enabledOnOs = false;
          try {
            await enable();
            enabledOnOs = await isEnabled();
          } catch (error) {
            console.error("[eskusmi] first-run autostart enable failed", error);
          }
          await saveAutostartPreference(enabledOnOs);
          await markAutostartConfigured();
          if (!cancelled) {
            setEnabled(enabledOnOs);
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
    const previous = enabled;
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

      const synced = await isEnabled();
      if (synced !== next) {
        throw new Error(`autostart state mismatch (wanted ${next}, got ${synced})`);
      }
    } catch (error) {
      console.error("[eskusmi] autostart toggle failed", error);
      setEnabled(previous);
      await saveAutostartPreference(previous);
    }
  };

  return {
    autostartEnabled: enabled,
    autostartReady: ready,
    setAutostart,
  };
}
