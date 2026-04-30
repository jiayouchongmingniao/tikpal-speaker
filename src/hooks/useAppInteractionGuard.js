import { useEffect } from "react";

function isEditableTarget(target) {
  return (
    target instanceof Element &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox']"))
  );
}

function isAllowedModifierShortcut(event) {
  const key = String(event.key ?? "").toLowerCase();
  return key === "c" || key === "v" || key === "x" || key === "a";
}

function isBlockedBrowserShortcut(event) {
  const key = String(event.key ?? "");
  const lowerKey = key.toLowerCase();
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  if (key === "F5" || key === "F11" || key === "F12") {
    return true;
  }

  if (key === "BrowserBack" || key === "BrowserForward" || key === "BrowserRefresh" || key === "GoBack" || key === "GoForward") {
    return true;
  }

  if (event.altKey && (key === "ArrowLeft" || key === "ArrowRight")) {
    return true;
  }

  if (ctrlOrMeta) {
    if (event.shiftKey && (lowerKey === "i" || lowerKey === "j" || lowerKey === "c" || lowerKey === "r")) {
      return true;
    }

    if (["r", "t", "n", "w", "p", "s", "f", "u"].includes(lowerKey)) {
      return true;
    }
  }

  if (key === "Backspace" && !isEditableTarget(event.target)) {
    return true;
  }

  return false;
}

function buildLockedUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function useAppInteractionGuard({ debug = false } = {}) {
  useEffect(() => {
    const lockedUrl = buildLockedUrl();
    const baseState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};

    window.history.replaceState(
      {
        ...baseState,
        tikpalAppShell: true,
        tikpalLockedUrl: lockedUrl,
      },
      "",
      lockedUrl,
    );

    function logLifecycle(eventName) {
      if (!debug) {
        return;
      }

      try {
        const entry = {
          at: new Date().toISOString(),
          event: eventName,
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          url: buildLockedUrl(),
        };
        const previous = JSON.parse(window.localStorage.getItem("tikpal-app-shell-events") ?? "[]");
        const next = [entry, ...(Array.isArray(previous) ? previous : [])].slice(0, 24);
        window.localStorage.setItem("tikpal-app-shell-events", JSON.stringify(next));
      } catch {
        // Local storage is debug-only evidence.
      }
    }

    function preventDefaultGesture(event) {
      event.preventDefault();
    }

    function preventBrowserZoomOnWheel(event) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    }

    function preventMultiTouchBrowserPanZoom(event) {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    function onPointerDown(event) {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onMouseDown(event) {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onAuxClick(event) {
      if (event.button === 1 || event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onDragStart(event) {
      event.preventDefault();
    }

    function onSelectStart(event) {
      if (!isEditableTarget(event.target)) {
        event.preventDefault();
      }
    }

    function onKeyDown(event) {
      if (ctrlOrMetaOnlyEditShortcut(event)) {
        return;
      }

      if (isBlockedBrowserShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function ctrlOrMetaOnlyEditShortcut(event) {
      return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && isEditableTarget(event.target) && isAllowedModifierShortcut(event);
    }

    function onPopState() {
      window.history.pushState(
        {
          tikpalAppShell: true,
          tikpalLockedUrl: lockedUrl,
        },
        "",
        lockedUrl,
      );
      logLifecycle("popstate-blocked");
    }

    function onVisibilityChange() {
      logLifecycle("visibilitychange");
    }

    function onPageHide() {
      logLifecycle("pagehide");
    }

    function onBlur() {
      logLifecycle("blur");
    }

    function onBeforeUnload() {
      logLifecycle("beforeunload");
    }

    document.body.classList.add("app-shell-locked");
    document.addEventListener("gesturestart", preventDefaultGesture, { passive: false });
    document.addEventListener("gesturechange", preventDefaultGesture, { passive: false });
    document.addEventListener("gestureend", preventDefaultGesture, { passive: false });
    document.addEventListener("wheel", preventBrowserZoomOnWheel, { passive: false });
    document.addEventListener("mousewheel", preventBrowserZoomOnWheel, { passive: false });
    document.addEventListener("touchmove", preventMultiTouchBrowserPanZoom, { passive: false });
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("auxclick", onAuxClick);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("selectstart", onSelectStart);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.body.classList.remove("app-shell-locked");
      document.removeEventListener("gesturestart", preventDefaultGesture);
      document.removeEventListener("gesturechange", preventDefaultGesture);
      document.removeEventListener("gestureend", preventDefaultGesture);
      document.removeEventListener("wheel", preventBrowserZoomOnWheel);
      document.removeEventListener("mousewheel", preventBrowserZoomOnWheel);
      document.removeEventListener("touchmove", preventMultiTouchBrowserPanZoom);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("auxclick", onAuxClick);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("selectstart", onSelectStart);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [debug]);
}
