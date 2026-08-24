/**
 * Job goals — multi-select packages on Situation (UNION of selected packages).
 * Stay selectable/clearable until the advisor starts real measure work
 * (model pick, site answers, or options). After that, locked; add measures
 * from the Measure types list instead.
 *
 * Backend can surface DEFAULT_JOB_GOALS for review (see Measures tab).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MeasureFamilyId } from "@/lib/quote-wizard";

export type JobGoalDef = {
  id: string;
  label: string;
  /** Goal ids fed into recommendFromGoals / packageFamiliesForGoals */
  goalIds: string[];
  /** Optional blurb for backend / hold-help */
  blurb?: string;
  /**
   * Show in the primary 2-col grid (not behind "More packages").
   * Default true for first packages; secondary packages set false.
   */
  primary?: boolean;
  /**
   * After selecting, advance to On this job hub (option B — single-focus packages).
   * Multi-system packages leave advisor on Situation to tweak.
   */
  jumpToHub?: boolean;
  /** Seed water heater path when package is applied */
  waterHeaterStyle?: "gas-tank" | "he-gas" | "electric-tank" | "hybrid" | "tankless" | "sanden-split" | null;
  /**
   * When true (default), package-seeded partner measures (HP+AH, AC+furnace)
   * share install path — pick 24V on one defaults the other.
   * Set false in Backend if a package should not auto-link paths.
   */
  linkInstallPath?: boolean;
};

export const DEFAULT_JOB_GOALS: JobGoalDef[] = [
  {
    id: "hp_coil",
    label: "Heat pump + coil",
    goalIds: ["heat_pump"],
    blurb: "Outdoor heat pump + cased coil on the existing furnace",
    primary: true,
    jumpToHub: false,
  },
  {
    id: "ductless",
    label: "Ductless",
    goalIds: ["ductless"],
    blurb: "Single or multi-zone ductless",
    primary: true,
    jumpToHub: false,
  },
  {
    id: "furnace",
    label: "Furnace",
    goalIds: ["replace_furnace"],
    primary: true,
    jumpToHub: false,
  },
  {
    id: "ac_furnace",
    label: "AC + furnace",
    goalIds: ["replace_ac", "replace_furnace"],
    blurb: "Full split system",
    primary: true,
    jumpToHub: false,
  },
  {
    id: "water_heater",
    label: "Water heater",
    goalIds: ["water_heater"],
    blurb: "Gas tank, electric, heat pump, or tankless",
    primary: true,
    jumpToHub: false,
  },
  {
    id: "hp_conversion",
    label: "Gas → heat pump",
    goalIds: ["hp_conversion"],
    blurb: "Heat pump + air handler + conversion language",
    primary: true,
    jumpToHub: false,
  },
  {
    id: "wall_heater",
    label: "Wall heater",
    goalIds: ["wall_heater"],
    blurb: "Wall heater package",
    primary: true,
    jumpToHub: false,
  },
  {
    id: "hybrid_hp",
    label: "Hybrid heat-pump",
    goalIds: ["hybrid_hp", "heat_pump", "replace_furnace"],
    blurb: "Dual fuel — heat pump + furnace",
    primary: true,
    jumpToHub: false,
  },
];

/** Retired — do not show as job packages (still add via measure chips). */
const RETIRED_JOB_GOAL_IDS = new Set([
  "iaq",
  "maintenance",
  "tankless",
  "hybrid_wh",
  "ac_only",
]);

/** Packages shown in the 2-col face grid */
export function primaryJobGoals(list: JobGoalDef[]): JobGoalDef[] {
  return list.filter((g) => g.primary !== false);
}

/** Packages behind “More systems” — none while the list is short. */
export function secondaryJobGoals(_list: JobGoalDef[]): JobGoalDef[] {
  return [];
}

type JobGoalsState = {
  goals: JobGoalDef[];
  setGoals: (goals: JobGoalDef[]) => void;
  moveGoal: (id: string, dir: -1 | 1) => void;
  addGoal: (goal: JobGoalDef) => void;
  removeGoal: (id: string) => void;
  resetDefaults: () => void;
};

function mergeJobGoalsWithDefaults(saved: JobGoalDef[] | undefined): JobGoalDef[] {
  if (!saved || saved.length === 0) return [...DEFAULT_JOB_GOALS];
  const savedClean = saved.filter((g) => !RETIRED_JOB_GOAL_IDS.has(g.id));
  const out: JobGoalDef[] = [];
  for (const s of savedClean) {
    const d = DEFAULT_JOB_GOALS.find((x) => x.id === s.id);
    if (d) {
      const patched = {
        ...d,
        ...s,
        primary: d.primary,
        label: d.label,
        jumpToHub: s.jumpToHub ?? d.jumpToHub,
        waterHeaterStyle: s.waterHeaterStyle ?? d.waterHeaterStyle,
        blurb: d.blurb ?? s.blurb,
        linkInstallPath: s.linkInstallPath ?? d.linkInstallPath,
      };
      // Hybrid used to clone HP+coil — pull the real dual-fuel seed.
      if (s.id === "hybrid_hp") {
        patched.label = d.label;
        patched.goalIds = d.goalIds;
        patched.blurb = d.blurb;
      }
      if (s.id === "water_heater") {
        patched.label = d.label;
        patched.goalIds = d.goalIds;
        patched.blurb = d.blurb;
        patched.waterHeaterStyle = undefined;
      }
      out.push(patched);
    } else {
      out.push(s);
    }
  }
  for (const d of DEFAULT_JOB_GOALS) {
    if (!out.some((x) => x.id === d.id)) out.push(d);
  }
  return out.filter((g) => !RETIRED_JOB_GOAL_IDS.has(g.id));
}

export const useJobGoalsStore = create<JobGoalsState>()(
  persist(
    (set, get) => ({
      goals: [...DEFAULT_JOB_GOALS],
      setGoals: (goals) =>
        set({
          goals: goals.filter((g) => !RETIRED_JOB_GOAL_IDS.has(g.id)),
        }),
      moveGoal: (id, dir) => {
        const list = [...get().goals];
        const i = list.findIndex((g) => g.id === id);
        if (i < 0) return;
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const tmp = list[i]!;
        list[i] = list[j]!;
        list[j] = tmp;
        set({ goals: list });
      },
      addGoal: (goal) => {
        if (RETIRED_JOB_GOAL_IDS.has(goal.id)) return;
        const list = get().goals.filter((g) => g.id !== goal.id);
        set({ goals: [...list, goal] });
      },
      removeGoal: (id) => {
        set({ goals: get().goals.filter((g) => g.id !== id) });
      },
      resetDefaults: () => set({ goals: [...DEFAULT_JOB_GOALS] }),
    }),
    {
      name: "aarvaks_job_goals_v2",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<JobGoalsState> | undefined;
        return {
          ...current,
          ...p,
          goals: mergeJobGoalsWithDefaults(p?.goals ?? current.goals),
        };
      },
    },
  ),
);

export function jobGoalById(id: string | null | undefined): JobGoalDef | null {
  if (!id) return null;
  // activeJobGoalId may be comma-joined multi-select
  const first = id.split(",")[0]?.trim();
  if (!first) return null;
  const list = useJobGoalsStore.getState().goals;
  return (
    list.find((g) => g.id === first) ||
    DEFAULT_JOB_GOALS.find((g) => g.id === first) ||
    null
  );
}

/** Map active wizard goals → matching job goal id (best effort). */
export function detectActiveJobGoalId(wizardGoals: string[]): string | null {
  const list = useJobGoalsStore.getState().goals.length
    ? useJobGoalsStore.getState().goals
    : DEFAULT_JOB_GOALS;
  const sorted = [...wizardGoals].sort().join("|");
  for (const g of list) {
    const gs = [...g.goalIds].sort().join("|");
    if (gs && gs === sorted) return g.id;
  }
  for (const g of list) {
    if (g.goalIds.length === 1 && wizardGoals.includes(g.goalIds[0])) return g.id;
  }
  return null;
}

export type { MeasureFamilyId };
