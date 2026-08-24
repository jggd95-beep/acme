/**
 * Owner-editable accessory kit dollars, hours, and packet copy.
 * Empty overlay = factory numbers in accessories.ts.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "./safe-persist-storage";
import type { AccessoryDef } from "./accessories";

export type AccessoryKitOverride = {
  label?: string;
  blurb?: string;
  laborHours?: number;
  materialCost?: number;
  offerScopeLine?: string;
  packetBenefit?: string;
};

type AccessoryKitState = {
  overrides: Record<string, AccessoryKitOverride>;
  setOverride: (id: string, patch: AccessoryKitOverride) => void;
  resetOverride: (id: string) => void;
  resetAll: () => void;
};

export const useAccessoryKitStore = create<AccessoryKitState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (id, patch) =>
        set((s) => ({
          overrides: {
            ...s.overrides,
            [id]: { ...s.overrides[id], ...patch },
          },
        })),
      resetOverride: (id) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[id];
          return { overrides: next };
        }),
      resetAll: () => set({ overrides: {} }),
    }),
    {
      name: "acme-accessory-kits-v1",
      storage: safePersistStorage(),
      partialize: (s) => ({ overrides: s.overrides }),
    },
  ),
);

export function overlayAccessoryDef(def: AccessoryDef): AccessoryDef {
  const o = useAccessoryKitStore.getState().overrides[def.id];
  if (!o) return def;
  return {
    ...def,
    label: (o.label || "").trim() || def.label,
    blurb: (o.blurb || "").trim() || def.blurb,
    laborHours:
      o.laborHours != null && Number.isFinite(o.laborHours)
        ? o.laborHours
        : def.laborHours,
    materialCost:
      o.materialCost != null && Number.isFinite(o.materialCost)
        ? o.materialCost
        : def.materialCost,
    offerScopeLine: (o.offerScopeLine || "").trim() || def.offerScopeLine,
    packetBenefit: (o.packetBenefit || "").trim() || def.packetBenefit,
  };
}
