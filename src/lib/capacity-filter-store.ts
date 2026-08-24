/**
 * Owner-editable default size chips (tons / kBTU / gallons).
 * Empty overlay = factory ladders in capacity-filter.ts.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "./safe-persist-storage";
import type { CapacityMetric } from "./capacity-filter";

type CapacityFilterState = {
  optionsByMetric: Partial<Record<CapacityMetric, number[]>>;
  setOptions: (metric: CapacityMetric, values: number[]) => void;
  resetMetric: (metric: CapacityMetric) => void;
  resetAll: () => void;
};

export const useCapacityFilterStore = create<CapacityFilterState>()(
  persist(
    (set) => ({
      optionsByMetric: {},
      setOptions: (metric, values) =>
        set((s) => ({
          optionsByMetric: {
            ...s.optionsByMetric,
            [metric]: values.filter((n) => Number.isFinite(n) && n > 0),
          },
        })),
      resetMetric: (metric) =>
        set((s) => {
          const next = { ...s.optionsByMetric };
          delete next[metric];
          return { optionsByMetric: next };
        }),
      resetAll: () => set({ optionsByMetric: {} }),
    }),
    {
      name: "acme-capacity-chips-v1",
      storage: safePersistStorage(),
      partialize: (s) => ({ optionsByMetric: s.optionsByMetric }),
    },
  ),
);
