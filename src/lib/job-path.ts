/**
 * After accessories — pick replace vs new so the rest of the path
 * only asks what that job needs.
 */
import type { MeasureFamilyId, MeasureInstance } from "./quote-wizard";
import type { ScopeAnswers } from "./scope-wizard";

export type JobPathId = "replace" | "new_location" | "contractor";

export const JOB_PATH_FAMILIES: MeasureFamilyId[] = [
  "wall_heater",
  "furnace",
  "heat_pump",
  "ac",
  "air_handler",
  "ductless",
  "bath_fan",
];

export function familyNeedsJobPath(familyId: string | undefined): boolean {
  return JOB_PATH_FAMILIES.includes(familyId as MeasureFamilyId);
}

export const JOB_PATH_OPTIONS: Record<
  string,
  { id: JobPathId; label: string; blurb: string }[]
> = {
  wall_heater: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Same wall opening",
    },
    {
      id: "new_location",
      label: "New install",
      blurb: "Cut in a new opening",
    },
  ],
  furnace: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Same closet or platform",
    },
    {
      id: "new_location",
      label: "New install",
      blurb: "Different closet, attic, or pad",
    },
  ],
  heat_pump: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Old unit out, new one here",
    },
    {
      id: "new_location",
      label: "New install",
      blurb: "First unit here, or moving it",
    },
  ],
  ac: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Old unit out, new one here",
    },
    {
      id: "new_location",
      label: "New install",
      blurb: "First unit here, or moving it",
    },
  ],
  air_handler: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Same closet or platform",
    },
    {
      id: "new_location",
      label: "New install",
      blurb: "New platform or closet",
    },
  ],
  ductless: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Swap outdoor + heads",
    },
    {
      id: "new_location",
      label: "New install",
      blurb: "First mini-split on this job",
    },
  ],
  bath_fan: [
    {
      id: "replace",
      label: "Replace existing",
      blurb: "Old fan out, same opening",
    },
    {
      id: "new_location",
      label: "Install new fan",
      blurb: "Cut in for this house",
    },
    {
      id: "contractor",
      label: "New fan for a contractor",
      blurb: "We set the fan — they finish",
    },
  ],
};

export function jobPathPrompt(familyId: string): string {
  if (familyId === "bath_fan") return "How is this bath fan going in?";
  return "Replace existing, or new?";
}

export function jobPathHelp(familyId: string): string {
  switch (familyId) {
    case "heat_pump":
    case "ac":
      return "Sets whether we swap the outdoor or set a new one.";
    case "wall_heater":
      return "Sets same opening vs a new cut-in. Vent and patch follow.";
    case "furnace":
      return "Sets same closet vs a new spot. Flue and gas follow.";
    case "air_handler":
      return "Sets same closet vs a new spot.";
    case "ductless":
      return "Sets swap vs first mini-split on this house.";
    case "bath_fan":
      return "Sets replace, new cut-in, or contractor-set.";
    default:
      return "Sets whether this is a swap or a new sit.";
  }
}

export function jobPathOptions(familyId: string) {
  return JOB_PATH_OPTIONS[familyId] || JOB_PATH_OPTIONS.furnace;
}

export function jobPathLabel(familyId: string, id: string | null | undefined) {
  return (
    jobPathOptions(familyId).find((o) => o.id === id)?.label || "Job type"
  );
}

export function applyJobPath(
  inst: MeasureInstance,
  path: JobPathId,
): Partial<MeasureInstance> {
  const next: ScopeAnswers = { ...(inst.scopeAnswers || {}) };
  next.job_path = path;

  if (inst.familyId === "wall_heater") {
    next.install_type = path === "new_location" ? "cut_in_new" : "replace_existing";
  } else if (inst.familyId === "ductless") {
    next.install_type = path === "new_location" ? "new" : "replace";
  } else if (inst.familyId === "bath_fan") {
    if (path === "contractor") {
      next.install_type = "contractor_new";
      next.fan_elec = "by_others";
      next.fan_duct = "by_others";
      next.fan_surface = "by_contractor";
      delete next.fan_fit;
    } else if (path === "new_location") {
      next.install_type = "cut_in_new";
      delete next.fan_fit;
      delete next.fan_elec;
      delete next.fan_duct;
      delete next.fan_surface;
    } else {
      next.install_type = "replace_existing";
      delete next.fan_elec;
      delete next.fan_duct;
      delete next.fan_surface;
    }
  } else {
    next.install_type = path;
  }

  if (path === "new_location") {
    if (!next.pad_kind) next.pad_kind = "preform";
    if (!next.line_set) next.line_set = "new_path";
    if (inst.familyId === "wall_heater") {
      delete next.wall_flue;
    }
  } else {
    delete next.wall_new_type;
    if (path === "replace") {
      delete next.line_set;
      delete next.line_set_picked;
      if (!next.pad_kind) next.pad_kind = "existing";
    }
  }

  return {
    jobPath: path,
    scopeAnswers: next,
  };
}

export function jobPathHiddenQuestionIds(
  familyId: string,
  path: string | null | undefined,
  ventStyle?: string | null,
): Set<string> {
  const s = new Set<string>(["install_type"]);
  if (familyId === "wall_heater") {
    if (path === "replace") s.add("wall_new_type");
    const dv =
      ventStyle === "rinnai" ||
      ventStyle === "direct_vent" ||
      ventStyle === "rinnai_dv" ||
      ventStyle === "williams_dv";
    if (dv) {
      s.add("wall_new_type");
      s.add("wall_attic");
      s.add("wall_flue");
      s.add("wall_flue_extra_ft");
      s.add("wall_roof_pen");
      s.add("wall_roof_access");
      s.add("wall_units_above");
      s.add("wall_vent");
      s.add("wall_shield");
      s.add("wall_shield_access");
    } else {
      s.add("wall_dv_pen");
      s.add("wall_dv_exist_access");
      s.add("wall_dv_cut_access");
      s.add("wall_dv_ext");
      s.add("wall_rin_ext");
      s.add("wall_rin_power");
      s.add("wall_rin_power_run");
    }
    if (path === "replace") {
      s.add("wall_new_type");
      s.add("finish_note");
      s.add("wall_demo_patch");
    }
    if (path === "new_location") {
      s.add("wall_dv_exist_access");
    }
  }
  if (familyId === "bath_fan") {
    if (path === "contractor") {
      s.add("fan_fit");
      s.add("fan_surface");
      s.add("fan_duct");
      s.add("fan_elec");
      s.add("fan_elec_run");
      s.add("fan_panel_where");
      s.add("fan_switch");
      s.add("fan_switch_add");
      s.add("fan_switch_feed");
      s.add("fan_switch_path");
      s.add("fan_switch_patch");
    } else if (path === "new_location") {
      s.add("fan_fit");
      s.add("fan_duct");
    }
  }
  return s;
}

/** Site-question ids to skip in compile — keep install_type (that's the remove / cut-in line). */
export function jobPathCompileExcludeIds(
  familyId: string,
  path: string | null | undefined,
  ventStyle?: string | null,
): Set<string> {
  const s = jobPathHiddenQuestionIds(familyId, path, ventStyle);
  s.delete("install_type");
  return s;
}

export function isContractorPath(path?: string | null) {
  return path === "contractor";
}

export function isRedoUtilitiesJob(
  whJobType?: string | null,
): boolean {
  return (
    whJobType === "full_pack" ||
    whJobType === "relocate" ||
    whJobType === "all_new"
  );
}

export function isNewSystemPath(
  path?: string | null,
  whJobType?: string | null,
) {
  return (
    path === "new_location" ||
    path === "contractor" ||
    whJobType === "all_new"
  );
}

export function isReplaceSystemPath(
  path?: string | null,
  whJobType?: string | null,
) {
  return path === "replace" || whJobType === "like_for_like";
}

/** New-job answers — first on a New path, last on Replace. */
const NEW_LEAD_IDS = new Set([
  "new",
  "new_path",
  "new_extend",
  "new_vent",
  "new_bvent",
  "new_run",
  "add_outlet",
  "cut_in_new",
  "long_run",
  "new_2pipe",
  "new_std",
  "attic",
  "new_switch",
  "preform",
  "new_pad",
]);

/** Replace / reuse answers — first on Replace, last on New. */
const REPLACE_LEAD_IDS = new Set([
  "existing",
  "in_place",
  "reuse_ok",
  "reuse_path",
  "reuse",
  "reconnect",
  "verified",
  "existing_5",
  "existing_10",
  "haul",
]);

const NEW_DEFAULT_BY_QUESTION: Record<string, string> = {
  elec_path: "new",
  gas_path: "new",
  line_set: "new_path",
  wh_water_lines: "new_extend",
  vent_flue: "new_vent",
  wh_gas_vent: "new_bvent",
  wh_tl_vent: "new_2pipe",
  furn_cond_path: "reconnect",
  ah_cond_path: "reconnect",
  wh_tl_cond_path: "reconnect",
  wh_pan_drain: "reconnect",
  wall_rin_power: "add_outlet",
  wall_stat_wire: "new_run",
  thermostat_hp: "new_wire",
  pad_kind: "preform",
  pad_base: "preform",
  fan_elec: "new",
  fan_duct: "new",
  fan_switch: "new_switch",
};

const REPLACE_DEFAULT_BY_QUESTION: Record<string, string> = {
  elec_path: "reconnect",
  gas_path: "reconnect",
  line_set: "reuse_path",
  wh_water_lines: "reconnect",
  vent_flue: "reuse_ok",
  wh_gas_vent: "reconnect",
  wh_tl_vent: "reconnect",
  furn_cond_path: "reconnect",
  ah_cond_path: "reconnect",
  wh_tl_cond_path: "reconnect",
  wh_pan_drain: "reconnect",
  wall_rin_power: "existing",
  wall_stat: "existing",
  wall_stat_wire: "verified",
  thermostat_hp: "reuse",
  service_light: "existing",
  wall_dv_pen: "existing",
  pad_kind: "existing",
  fan_elec: "in_place",
  fan_duct: "reuse",
  fan_switch: "existing_switch",
  fan_switch_add: "no",
};

/** Condensate / pan: parent gravity/pump beats job path — always Suggest reconnect. */
const PARENT_RECONNECT_QUESTIONS = new Set([
  "ah_cond_path",
  "furn_cond_path",
  "wh_tl_cond_path",
  "wh_pan_drain",
]);

/** Suggested tap from Replace vs New. Every other choice stays on the list. */
export function suggestedNewPathChoice(
  questionId: string,
  options: { id: string }[],
  path: string | null | undefined,
  whJobType?: string | null,
  _scopeAnswers?: Record<string, unknown> | null,
): string | null {
  const ids = options.map((o) => o.id);
  const pick = (prefer: string | undefined, lead: Set<string>) => {
    if (prefer && ids.includes(prefer)) return prefer;
    const hit = options.find((o) => lead.has(o.id));
    return hit?.id || null;
  };
  if (PARENT_RECONNECT_QUESTIONS.has(questionId)) {
    if (isRedoUtilitiesJob(whJobType)) {
      if (ids.includes("new") || ids.includes("new_extend")) {
        return ids.includes("new") ? "new" : "new_extend";
      }
      return pick(NEW_DEFAULT_BY_QUESTION[questionId], NEW_LEAD_IDS);
    }
    if (ids.includes("reconnect")) return "reconnect";
    return pick(undefined, REPLACE_LEAD_IDS);
  }
  if (isContractorPath(path)) {
    if (ids.includes("by_others")) return "by_others";
    return pick(NEW_DEFAULT_BY_QUESTION[questionId], NEW_LEAD_IDS);
  }
  if (isNewSystemPath(path, whJobType)) {
    return pick(NEW_DEFAULT_BY_QUESTION[questionId], NEW_LEAD_IDS);
  }
  if (isReplaceSystemPath(path, whJobType)) {
    return pick(REPLACE_DEFAULT_BY_QUESTION[questionId], REPLACE_LEAD_IDS);
  }
  return null;
}

const HIDDEN_LEFTOVER_CHOICE_IDS = new Set([
  "alter_5",
  "existing_5",
  "existing_10",
  "alter_2",
]);

/** Lead with the job-path answer. Never hide the other lane. */
export function filterJobPathOptions<T extends { id: string }>(
  questionId: string,
  options: T[],
  path: string | null | undefined,
  whJobType?: string | null,
): T[] {
  options = options.filter((o) => !HIDDEN_LEFTOVER_CHOICE_IDS.has(o.id));
  if (PARENT_RECONNECT_QUESTIONS.has(questionId)) {
    if (isRedoUtilitiesJob(whJobType)) {
      const score = (id: string) => {
        if (id === "new" || id === "new_extend") return 0;
        if (id === "not_applicable" || id === "by_others" || id === "receptor")
          return 2;
        if (id === "reconnect") return 3;
        return 1;
      };
      return [...options].sort((a, b) => score(a.id) - score(b.id));
    }
    const score = (id: string) => {
      if (id === "reconnect") return 0;
      if (id === "not_applicable" || id === "by_others" || id === "receptor")
        return 2;
      if (NEW_LEAD_IDS.has(id)) return 3;
      return 1;
    };
    return [...options].sort((a, b) => score(a.id) - score(b.id));
  }
  const isNew = isNewSystemPath(path, whJobType);
  const isReplace = isReplaceSystemPath(path, whJobType);
  const isContractor = isContractorPath(path);
  const alwaysNewFirst =
    questionId === "line_set" ||
    questionId === "pad_base" ||
    questionId === "pad_kind" ||
    questionId === "elec_path" ||
    (questionId === "wh_water_lines" && isRedoUtilitiesJob(whJobType)) ||
    /^ms_h\d+_run$/.test(questionId);
  if (!isNew && !isReplace && !alwaysNewFirst) return options;
  const lead = alwaysNewFirst || isNew ? NEW_LEAD_IDS : REPLACE_LEAD_IDS;
  const trail = alwaysNewFirst || isNew ? REPLACE_LEAD_IDS : NEW_LEAD_IDS;
  const score = (id: string) => {
    if (isContractor && id === "by_others") return 0;
    if (lead.has(id)) return 0;
    if (id === "not_applicable" || id === "by_others") return 2;
    if (trail.has(id)) return 3;
    return 1;
  };
  return [...options].sort((a, b) => score(a.id) - score(b.id));
}

/** Off-path choice — still tappable, just not the lead. */
export function isOffPathChoice(
  optionId: string,
  _questionId: string,
  path: string | null | undefined,
  whJobType?: string | null,
): boolean {
  if (isNewSystemPath(path, whJobType) && REPLACE_LEAD_IDS.has(optionId))
    return true;
  if (isReplaceSystemPath(path, whJobType) && NEW_LEAD_IDS.has(optionId))
    return true;
  return false;
}