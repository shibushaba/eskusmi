import { useCallback, useRef, useState } from "react";
import { PANEL_ENTER_MS, PANEL_EXIT_MS } from "../lib/motion";
import { syncWindowToMode, type WidgetMode } from "../lib/window";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useWidgetState() {
  const [expanded, setExpanded] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [attentionActive, setAttentionActive] = useState(false);
  const busyRef = useRef(false);
  const resumeExpandedRef = useRef(false);

  const resizeTo = useCallback(async (mode: WidgetMode) => {
    await syncWindowToMode(mode);
  }, []);

  const expand = useCallback(async () => {
    if (busyRef.current || expanded || attentionActive) {
      return;
    }

    busyRef.current = true;

    try {
      // Grow the native window first so the panel can emerge from the orb.
      await resizeTo("expanded");
      setExpanded(true);
      await wait(20);
      setPanelVisible(true);
      await wait(PANEL_ENTER_MS);
    } finally {
      busyRef.current = false;
    }
  }, [attentionActive, expanded, resizeTo]);

  const collapse = useCallback(async () => {
    if (busyRef.current || (!expanded && !attentionActive)) {
      return;
    }

    busyRef.current = true;

    try {
      setPanelVisible(false);
      setAttentionActive(false);
      await wait(PANEL_EXIT_MS);
      setExpanded(false);
      await resizeTo("collapsed");
    } finally {
      busyRef.current = false;
    }
  }, [attentionActive, expanded, resizeTo]);

  const showAttention = useCallback(async () => {
    for (let attempt = 0; attempt < 20 && busyRef.current; attempt += 1) {
      await wait(50);
    }
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      resumeExpandedRef.current = expanded && !attentionActive;
      setPanelVisible(false);
      setAttentionActive(true);
      setExpanded(true);
      await resizeTo("attention");
      await wait(24);
    } finally {
      busyRef.current = false;
    }
  }, [attentionActive, expanded, resizeTo]);

  const hideAttention = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      setAttentionActive(false);
      if (resumeExpandedRef.current) {
        await resizeTo("expanded");
        setExpanded(true);
        await wait(20);
        setPanelVisible(true);
        await wait(PANEL_ENTER_MS);
      } else {
        setPanelVisible(false);
        setExpanded(false);
        await resizeTo("collapsed");
      }
    } finally {
      busyRef.current = false;
    }
  }, [resizeTo]);

  return {
    expanded,
    panelVisible,
    attentionActive,
    expand,
    collapse,
    showAttention,
    hideAttention,
    resizeTo,
  };
}
