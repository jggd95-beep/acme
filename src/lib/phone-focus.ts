/** Full-screen question layout. Toggle at the top, or hold a question ~3s to turn on. */
import { useRef, useSyncExternalStore } from "react";

export type PhoneFocusLayout = "today" | "focus" | "focus_where";

const KEY = "acme-phone-focus-layout";

let layout: PhoneFocusLayout = "today";
const listeners = new Set<() => void>();

function readStored(): PhoneFocusLayout {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "focus" || v === "focus_where") return "focus";
    if (v === "today") return "today";
  } catch {
    /* ignore */
  }
  return "today";
}

export function hydratePhoneFocus(): void {
  layout = readStored();
}

hydratePhoneFocus();

export function getPhoneFocus(): PhoneFocusLayout {
  return layout === "today" ? "today" : "focus";
}

export function setPhoneFocus(next: PhoneFocusLayout): void {
  layout = next === "today" ? "today" : "focus";
  try {
    localStorage.setItem(KEY, layout);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function togglePhoneFocus(): PhoneFocusLayout {
  const next = getPhoneFocus() === "today" ? "focus" : "today";
  setPhoneFocus(next);
  return next;
}

export function cyclePhoneFocus(): PhoneFocusLayout {
  return togglePhoneFocus();
}

export function subscribePhoneFocus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function phoneFocusLabel(v: PhoneFocusLayout): string {
  return v === "today" ? "Full screen" : "Exit full screen";
}

export function usePhoneFocus(): PhoneFocusLayout {
  return useSyncExternalStore(
    subscribePhoneFocus,
    getPhoneFocus,
    () => "today" as const,
  );
}

export function useHoldToCycleFocus(ms = 3000) {
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: (e: { target: EventTarget | null }) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("button, input, textarea, select, a, [role='button']"))
        return;
      // Phone only. Tablet / computer use the Focus button.
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches)
        return;
      clear();
      timer.current = window.setTimeout(() => {
        if (getPhoneFocus() === "today") setPhoneFocus("focus");
        timer.current = null;
      }, ms);
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
}
