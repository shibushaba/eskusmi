export const MOTION = {
  micro: 0.09,
  fast: 0.16,
  standard: 0.26,
  smooth: 0.34,
  emphasis: 0.46,
} as const;

export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  enter: [0.16, 1, 0.3, 1] as const,
  exit: [0.32, 0, 0.67, 0] as const,
  soft: [0.33, 1, 0.68, 1] as const,
} as const;

/** Keep in sync with ExpandedPanel open/close durations. */
export const PANEL_EXIT_MS = 220;
export const PANEL_ENTER_MS = 340;

export const SPRING = {
  soft: { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.7 },
  snappy: { type: "spring" as const, stiffness: 520, damping: 34, mass: 0.55 },
  settle: { type: "spring" as const, stiffness: 280, damping: 28, mass: 0.8 },
};
