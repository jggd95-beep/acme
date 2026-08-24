/**
 * Indefinite trash for Backend resets / deletes.
 * Restore anytime. Permanent empty later requires PIN (not enforced yet).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type TrashKind = "job_packages" | "questionnaires" | "job_package" | "other";

export type TrashItem = {
  id: string;
  kind: TrashKind;
  label: string;
  payload: unknown;
  deletedAt: string;
};

type State = {
  items: TrashItem[];
  push: (kind: TrashKind, label: string, payload: unknown) => string;
  restore: (id: string) => TrashItem | undefined;
  remove: (id: string) => void;
};

export const useBackendTrash = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      push: (kind, label, payload) => {
        const id = `trash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const item: TrashItem = {
          id,
          kind,
          label,
          payload,
          deletedAt: new Date().toISOString(),
        };
        set({ items: [item, ...get().items] });
        return id;
      },
      restore: (id) => {
        const item = get().items.find((x) => x.id === id);
        if (!item) return undefined;
        set({ items: get().items.filter((x) => x.id !== id) });
        return item;
      },
      remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
    }),
    {
      name: "aarvaks_backend_trash_v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
