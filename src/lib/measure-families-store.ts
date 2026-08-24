/**
 * Owner overlays for measure-chip labels and visibility.
 * Factory MEASURE_FAMILIES stay the source of truth; this only overrides.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  MEASURE_FAMILIES,
  type MeasureFamilyDef,
  type MeasureFamilyId,
} from "@/lib/quote-wizard";

export type FamilyOverride = {
  label?: string;
  blurb?: string;
  live?: boolean;
  requiresPermit?: boolean;
};

type State = {
  overrides: Partial<Record<MeasureFamilyId, FamilyOverride>>;
  setOverride: (id: MeasureFamilyId, patch: FamilyOverride) => void;
  resetOverrides: () => void;
};

export const useMeasureFamilyStore = create<State>()(
  persist(
    (set, get) => ({
      overrides: {},
      setOverride: (id, patch) =>
        set({
          overrides: {
            ...get().overrides,
            [id]: { ...get().overrides[id], ...patch },
          },
        }),
      resetOverrides: () => set({ overrides: {} }),
    }),
    {
      name: "aarvaks_measure_families_v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function effectiveMeasureFamilies(): MeasureFamilyDef[] {
  const ov = useMeasureFamilyStore.getState().overrides;
  return MEASURE_FAMILIES.map((f) => {
    const o = ov[f.id];
    if (!o) return f;
    let label = (o.label || "").trim() || f.label;
    // Drop stale factory name we renamed
    if (f.id === "wall_heater" && /williams/i.test(label)) label = f.label;
    if (f.id === "ductwork" && /seal|mod/i.test(label)) label = f.label;
    return {
      ...f,
      label,
      blurb: (o.blurb || "").trim() || f.blurb,
      live: o.live ?? f.live,
      requiresPermit: o.requiresPermit ?? f.requiresPermit,
    };
  });
}

export function effectiveFamilyLabel(id: string): string {
  const f = effectiveMeasureFamilies().find((x) => x.id === id);
  return f?.label || id;
}

export function isFamilyLive(id: string): boolean {
  const f = effectiveMeasureFamilies().find((x) => x.id === id);
  return Boolean(f?.live);
}
