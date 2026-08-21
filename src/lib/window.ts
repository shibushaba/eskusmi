import { isTauri } from "@tauri-apps/api/core";
import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  primaryMonitor,
} from "@tauri-apps/api/window";

/** Native window size for the collapsed orb — also the FAB slot when expanded. */
export const FAB_SLOT = { width: 60, height: 60 } as const;
export const COLLAPSED_SIZE = FAB_SLOT;
export const EXPANDED_SIZE = { width: 300, height: 380 } as const;
export const SETUP_SIZE = { width: 320, height: 220 } as const;
export const ATTENTION_SIZE = { width: 320, height: 320 } as const;

export type WidgetMode = "collapsed" | "expanded" | "setup" | "attention";

function sizeForMode(mode: WidgetMode) {
  switch (mode) {
    case "collapsed":
      return COLLAPSED_SIZE;
    case "setup":
      return SETUP_SIZE;
    case "attention":
      return ATTENTION_SIZE;
    case "expanded":
    default:
      return EXPANDED_SIZE;
  }
}

function readAxis(
  value: { x?: number; y?: number; width?: number; height?: number },
  key: "x" | "y" | "width" | "height",
): number {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/** Place the widget near the bottom-right of the current (or primary) work area. */
export async function placeNearBottomRight(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    const win = getCurrentWindow();
    const monitor = (await currentMonitor()) ?? (await primaryMonitor());
    if (!monitor) {
      return;
    }

    const scale = monitor.scaleFactor || 1;
    const work = monitor.workArea;
    const size = await win.outerSize();
    const margin = Math.round(20 * scale);

    const workX = readAxis(work.position, "x");
    const workY = readAxis(work.position, "y");
    const workW = readAxis(work.size, "width");
    const workH = readAxis(work.size, "height");

    const x = workX + workW - size.width - margin;
    const y = workY + workH - size.height - margin;

    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  } catch {
    // Positioning is best-effort.
  }
}

/** Resize while anchoring the bottom-right corner. */
export async function syncWindowToMode(mode: WidgetMode): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const win = getCurrentWindow();
  const next = sizeForMode(mode);
  const [outerPos, outerSize, scale] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    win.scaleFactor(),
  ]);

  const nextPhysicalW = Math.round(next.width * scale);
  const nextPhysicalH = Math.round(next.height * scale);
  const nextX = Math.round(outerPos.x + (outerSize.width - nextPhysicalW));
  const nextY = Math.round(outerPos.y + (outerSize.height - nextPhysicalH));

  await win.setSize(new LogicalSize(next.width, next.height));
  await win.setPosition(new PhysicalPosition(nextX, nextY));
}

export async function syncWindowToWidget(expanded: boolean): Promise<void> {
  await syncWindowToMode(expanded ? "expanded" : "collapsed");
}

export async function startWindowDrag(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const win = getCurrentWindow();
  // Keep the orb HWND locked — Aero Snap mid-drag was blowing the tile up.
  await win.setResizable(false).catch(() => undefined);
  await win.startDragging();
}
