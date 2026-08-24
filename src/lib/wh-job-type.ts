/**
 * Water heater only (test). Job type before location.
 * Writes what we already know so water/gas/vent are not asked twice.
 */
import type { MeasureInstance } from "./quote-wizard";
import type { ScopeAnswers } from "./scope-wizard";

export type WhJobType =
  | "like_for_like"
  | "full_pack"
  | "relocate_5"
  | "relocate"
  | "all_new";

export const WH_JOB_TYPE_OPTIONS: {
  id: WhJobType;
  label: string;
  blurb: string;
}[] = [
  { id: "like_for_like", label: "Like-for-like", blurb: "Same spot · reconnect" },
  { id: "full_pack", label: "Full pack", blurb: "Same spot · redo utilities" },
  { id: "relocate_5", label: "Relocate · 5 ft", blurb: "Short move · no pressure test" },
  { id: "relocate", label: "Relocate", blurb: "New runs · pressure test" },
  { id: "all_new", label: "All new", blurb: "No existing · new utilities" },
];

const AUTO_KEYS = [
  "wh_water_lines",
  "gas_path",
  "wh_gas_vent",
  "wh_demo",
] as const;

function isGasStyle(style: string | null | undefined) {
  return style === "gas-tank" || style === "he-gas" || style === "tankless";
}

export function applyWhJobType(
  inst: MeasureInstance,
  jobType: WhJobType,
): Partial<MeasureInstance> {
  const next: ScopeAnswers = { ...(inst.scopeAnswers || {}) };
  for (const k of AUTO_KEYS) delete next[k];

  next.wh_job_type = jobType;

  if (jobType === "like_for_like") {
    next.wh_water_lines = "reconnect";
    if (isGasStyle(inst.waterHeaterStyle)) {
      next.gas_path = "reconnect";
    }
    delete next.wh_gas_vent;
  } else if (jobType === "relocate_5") {
    next.wh_water_lines = "alter_5";
  }

  return {
    whJobType: jobType,
    scopeAnswers: next,
  };
}

/** Questions the job type already answered — never show them. */
export function whJobTypeHiddenQuestionIds(
  jobType: string | null | undefined,
): Set<string> {
  const s = new Set<string>();
  if (jobType === "like_for_like" || jobType === "relocate_5") {
    s.add("wh_water_lines");
    s.add("gas_path");
  }
  return s;
}

/** Narrow choices on questions we still ask. */
export function filterWhJobTypeOptions<T extends { id: string }>(
  questionId: string,
  options: T[],
  jobType: string | null | undefined,
): T[] {
  if (!jobType || jobType === "full_pack") return options;
  const allow = (ids: string[]) => options.filter((o) => ids.includes(o.id));

  if (questionId === "wh_water_lines") {
    if (jobType === "relocate") {
      return allow(["not_applicable", "new_extend", "by_others"]);
    }
    if (jobType === "relocate_5") {
      return allow(["not_applicable", "new_extend", "by_others"]);
    }
    if (jobType === "all_new") return options;
  }
  if (questionId === "gas_path") {
    if (jobType === "relocate_5") {
      return allow(["not_applicable", "by_others", "reconnect", "alter", "new"]);
    }
    if (jobType === "relocate" || jobType === "all_new") {
      return options;
    }
  }
  if (questionId === "wh_gas_vent") {
    if (jobType === "relocate" || jobType === "all_new") {
      return options;
    }
  }
  return options;
}

export function isElectricWaterHeaterStyle(
  style: string | null | undefined,
): boolean {
  return (
    style === "hybrid" ||
    style === "electric-tank" ||
    style === "sanden-split"
  );
}

export function whJobTypeOptionsForStyle(
  style?: string | null,
): typeof WH_JOB_TYPE_OPTIONS {
  const electric = isElectricWaterHeaterStyle(style);
  return WH_JOB_TYPE_OPTIONS.filter((o) => o.id !== "full_pack").map((o) => {
    if (o.id === "relocate_5") {
      return electric
        ? {
            ...o,
            label: "Reconnect · 5 ft",
            blurb: "Short move · reuse water lines",
          }
        : { ...o, blurb: "Short move · no pressure test" };
    }
    if (o.id === "relocate" && electric) {
      return { ...o, blurb: "New water lines" };
    }
    return o;
  });
}

export function whJobTypeLabel(id: string | null | undefined): string {
  return WH_JOB_TYPE_OPTIONS.find((o) => o.id === id)?.label || "Job type";
}
