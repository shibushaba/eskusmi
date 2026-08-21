import { invoke, isTauri } from "@tauri-apps/api/core";

/** Fully quit eskusmi (same as tray → Quit). */
export async function quitApp(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("quit_app");
}
