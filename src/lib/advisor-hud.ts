import { create } from "zustand";

export type AdvisorHudMoney = {
  sell: number;
  marginPct: number;
  options: number;
};

type AdvisorHud = AdvisorHudMoney & {
  workOpen: boolean;
  setWorkOpen: (open: boolean) => void;
  liveAsk: boolean;
  setLiveAsk: (open: boolean) => void;
  walkJumpOpen: boolean;
  setWalkJumpOpen: (open: boolean) => void;
  walkStepI: number;
  walkStepN: number;
  walkHighN: number;
  walkHighId: string | null;
  setWalkStep: (
    walkStepI: number,
    walkStepN: number,
    measureId?: string | null,
  ) => void;
  activeMeasureId: string | null;
  setActiveMeasureId: (id: string | null) => void;
  pendingShot: {
    measureId: string;
    dataUrl: string;
    label: string;
  } | null;
  pushShot: (shot: {
    measureId: string;
    dataUrl: string;
    label: string;
  }) => void;
  clearPendingShot: () => void;
  setMoney: (m: AdvisorHudMoney) => void;
};

export const useAdvisorHud = create<AdvisorHud>((set) => ({
  sell: 0,
  marginPct: 0,
  options: 0,
  workOpen: false,
  setWorkOpen: (workOpen) => set({ workOpen }),
  liveAsk: false,
  setLiveAsk: (liveAsk) => set({ liveAsk }),
  walkJumpOpen: false,
  setWalkJumpOpen: (walkJumpOpen) => set({ walkJumpOpen }),
  walkStepI: 1,
  walkStepN: 1,
  walkHighN: 1,
  walkHighId: null,
  setWalkStep: (walkStepI, walkStepN, measureId) =>
    set((s) => {
      const same = measureId && s.walkHighId === measureId;
      const high = same ? s.walkHighN : 0;
      const n = Math.max(1, walkStepN, walkStepI, high);
      return {
        walkStepI: Math.max(1, walkStepI),
        walkStepN: n,
        walkHighN: n,
        walkHighId: measureId || s.walkHighId,
      };
    }),
  activeMeasureId: null,
  setActiveMeasureId: (activeMeasureId) => set({ activeMeasureId }),
  pendingShot: null,
  pushShot: (pendingShot) => set({ pendingShot }),
  clearPendingShot: () => set({ pendingShot: null }),
  setMoney: (m) => set(m),
}));

export function moneyBarLabel(m: AdvisorHudMoney): string {
  if (!(m.sell > 0)) return "";
  const sell =
    m.sell >= 1000
      ? `$${(m.sell / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : `$${Math.round(m.sell)}`;
  const bits = [sell];
  if (m.marginPct >= 15 && m.marginPct <= 70) bits.push(`${Math.round(m.marginPct)}%`);
  if (m.options > 0) bits.push(`${m.options} opt`);
  return bits.join(" · ");
}
