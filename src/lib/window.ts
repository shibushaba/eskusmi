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

type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
  margin: number;
};

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

function clamp(n: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(max, Math.max(min, n));
}

async function readWorkArea(): Promise<WorkArea | null> {
  const monitor = (await currentMonitor()) ?? (await primaryMonitor());
  if (!monitor) {
    return null;
  }

  const scale = monitor.scaleFactor || 1;
  const work = monitor.workArea;
  return {
    x: readAxis(work.position, "x"),
    y: readAxis(work.position, "y"),
    width: readAxis(work.size, "width"),
    height: readAxis(work.size, "height"),
    margin: Math.round(12 * scale),
  };
}

/**
 * Keep a physical rect fully inside the work area.
 * Prefers growing toward the side with more free space when flipping.
 */
function fitInWorkArea(
  work: WorkArea,
  anchor: { left: number; top: number; right: number; bottom: number },
  nextW: number,
  nextH: number,
): { x: number; y: number } {
  const minX = work.x + work.margin;
  const minY = work.y + work.margin;
  const maxX = work.x + work.width - work.margin - nextW;
  const maxY = work.y + work.height - work.margin - nextH;

  const spaceLeft = anchor.right - work.x;
  const spaceRight = work.x + work.width - anchor.left;
  const spaceAbove = anchor.bottom - work.y;
  const spaceBelow = work.y + work.height - anchor.top;

  // Horizontal: prefer anchoring the right edge (expand left) when there's room,
  // otherwise expand right, then clamp.
  let x =
    spaceLeft >= nextW + work.margin || spaceLeft >= spaceRight
      ? anchor.right - nextW
      : anchor.left;

  // Vertical: prefer anchoring the bottom edge (expand up) when there's room.
  let y =
    spaceAbove >= nextH + work.margin || spaceAbove >= spaceBelow
      ? anchor.bottom - nextH
      : anchor.top;

  x = clamp(x, minX, Math.max(minX, maxX));
  y = clamp(y, minY, Math.max(minY, maxY));
  return { x: Math.round(x), y: Math.round(y) };
}

/** Place the widget near the bottom-right of the current (or primary) work area. */
export async function placeNearBottomRight(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    const win = getCurrentWindow();
    const work = await readWorkArea();
    if (!work) {
      return;
    }

    const size = await win.outerSize();
    const x = work.x + work.width - size.width - work.margin;
    const y = work.y + work.height - size.height - work.margin;

    await win.setPosition(
      new PhysicalPosition(Math.round(x), Math.round(y)),
    );
  } catch {
    // Positioning is best-effort.
  }
}

/**
 * Resize for the given mode and keep the window fully on-screen.
 * Near left/top edges the panel flips open toward free space instead of clipping.
 */
export async function syncWindowToMode(mode: WidgetMode): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const win = getCurrentWindow();
  const next = sizeForMode(mode);
  const [outerPos, outerSize, scale, work] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    win.scaleFactor(),
    readWorkArea(),
  ]);

  const nextPhysicalW = Math.round(next.width * scale);
  const nextPhysicalH = Math.round(next.height * scale);

  const anchor = {
    left: outerPos.x,
    top: outerPos.y,
    right: outerPos.x + outerSize.width,
    bottom: outerPos.y + outerSize.height,
  };

  let nextX = Math.round(anchor.right - nextPhysicalW);
  let nextY = Math.round(anchor.bottom - nextPhysicalH);

  if (work) {
    const fitted = fitInWorkArea(work, anchor, nextPhysicalW, nextPhysicalH);
    nextX = fitted.x;
    nextY = fitted.y;
  }

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

/** After drag ends, pin the orb back inside the work area if it was flung off-screen. */
export async function clampWindowToWorkArea(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    const win = getCurrentWindow();
    const [outerPos, outerSize, work] = await Promise.all([
      win.outerPosition(),
      win.outerSize(),
      readWorkArea(),
    ]);
    if (!work) {
      return;
    }

    const fitted = fitInWorkArea(
      work,
      {
        left: outerPos.x,
        top: outerPos.y,
        right: outerPos.x + outerSize.width,
        bottom: outerPos.y + outerSize.height,
      },
      outerSize.width,
      outerSize.height,
    );

    if (fitted.x !== Math.round(outerPos.x) || fitted.y !== Math.round(outerPos.y)) {
      await win.setPosition(new PhysicalPosition(fitted.x, fitted.y));
    }
  } catch {
    // Best-effort.
  }
}
