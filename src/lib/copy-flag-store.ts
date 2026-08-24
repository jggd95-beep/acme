import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CopyFlag = {
  id: string;
  text: string;
  context: string;
  flaggedAt: number;
};

type CopyFlagState = {
  flags: CopyFlag[];
  add: (id: string, text: string, context: string) => void;
  toggle: (id: string, text: string, context: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export function normFlagText(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export const useCopyFlagStore = create<CopyFlagState>()(
  persist(
    (set) => ({
      flags: [],
      add: (id, text, context) =>
        set((s) => {
          if (s.flags.some((f) => f.id === id)) return s;
          return {
            flags: [
              ...s.flags,
              { id, text: text.trim(), context, flaggedAt: Date.now() },
            ],
          };
        }),
      toggle: (id, text, context) =>
        set((s) => {
          if (s.flags.some((f) => f.id === id)) {
            return { flags: s.flags.filter((f) => f.id !== id) };
          }
          return {
            flags: [
              ...s.flags,
              { id, text: text.trim(), context, flaggedAt: Date.now() },
            ],
          };
        }),
      remove: (id) => set((s) => ({ flags: s.flags.filter((f) => f.id !== id) })),
      clear: () => set({ flags: [] }),
    }),
    {
      name: "acme-copy-flags",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function isCopyFlagged(id: string): boolean {
  return useCopyFlagStore.getState().flags.some((f) => f.id === id);
}

export function textsMatchFlag(a: string, b: string): boolean {
  const n = normFlagText(a).replace(/^\d+[\.\)]\s*/, "");
  const ft = normFlagText(b).replace(/^\d+[\.\)]\s*/, "");
  if (n.length < 6 || ft.length < 6) return false;
  return ft === n || ft.includes(n.slice(0, 56)) || n.includes(ft.slice(0, 56));
}

export function textIsFlagged(text: string, flags: CopyFlag[]): boolean {
  return flags.some((f) => textsMatchFlag(text, f.text));
}

/** Hold once = flag. Hold the same wording again = clear every match. */
export function toggleFlagsForText(text: string, context = "field"): boolean {
  const id = `t:${normFlagText(text).slice(0, 96)}`;
  const state = useCopyFlagStore.getState();
  const hits = state.flags.filter(
    (f) => f.id === id || textsMatchFlag(f.text, text),
  );
  if (hits.length) {
    const ids = new Set(hits.map((f) => f.id));
    useCopyFlagStore.setState({
      flags: state.flags.filter((f) => !ids.has(f.id)),
    });
    return false;
  }
  state.add(id, text, context);
  return true;
}