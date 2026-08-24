/**
 * Demo is its own step — not buried in the product quiz.
 * “Are we demoing any equipment?” works on new location, replace, or abandon-and-cut-in.
 */
import type { MeasureFamilyId, MeasureInstance } from "./quote-wizard";
import type { ScopeAnswers } from "./scope-wizard";

export type DemoAnyId = "yes" | "yes_patch" | "both" | "by_others" | "no";

export const DEMO_ANY_FAMILIES: MeasureFamilyId[] = [
  "wall_heater",
  "water_heater",
  "air_handler",
  "furnace",
  "heat_pump",
  "ac",
  "ductless",
];

export function familyNeedsDemoStep(familyId: string | undefined): boolean {
  return DEMO_ANY_FAMILIES.includes(familyId as MeasureFamilyId);
}

export function demoQuestionId(familyId: string): string {
  if (familyId === "wall_heater") return "wall_demo";
  if (familyId === "water_heater") return "wh_demo";
  if (familyId === "air_handler") return "ah_demo";
  if (familyId === "furnace") return "furn_demo";
  return "demo_outdoor";
}

export function demoAnyHiddenQuestionIds(familyId: string): Set<string> {
  const s = new Set([demoQuestionId(familyId)]);
  const pull = demoPullQuestionId(familyId);
  if (pull) s.add(pull);
  if (familyId === "ductless") {
    s.add("ms_demo_gas");
    s.add("ms_demo_apps");
  }
  if (familyId === "water_heater") s.add("wh_demo_patch");
  if (familyId === "wall_heater") s.add("wall_demo_patch");
  if (familyId === "furnace") s.add("furn_demo_pull");
  if (familyId === "air_handler") s.add("ah_demo_pull");
  return s;
}

export const DEMO_ANY_OPTIONS: {
  id: DemoAnyId;
  label: string;
  blurb: string;
}[] = [
  { id: "yes", label: "Yes — pull it", blurb: "We take the old equipment out" },
  {
    id: "yes_patch",
    label: "Yes — pull and patch",
    blurb: "Opening + rough patch",
  },
  { id: "by_others", label: "Removal by others", blurb: "We don’t pull it" },
  { id: "no", label: "No demo", blurb: "Nothing coming out" },
];

export const DEMO_DUCTLESS_OPTIONS: {
  id: DemoAnyId;
  label: string;
  blurb: string;
}[] = [
  {
    id: "yes",
    label: "Existing mini-split",
    blurb: "Outdoor + heads coming out",
  },
  {
    id: "yes_patch",
    label: "Old gas appliances",
    blurb: "Wall / floor heaters · patch",
  },
  {
    id: "both",
    label: "Both",
    blurb: "Mini-split and old gas heat",
  },
  { id: "by_others", label: "Removal by others", blurb: "We don’t pull it" },
  { id: "no", label: "No demo", blurb: "Nothing coming out" },
];

export function resolveDemoJobPath(
  path: string | null | undefined,
  scope?: Record<string, unknown> | null,
  whJobType?: string | null,
): { isNew: boolean; isReplace: boolean } {
  const fromScope = String(
    path || scope?.job_path || scope?.install_type || "",
  );
  const isNew =
    fromScope === "new_location" ||
    fromScope === "new" ||
    fromScope === "cut_in_new" ||
    whJobType === "all_new";
  const isReplace =
    fromScope === "replace" ||
    fromScope === "replace_existing" ||
    whJobType === "like_for_like";
  return { isNew, isReplace };
}

/** Order demo choices from job path. Never hide an option. */
export function orderDemoOptions<T extends { id: DemoAnyId }>(
  options: T[],
  path: string | null | undefined,
  whJobType?: string | null,
  scope?: Record<string, unknown> | null,
): T[] {
  const { isNew, isReplace } = resolveDemoJobPath(path, scope, whJobType);
  if (!isNew && !isReplace) return options;
  const score = (id: string) => {
    if (isNew) {
      if (id === "no") return 0;
      if (id === "by_others") return 1;
      return 2;
    }
    if (id === "yes" || id === "yes_patch") return 0;
    if (id === "both") return 1;
    if (id === "by_others") return 2;
    return 3;
  };
  return [...options].sort((a, b) => score(a.id) - score(b.id));
}

/** Suggested demo tap from path. */
export function suggestedDemoChoice(
  options: { id: DemoAnyId }[],
  path: string | null | undefined,
  whJobType?: string | null,
  scope?: Record<string, unknown> | null,
): DemoAnyId | null {
  const ids = new Set(options.map((o) => o.id));
  const { isNew, isReplace } = resolveDemoJobPath(path, scope, whJobType);
  if (isNew && ids.has("no")) return "no";
  if (isReplace) {
    if (ids.has("yes")) return "yes";
    if (ids.has("yes_patch")) return "yes_patch";
  }
  return null;
}

export function demoPrompt(familyId: string): string {
  switch (familyId) {
    case "wall_heater":
      return "Old wall heater to remove?";
    case "water_heater":
      return "Old water heater to remove?";
    case "air_handler":
      return "Old furnace or air handler to remove?";
    case "furnace":
      return "Old furnace to remove?";
    case "heat_pump":
      return "Old outdoor unit to remove?";
    case "ac":
      return "Old outdoor unit to remove?";
    case "ductless":
      return "What old equipment is coming out?";
    default:
      return "Any old equipment to remove?";
  }
}

export function demoHelp(familyId: string): string {
  switch (familyId) {
    case "wall_heater":
      return "Patch is extra if the new heater is on another wall.";
    case "water_heater":
      return "Even if the new tank goes somewhere else.";
    case "air_handler":
      return "The FAU or coil coming out of this space.";
    case "furnace":
      return "The old furnace — even if the new one moves.";
    case "heat_pump":
    case "ac":
      return "This outdoor. Indoor is its own measure.";
    case "ductless":
      return "Mini-split, old gas heat, or both.";
    default:
      return "Old equipment coming out of this sit.";
  }
}

export function demoPullQuestionId(familyId: string): string | null {
  if (familyId === "wall_heater") return "wall_demo_pull";
  if (familyId === "water_heater") return "wh_demo_pull";
  if (familyId === "air_handler") return "ah_demo_pull";
  if (familyId === "furnace") return "furn_demo_pull";
  if (
    familyId === "heat_pump" ||
    familyId === "ac" ||
    familyId === "ductless"
  )
    return "demo_pull";
  return null;
}

export function demoPullOptions(familyId: string): { id: string; label: string }[] {
  if (familyId === "air_handler") {
    return [
      { id: "a_easy", label: "Easy · 1 tech" },
      { id: "b_1tech", label: "Typical · 1 tech" },
      { id: "c_2easy", label: "Stairs or 2 techs" },
      { id: "d_2attic", label: "Attic / gravity" },
      { id: "e_2hard", label: "Hard path" },
    ];
  }
  if (familyId === "wall_heater") {
    return [
      { id: "1_good", label: "1 tech · easy" },
      { id: "1_hard", label: "1 tech · hard" },
      { id: "2_good", label: "2 techs · typical" },
      { id: "2_hard", label: "2 techs · hard" },
    ];
  }
  if (familyId === "water_heater") {
    return [
      { id: "easy", label: "Easy" },
      { id: "typical", label: "Typical" },
      { id: "two_tech", label: "2 techs" },
      { id: "hard", label: "Hard" },
      { id: "attic", label: "Attic / tight" },
    ];
  }
  if (familyId === "furnace") {
    return [
      { id: "easy", label: "Easy" },
      { id: "typical", label: "Typical" },
      { id: "hard", label: "Hard" },
    ];
  }
  return [
    { id: "a_easy", label: "1 tech · ground · open" },
    { id: "b_1long", label: "1 tech · longer carry" },
    { id: "c_2easy", label: "2 techs · stairs or tight gate" },
    { id: "d_2hard", label: "2 techs · hard path / hoist" },
    { id: "roof", label: "Roof / elevated — two people" },
  ];
}

export function demoAppsMissing(inst: MeasureInstance): boolean {
  if (inst.familyId !== "ductless") return false;
  const any = demoAnyFromScope(inst);
  if (any !== "yes_patch" && any !== "both") return false;
  const apps = inst.scopeAnswers?.ms_demo_apps;
  if (!Array.isArray(apps) || apps.length === 0) return true;
  return inst.scopeAnswers?.ms_demo_apps_closed !== true;
}

export function demoIsSet(inst: MeasureInstance): boolean {
  const id = demoQuestionId(inst.familyId);
  const raw = String(inst.scopeAnswers?.[id] || "").trim();
  if (!raw) return false;
  const any = demoAnyFromScope({ ...inst, scopeAnswers: inst.scopeAnswers });
  if (any === "yes" || any === "yes_patch" || any === "both") {
    const pullId = demoPullQuestionId(inst.familyId);
    if (pullId && !String(inst.scopeAnswers?.[pullId] || "").trim())
      return false;
    if (demoAppsMissing(inst)) return false;
  }
  return true;
}

export function demoAnyFromScope(inst: MeasureInstance): DemoAnyId | null {
  const family = inst.familyId;
  const raw = String(inst.scopeAnswers?.[demoQuestionId(family)] || "");
  if (!raw) return null;
  if (family === "ductless") {
    const gas = String(inst.scopeAnswers?.ms_demo_gas || "");
    if (raw === "demo_ms" && gas === "yes") return "both";
    if (raw === "not_applicable" && gas === "yes") return "yes_patch";
    if (raw === "demo_ms" || raw === "demo_hp") return "yes";
    if (raw === "by_others") return "by_others";
    if (raw === "not_applicable") return "no";
  }
  if (raw === "not_applicable") return "no";
  if (raw === "by_others") return "by_others";
  if (raw === "demo_patch" || raw === "demo_other") return "yes_patch";
  if (
    raw === "demo" ||
    raw === "demo_hp" ||
    raw === "demo_ac" ||
    raw === "demo_ms" ||
    raw === "remove_fau"
  )
    return "yes";
  return "yes";
}

export function demoAnyLabel(inst: MeasureInstance): string {
  const id = demoAnyFromScope(inst);
  const opts =
    inst.familyId === "ductless" ? DEMO_DUCTLESS_OPTIONS : DEMO_ANY_OPTIONS;
  return opts.find((o) => o.id === id)?.label || "Demo";
}

export function applyDemoAny(
  inst: MeasureInstance,
  choice: DemoAnyId,
): Partial<MeasureInstance> {
  const next: ScopeAnswers = { ...(inst.scopeAnswers || {}) };
  const family = inst.familyId;

  delete next.wall_demo_pull;
  delete next.wall_demo_patch;
  delete next.wh_demo_pull;
  delete next.wh_demo_patch;
  delete next.wh_demo_gas;
  delete next.ah_demo_pull;
  delete next.ah_demo_other;
  delete next.ah_demo_floor;
  delete next.ah_demo_wall;
  delete next.ah_demo_elec;
  delete next.furn_demo;
  delete next.furn_demo_pull;
  delete next.demo_pull;
  delete next.demo_extra;
  delete next.ms_demo_gas;
  delete next.ms_demo_apps;

  if (family === "wall_heater") {
    next.wall_demo =
      choice === "yes"
        ? "demo"
        : choice === "yes_patch"
          ? "demo_patch"
          : choice === "by_others"
            ? "by_others"
            : "not_applicable";
  } else if (family === "water_heater") {
    next.wh_demo =
      choice === "yes"
        ? "demo"
        : choice === "yes_patch"
          ? "demo_patch"
          : choice === "by_others"
            ? "by_others"
            : "not_applicable";
    delete next.wh_demo_patch;
  } else if (family === "air_handler") {
    next.ah_demo =
      choice === "yes"
        ? "remove_fau"
        : choice === "yes_patch"
          ? "demo_other"
          : choice === "by_others"
            ? "by_others"
            : "not_applicable";
  } else if (family === "furnace") {
    next.furn_demo =
      choice === "yes"
        ? "demo"
        : choice === "yes_patch"
          ? "demo_patch"
          : choice === "by_others"
            ? "by_others"
            : "not_applicable";
  } else if (family === "ductless") {
    if (choice === "yes") {
      next.demo_outdoor = "demo_ms";
      next.ms_demo_gas = "no";
    } else if (choice === "yes_patch") {
      next.demo_outdoor = "not_applicable";
      next.ms_demo_gas = "yes";
    } else if (choice === "both") {
      next.demo_outdoor = "demo_ms";
      next.ms_demo_gas = "yes";
    } else if (choice === "by_others") {
      next.demo_outdoor = "by_others";
      next.ms_demo_gas = "by_others";
    } else {
      next.demo_outdoor = "not_applicable";
      next.ms_demo_gas = "not_applicable";
    }
  } else {
    next.demo_outdoor =
      choice === "no"
        ? "not_applicable"
        : choice === "by_others"
          ? "by_others"
          : family === "ac"
            ? "demo_ac"
            : "demo_hp";
  }

  return { scopeAnswers: next };
}
