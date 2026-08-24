/** Tablet two-pane mock. Default off. Phone never uses it. */
import { useSyncExternalStore } from "react";

const KEY = "acme-tablet-pane-mock";

let on = false;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function hydrateTabletPanePref(): void {
  on = readStored();
}

hydrateTabletPanePref();

export function getTabletPane(): boolean {
  return on;
}

export function setTabletPane(next: boolean): void {
  on = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeTabletPane(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTabletPane() {
  return useSyncExternalStore(subscribeTabletPane, getTabletPane, () => false);
}
