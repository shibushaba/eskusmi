export const MOTION = {
  micro: 0.09,
  fast: 0.15,
  standard: 0.22,
  smooth: 0.28,
  emphasis: 0.38,
} as const;

export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  enter: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
} as const;

export const PANEL_EXIT_MS = 180;
export const PANEL_ENTER_MS = 260;
