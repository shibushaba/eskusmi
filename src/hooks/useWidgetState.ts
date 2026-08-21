import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PANEL_ENTER_MS, PANEL_EXIT_MS } from "../lib/motion";
import { syncWindowToMode, type WidgetMode } from "../lib/window";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function focusWidget(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await getCurrentWindow().setFocus().catch(() => undefined);
}

export function useWidgetState() {
  const [expanded, setExpanded] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [attentionActive, setAttentionActive] = useState(false);
  const busyRef = useRef(false);
  const resumeExpandedRef = useRef(false);
  const pendingCollapseRef = useRef(false);
  const ignoreBlurUntilRef = useRef(0);
  const expandedRef = useRef(false);
  const attentionRef = useRef(false);

  expandedRef.current = expanded;
  attentionRef.current = attentionActive;

  const resizeTo = useCallback(async (mode: WidgetMode) => {
    await syncWindowToMode(mode);
  }, []);

  const collapse = useCallback(async () => {
    if (!expandedRef.current && !attentionRef.current) {
      return;
    }

    if (busyRef.current) {
      pendingCollapseRef.current = true;
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
      pendingCollapseRef.current = false;
    }
  }, [resizeTo]);

  const expand = useCallback(async () => {
    if (busyRef.current || expandedRef.current || attentionRef.current) {
      return;
    }

    busyRef.current = true;

    try {
      // Show panel chrome before resize so the FAB never fills a large HWND.
      setExpanded(true);
      setPanelVisible(false);
      await resizeTo("expanded");
      await focusWidget();
      ignoreBlurUntilRef.current = Date.now() + PANEL_ENTER_MS + 120;
      await wait(28);
      setPanelVisible(true);
      await wait(PANEL_ENTER_MS);
    } finally {
      busyRef.current = false;
      if (pendingCollapseRef.current) {
        pendingCollapseRef.current = false;
        void collapse();
      }
    }
  }, [collapse, resizeTo]);

  const showAttention = useCallback(async () => {
    for (let attempt = 0; attempt < 20 && busyRef.current; attempt += 1) {
      await wait(50);
    }
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      resumeExpandedRef.current = expandedRef.current && !attentionRef.current;
      setPanelVisible(false);
      setAttentionActive(true);
      setExpanded(true);
      await resizeTo("attention");
      await wait(40);
    } finally {
      busyRef.current = false;
    }
  }, [resizeTo]);

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
        await focusWidget();
        ignoreBlurUntilRef.current = Date.now() + PANEL_ENTER_MS + 120;
        await wait(28);
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

  useEffect(() => {
    function dismissIfOpen() {
      if (Date.now() < ignoreBlurUntilRef.current) {
        return;
      }
      if (attentionRef.current) {
        return;
      }
      if (!expandedRef.current) {
        return;
      }
      void collapse();
    }

    const onWindowBlur = () => dismissIfOpen();
    window.addEventListener("blur", onWindowBlur);

    let unlistenFocus: (() => void) | undefined;
    let unlistenClick: (() => void) | undefined;
    let cancelled = false;

    if (isTauri()) {
      void getCurrentWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            dismissIfOpen();
          }
        })
        .then((unlisten) => {
          if (cancelled) {
            unlisten();
            return;
          }
          unlistenFocus = unlisten;
        });

      void listen("eskusmi-click-outside", () => {
        dismissIfOpen();
      }).then((unlisten) => {
        if (cancelled) {
          unlisten();
          return;
        }
        unlistenClick = unlisten;
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("blur", onWindowBlur);
      unlistenFocus?.();
      unlistenClick?.();
    };
  }, [collapse]);

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
