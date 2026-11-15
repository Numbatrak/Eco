import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * Reads synchronously on the first render, so a component can decide *not to
 * mount* something rather than mounting it and hiding it with a class. That
 * distinction matters for dialogs: a Radix dialog that is open but visually
 * hidden still renders its overlay, locks body scroll and traps focus.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // Server snapshot: assume the small layout, which renders strictly less.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** The builder's `lg` breakpoint — where the side rail replaces the sheets. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
