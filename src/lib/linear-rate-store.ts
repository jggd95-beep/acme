/**
 * Owner-editable $/ft and hole costs for linear runs (line set, gas, wire, …).
 * Empty overlay = factory numbers in linear-run.ts.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "./safe-persist-storage";
import type { LinearFamily, LinearPath, PenKind, WireGauge } from "./linear-run";

export type PathRateOverride = {
  materialPerFt?: number;
  laborHrPerFt?: number;
};

export type PenRateOverride = {
  labor?: number;
  material?: number;
};

type LinearRateState = {
  pathRates: Record<string, PathRateOverride>;
  penRates: Record<string, PenRateOverride>;
  setPathRate: (
    family: LinearFamily,
    pathId: string,
    patch: PathRateOverride,
    gauge?: WireGauge,
  ) => void;
  setPenRate: (kind: string, patch: PenRateOverride) => void;
  resetPathRate: (key: string) => void;
  resetPenRate: (kind: string) => void;
  resetAll: () => void;
};

export function pathRateKey(
  family: LinearFamily,
  pathId: string,
  gauge?: WireGauge,
): string {
  if (family === "electrical" && gauge) return `electrical:${gauge}:${pathId}`;
  return `${family}:${pathId}`;
}

export const useLinearRateStore = create<LinearRateState>()(
  persist(
    (set) => ({
      pathRates: {},
      penRates: {},
      setPathRate: (family, pathId, patch, gauge) => {
        const key = pathRateKey(family, pathId, gauge);
        set((s) => ({
          pathRates: {
            ...s.pathRates,
            [key]: { ...s.pathRates[key], ...patch },
          },
        }));
      },
      setPenRate: (kind, patch) =>
        set((s) => ({
          penRates: {
            ...s.penRates,
            [kind]: { ...s.penRates[kind], ...patch },
          },
        })),
      resetPathRate: (key) =>
        set((s) => {
          const next = { ...s.pathRates };
          delete next[key];
          return { pathRates: next };
        }),
      resetPenRate: (kind) =>
        set((s) => {
          const next = { ...s.penRates };
          delete next[kind];
          return { penRates: next };
        }),
      resetAll: () => set({ pathRates: {}, penRates: {} }),
    }),
    {
      name: "acme-linear-rates-v1",
      storage: safePersistStorage(),
      partialize: (s) => ({ pathRates: s.pathRates, penRates: s.penRates }),
    },
  ),
);

export function overlayLinearPaths(
  family: LinearFamily,
  paths: LinearPath[],
  gauge?: WireGauge,
): LinearPath[] {
  const rates = useLinearRateStore.getState().pathRates;
  return paths.map((p) => {
    const keyed = rates[pathRateKey(family, p.id, gauge)];
    const fallback =
      family === "electrical" ? rates[`electrical:${p.id}`] : undefined;
    const o = keyed || fallback;
    if (!o) return p;
    return {
      ...p,
      materialPerFt:
        o.materialPerFt != null && Number.isFinite(o.materialPerFt)
          ? o.materialPerFt
          : p.materialPerFt,
      laborHrPerFt:
        o.laborHrPerFt != null && Number.isFinite(o.laborHrPerFt)
          ? o.laborHrPerFt
          : p.laborHrPerFt,
    };
  });
}

export function overlayPenTypes<
  T extends { id: PenKind | string; labor: number; material: number },
>(pens: T[]): T[] {
  const rates = useLinearRateStore.getState().penRates;
  return pens.map((p) => {
    const o = rates[String(p.id)];
    if (!o) return p;
    return {
      ...p,
      labor:
        o.labor != null && Number.isFinite(o.labor) ? o.labor : p.labor,
      material:
        o.material != null && Number.isFinite(o.material)
          ? o.material
          : p.material,
    };
  });
}
