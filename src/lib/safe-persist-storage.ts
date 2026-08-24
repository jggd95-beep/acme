import { createJSONStorage, type StateStorage } from "zustand/middleware";

/** Persist storage that works in the browser and in Node QA (no localStorage). */
export function safePersistStorage() {
  return createJSONStorage(() => {
    if (typeof localStorage !== "undefined") return localStorage;
    const mem = new Map<string, string>();
    const fake: StateStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k, v) => {
        mem.set(k, String(v));
      },
      removeItem: (k) => {
        mem.delete(k);
      },
    };
    return fake;
  });
}
