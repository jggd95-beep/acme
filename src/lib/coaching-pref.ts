/** Tablet / PC only. Phone never dumps teaching text under a question. */
const KEY = "acme-show-coaching";

let show = false;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function hydrateCoachingPref(): void {
  show = readStored();
}

hydrateCoachingPref();

export function getShowCoaching(): boolean {
  return show;
}

export function setShowCoaching(next: boolean): void {
  show = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeCoaching(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
