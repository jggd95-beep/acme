/**
 * Measure scope-question framework.
 *
 * Comfort advisors answer site questions; we compile:
 *  - customer-facing work-scope lines
 *  - labor / material deltas (additive only — never cuts base equipment price)
 *
 * Voice (every measure):
 *  - Prompt: one line, Where / How / What. Advisor-facing. Same grammar every time.
 *  - Options: short, parallel. The choice first, not a sentence.
 *  - Help: one sentence, only if it changes the bid.
 *  - Scope: customer "we" voice. One action per line. Same writer.
 */
import {
  linearRunComplete,
  linearRunSummary,
  priceLinearRun,
  lineSetCoverFeet,
  LINE_SET_COVER_SCOPE,
  LINE_SET_COVER_BENEFIT,
  type LinearFamily,
  type LinearRunValue,
  ampToGauge,
} from "./linear-run";
import {
  DEFAULT_LABOR_DIVISOR,
  DEFAULT_LABOR_RATE,
  DEFAULT_MATERIAL_DIVISOR,
} from "./pricing";
import { resolveMeasureSellPrice } from "./domain/pricing-pipeline";
import { abandonById } from "./abandon-demo";
import { ductlessIndoorUnitName } from "./ductless-materials";
import { zoningScope } from "./zoning-scope";
import { reasonFromId } from "./ask-voice";

export type DemoExtraItem = {
  id: string;
  kind: "demo_hp" | "demo_ac";
  pull: "easy" | "typical" | "hard" | "roof";
};

export type GasAppDemoItem = {
  id: string;
  kind?: "wall_single" | "wall_double" | "floor" | "other";
  scenarioId?: string;
  patch: "none" | "drywall" | "plaster" | "others";
};

export type ScopeAnswerValue =
  | string
  | string[]
  | boolean
  | number
  | LinearRunValue
  | DemoExtraItem[]
  | GasAppDemoItem[]
  | null
  | undefined;

export type ScopeAnswers = Record<string, ScopeAnswerValue>;

export type ScopeWhen =
  | { questionId: string; equals: string | boolean | number }
  | { questionId: string; notEquals: string | boolean | number }
  | { questionId: string; oneOf: Array<string | boolean | number> }
  | { questionId: string; includes: string }
  | { questionId: string; isTrue: true }
  | { questionId: string; isFalse: true }
  | { any: ScopeWhen[] };

export type ScopeChoice = {
  id: string;
  label: string;
  scopeLines?: string[];
  benefitLines?: string[];
  note?: string;
  laborHours?: number;
  materialCost?: number;
  art?: string;
  /** Grayed out — visible but not selectable (4-way cassette). */
  disabled?: boolean;
  /** 0 = no customer packet text for this choice. */
  texts?: number;
};

export type ScopeQuestion = {
  id: string;
  prompt: string;
  help?: string;
  type: "boolean" | "single" | "multi" | "text" | "number" | "linear_run" | "count" | "repeat" | "gas_app_repeat";
  options?: ScopeChoice[];
  when?: ScopeWhen | ScopeWhen[];
  required?: boolean;
  hidden?: boolean;
  placeholder?: string;
  laborHours?: number;
  materialCost?: number;
  unitLabel?: string;
  countMin?: number;
  countMax?: number;
  countStep?: number;
  scopeLines?: string[];
  linearFamily?: LinearFamily;
  /** Optional field-code sheet (Type-B / draft hood). */
  info?: "bvent" | "tp";
  /** 0 = no customer packet text for this question. */
  texts?: number;
};

export type ScopeQuestionnaire = {
  id: string;
  familyIds: string[];
  title: string;
  blurb: string;
  questions: ScopeQuestion[];
  source?: "builtin" | "custom";
};

export type CompiledScope = {
  questionnaireId: string | null;
  complete: boolean;
  missingRequired: string[];
  scopeLines: string[];
  benefitLines: string[];
  extraLaborHours: number;
  extraMaterialCost: number;
  extraSellEstimate: number;
  summary: string[];
};

export type CompileCtx = {
  isHybrid?: boolean;
  circuit?: {
    volts?: string;
    ampId?: string;
    label?: string;
    breakerAmps?: number;
  } | null;
  /** Only these question ids contribute (accessory option pricing). */
  onlyIds?: Set<string> | string[];
  /** Skip these (offered accessory follow-ups stay off the sold line). */
  excludeIds?: Set<string> | string[];
};

const JOB_BLOCK_START = "--- Job conditions (from site questions) ---";
const JOB_BLOCK_RE =
  /\n*--- Job conditions \(from site questions\) ---[\s\S]*$/i;

export function stripJobConditionsBlock(scope: string): string {
  return (scope || "").replace(JOB_BLOCK_RE, "").trim();
}

export function mergeJobConditionsBlock(
  baseScope: string,
  compiledLines: string[],
): string {
  const base = stripJobConditionsBlock(baseScope);
  if (!compiledLines.length) return base;
  const body = compiledLines
    .map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.)]\s*/, "").trim()}`)
    .join("\n");
  return (base ? base + "\n\n" : "") + JOB_BLOCK_START + "\n" + body;
}

export function applyCompiledScopeToWorkScope(
  baseWorkScope: string,
  compiled: CompiledScope,
): string {
  return mergeJobConditionsBlock(baseWorkScope, compiled.scopeLines);
}

export function applyCompiledBenefits(
  existing: string[] | undefined,
  compiled: CompiledScope,
): string[] {
  const out = [...(existing || [])];
  const seen = new Set(out.map((l) => l.trim().toLowerCase()));
  for (const line of compiled.benefitLines || []) {
    const k = line.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(line);
  }
  return out;
}

function answerHas(v: unknown, target: string | boolean | number): boolean {
  if (Array.isArray(v)) return v.map(String).includes(String(target));
  return v === target;
}

function whenMatches(rule: ScopeWhen, answers: ScopeAnswers): boolean {
  if ("any" in rule) return rule.any.some((r) => whenMatches(r, answers));
  const v = answers[rule.questionId];
  if ("equals" in rule) return answerHas(v, rule.equals);
  if ("notEquals" in rule) return !answerHas(v, rule.notEquals);
  if ("includes" in rule) return answerHas(v, rule.includes);
  if ("oneOf" in rule) {
    if (Array.isArray(v)) return v.some((x) => rule.oneOf.includes(x as never));
    return rule.oneOf.includes(v as never);
  }
  if ("isTrue" in rule) return v === true;
  if ("isFalse" in rule) return v === false;
  return true;
}

export function isQuestionVisible(
  q: ScopeQuestion,
  answers: ScopeAnswers,
): boolean {
  if (q.hidden) return false;
  if (!q.when) return true;
  const rules = Array.isArray(q.when) ? q.when : [q.when];
  return rules.every((r) => whenMatches(r, answers || {}));
}

export function isKeptScopeKey(
  key: string,
  quiz?: { questions?: Array<{ id: string; hidden?: boolean }> } | null,
): boolean {
  if (!key) return false;
  if (key.endsWith("_closed") || key.endsWith("_done")) return true;
  const q = quiz?.questions?.find((qq) => qq.id === key);
  if (q?.hidden) return true;
  if (!q) return true;
  return false;
}

export function collapsePadScopeLines(lines: string[]): string[] {
  const isHaul = (l: string) =>
    /break out|haul away the existing pad|wheelbarrow|through the house|around the house/i.test(
      l,
    );
  const isPadSet = (l: string) =>
    !isHaul(l) &&
    /preformed|equipment pad|custom concrete pad|existing pad|secure the (outdoor )?unit to the pad|set (the new )?outdoor (unit|heat pump|condenser)|set outdoor (heat pump|condenser)/i.test(
      l,
    );
  const pads = lines.filter(isPadSet);
  if (pads.length <= 1) return lines;
  const keep =
    pads.find((l) => /secur/i.test(l)) ||
    [...pads].sort((a, b) => b.length - a.length)[0];
  let placed = false;
  const out: string[] = [];
  for (const l of lines) {
    if (!isPadSet(l)) {
      out.push(l);
      continue;
    }
    if (!placed) {
      out.push(keep);
      placed = true;
    }
  }
  return out;
}

export function isPlacementScopeQuestion(q: {
  id: string;
  prompt: string;
}): boolean {
  const id = q.id || "";
  const prompt = q.prompt || "";
  if (/(^|_)location$/i.test(id) || /placement/i.test(id)) return true;
  return /\blocation\b|\bplacement\b|where will/i.test(prompt);
}

export const WH_TANK_KIT_PARENT_IDS = [
  "wh_drain_pan",
  "wh_stand",
  "wh_expansion",
  "wh_prefilter",
] as const;

export function isWhTankKitId(id: string): boolean {
  return (WH_TANK_KIT_PARENT_IDS as readonly string[]).includes(id);
}

export function familyUsesWhTankKit(
  familyId: string,
  style?: string | null,
): boolean {
  if (familyId !== "water_heater") return false;
  return style !== "tankless";
}

export const ATTIC_ACCESS_QUESTIONS: ScopeQuestion[] = [
  {
    id: "attic_hatch_active",
    prompt: "Attic hatch on this job?",
    type: "single",
    required: false,
    hidden: true,
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  {
    id: "attic_ladder_active",
    prompt: "Pull-down ladder on this job?",
    type: "single",
    required: false,
    hidden: true,
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  {
    id: "attic_hatch_work",
    prompt: "How do we make the hatch?",
    type: "single",
    required: true,
    when: { questionId: "attic_hatch_active", equals: "yes" },
    options: [
      {
        id: "enlarge",
        label: "Enlarge existing",
        note: "Then difficulty",
        laborHours: 2.5,
        materialCost: 95,
        scopeLines: ["Enlarge existing attic access to meet code and this equipment."],
      },
      {
        id: "cut_in",
        label: "Cut new access",
        note: "Then difficulty",
        laborHours: 4,
        materialCost: 180,
        scopeLines: ["Cut in a new attic access sized for this equipment and code."],
      },
      {
        id: "by_others",
        label: "By others",
        scopeLines: ["Attic access by others before install."],
      },
    ],
  },
  {
    id: "attic_hatch_diff",
    prompt: "How hard is the hatch work?",
    type: "single",
    required: true,
    when: { questionId: "attic_hatch_work", oneOf: ["enlarge", "cut_in"] },
    options: [
      { id: "easy", label: "Easy" },
      { id: "med", label: "Medium", laborHours: 0.5 },
      { id: "hard", label: "Hard", laborHours: 1.25 },
    ],
  },
  {
    id: "attic_hatch_finish",
    prompt: "Who finishes the hatch?",
    type: "single",
    required: true,
    when: { questionId: "attic_hatch_work", oneOf: ["enlarge", "cut_in"] },
    options: [
      {
        id: "others",
        label: "By others — door / trim / paint",
        scopeLines: [
          "Attic hatch framed by Acme. Door, trim, texture, and paint by others.",
        ],
      },
      {
        id: "door",
        label: "Acme door and trim · paint by others",
        laborHours: 1.5,
        materialCost: 220,
        scopeLines: [
          "Attic hatch includes door and trim. Painting by others.",
        ],
      },
      {
        id: "paint",
        label: "Acme door, trim, and paint",
        laborHours: 2.25,
        materialCost: 280,
        scopeLines: [
          "Attic hatch includes door, trim, and paint as needed.",
        ],
      },
    ],
  },
  {
    id: "attic_ladder_frame",
    prompt: "Do we need to cut joists or frame the opening?",
    type: "single",
    required: true,
    when: { questionId: "attic_ladder_active", equals: "yes" },
    options: [
      { id: "no", label: "Opening is already framed" },
      {
        id: "joist",
        label: "Cut a joist and header it",
        laborHours: 1.5,
        materialCost: 85,
        scopeLines: ["Cut and header the joists for the pull-down ladder opening."],
      },
      {
        id: "frame",
        label: "Frame a new opening",
        laborHours: 2,
        materialCost: 110,
        scopeLines: ["Frame a new opening for the pull-down attic ladder."],
      },
    ],
  },
  {
    id: "attic_ladder_diff",
    prompt: "How hard is this pull-down?",
    type: "single",
    required: true,
    when: { questionId: "attic_ladder_active", equals: "yes" },
    options: [
      { id: "easy", label: "Easy" },
      { id: "med", label: "Medium", laborHours: 0.75 },
      {
        id: "hard",
        label: "Hard · damage risk",
        laborHours: 1.75,
        materialCost: 40,
      },
    ],
  },
  {
    id: "attic_sec_pan",
    prompt: "Secondary drain pan in the attic?",
    help: "Install books require a secondary pan under attic equipment. The pan does not have to drain if a float switch shuts the unit off.",
    type: "single",
    required: true,
    options: [
      {
        id: "new_float",
        label: "New pan + float switch (shuts the unit off)",
        note: "Pan does not have to drain",
        laborHours: 0.85,
        materialCost: 95,
        scopeLines: [
          "Install a secondary drain pan under this attic equipment with a float switch that shuts the system down if the pan fills. The pan does not have to drain.",
        ],
      },
      {
        id: "exist_float",
        label: "Existing pan is sound — verify / add float",
        laborHours: 0.35,
        materialCost: 45,
        scopeLines: [
          "Keep the existing attic secondary drain pan after confirming it is sound, and install or verify a float switch that shuts the system down if the pan fills.",
        ],
      },
    ],
  },
];

export const ELEC_PANEL_Q_IDS = [
  "elec_panel_room",
  "elec_closet",
  "elec_panel_brand",
  "elec_panel_wall",
] as const;

export function jobHasHybridHeat(answers: {
  measureInstances?: Array<{
    familyId?: string;
    waterHeaterStyle?: string | null;
  }>;
} | null | undefined): boolean {
  return Boolean(
    answers?.measureInstances?.some(
      (i) => i.familyId === "water_heater" && i.waterHeaterStyle === "hybrid",
    ),
  );
}

function measureClose(
  familyId: string,
  isHybrid?: boolean,
  answers?: ScopeAnswers,
): { scopeLines: string[]; laborHours: number; materialCost: number } {
  if (isHybrid && (familyId === "heat_pump" || familyId === "furnace")) {
    return {
      scopeLines: [
        "Check, test, and adjust the hybrid heat pump / furnace system for proper operation.",
      ],
      laborHours: 0.5,
      materialCost: 1,
    };
  }
  const lines: Record<string, string | string[]> = {
    heat_pump:
      "Check, test, and adjust the new heat pump system for proper operation.",
    ac: "Check, test, and adjust the new air conditioning system for proper operation.",
    furnace: "Check, test, and adjust the new furnace for proper operation.",
    water_heater:
      answers?.wh_style === "hybrid"
        ? "Check, test, adjust, and start the new heat pump water heater. Confirm proper operation."
        : "Check, test, adjust, and start the new water heater. Confirm proper operation.",
    air_handler:
      "Check, test, and adjust the new air handler for proper operation.",
    wall_heater:
      "Check, test, and adjust the new wall heater for proper operation.",
    ductless: "Check, test, and start the new ductless system.",
    bath_fan:
      "Check, test, and start the new bath fan for proper operation.",
    ductwork:
      answers?.duct_plan === "tune"
        ? []
        : answers?.duct_plan === "reconnect" || answers?.duct_plan === "meets"
          ? "Seal new connections at the equipment and start the system."
          : "Confirm airflow at the equipment and at the rooms we touched, then start and check the system.",
    electrical:
      "Check, test, and energize. Confirm the breaker, connections, and device operate as intended.",
    package_unit:
      "Check, test, and start the package unit. Confirm heating, cooling, and clearances before we leave.",
  };
  const line = lines[familyId];
  if (!line) return { scopeLines: [], laborHours: 0, materialCost: 0 };
  return {
    scopeLines: Array.isArray(line) ? line : [line],
    laborHours: 0.25,
    materialCost: 0,
  };
}

const lineSetQuestions: ScopeQuestion[] = [
  {
    id: "line_set",
    prompt: "Reuse the existing line set, or run a new one?",
    type: "single",
    required: true,
    options: [
      {
        id: "reuse_path",
        label: "Reuse the existing line set",
        scopeLines: [
          "Reuse the existing line set where it is sound. New insulation and seals as needed.",
            "Acme does not warranty existing infrastructure — line set, copper, insulation, or interconnect wiring. Warranty covers new equipment and the work performed this visit.",
        ],
      },
      {
        id: "new_path",
        label: "Run a new line set",
        note: "Then length, difficulty, cover, and holes",
        scopeLines: [
          "Run a new line set for the refrigerant lines, sealed at each wall.",
        ],
        laborHours: 2.5,
        materialCost: 175,
      },
    ],
  },
  {
    id: "line_set_diff",
    prompt: "How hard is that new path?",
    type: "single",
    required: false,
    hidden: true,
    when: { questionId: "line_set", oneOf: ["new_path", "new"] },
    options: [
      { id: "easy", label: "Typical — open chase or short exterior", laborHours: 0 },
      { id: "typical", label: "A little tight", laborHours: 0.5 },
      {
        id: "hard",
        label: "Hard — tight attic, stairs, or long pull",
        laborHours: 1.25,
      },
      {
        id: "very",
        label: "Very hard — packed, heat, or multiple turns",
        laborHours: 2.25,
      },
    ],
  },
  {
    id: "line_set_roll",
    prompt: "Which line set?",
    help: "30, 50, 80, or 100 foot line set.",
    type: "single",
    required: false,
    hidden: true,
    when: { questionId: "line_set", oneOf: ["new_path", "new"] },
    options: [
      { id: "30", label: "30 ft", materialCost: 0 },
      { id: "50", label: "50 ft", materialCost: 85 },
      { id: "80", label: "80 ft", materialCost: 165 },
      { id: "100", label: "100 ft", materialCost: 240 },
    ],
  },
  {
    id: "line_set_run",
    prompt: "Line-set length and holes?",
    help: "Slide access. Cover at 0 = none. Holes at the bottom. Sold line set is rounded up.",
    type: "linear_run",
    linearFamily: "line_set",
    required: true,
    when: { questionId: "line_set", oneOf: ["new_path", "new"] },
  },
  {
    id: "line_set_pen",
    prompt: "What does the line set go through?",
    help: "Tap every wall type. Stay here until you’re done — quantity is next. This stays off the contract.",
    type: "multi",
    required: false,
    hidden: true,
    when: { questionId: "line_set", oneOf: ["new_path", "new"] },
    options: [
      { id: "none", label: "No new hole" },
      { id: "wood", label: "Wood / siding" },
      { id: "stucco", label: "Stucco" },
      { id: "brick", label: "Brick / tile" },
    ],
  },
  {
    id: "line_set_pen_qty_wood",
    prompt: "How many wood / siding holes?",
    type: "count",
    required: false,
    hidden: true,
    unitLabel: "wood holes",
    countMin: 1,
    countMax: 6,
    laborHours: 0.25,
    materialCost: 12,
    when: { questionId: "line_set_pen", oneOf: ["wood"] },
  },
  {
    id: "line_set_pen_qty_stucco",
    prompt: "How many stucco holes?",
    type: "count",
    required: false,
    hidden: true,
    unitLabel: "stucco holes",
    countMin: 1,
    countMax: 6,
    laborHours: 0.5,
    materialCost: 18,
    when: { questionId: "line_set_pen", oneOf: ["stucco"] },
  },
  {
    id: "line_set_pen_qty_brick",
    prompt: "How many brick / tile holes?",
    type: "count",
    required: false,
    hidden: true,
    unitLabel: "brick holes",
    countMin: 1,
    countMax: 6,
    laborHours: 0.75,
    materialCost: 24,
    when: { questionId: "line_set_pen", oneOf: ["brick"] },
  },
];

const controlWireQuestions: ScopeQuestion[] = [
  {
    id: "ctrl_wire",
    prompt: "What’s already there for control wire?",
    help: "Communicating and multi-stage often need more than two wires. If we reuse the line set and still have to pull new wire, that’s extra work.",
    type: "single",
    required: true,
    options: [
      {
        id: "enough",
        label: "Enough wires in place",
      },
      {
        id: "spare",
        label: "Extra unused wires we can use",
        laborHours: 0.15,
      },
      {
        id: "not_sure",
        label: "Not sure how many",
      },
      {
        id: "cover",
        label: "Run new wire in the existing line-set cover",
        laborHours: 0.65,
        materialCost: 22,
        scopeLines: [
          "Pull new control wire in the existing line-set cover and land it at the outdoor unit and the indoor control.",
        ],
      },
      {
        id: "exposed",
        label: "Run new wire exposed on the house",
        laborHours: 0.85,
        materialCost: 28,
        scopeLines: [
          "Run new control wire exposed on the exterior, secured and UV-protected, and land it at both ends.",
        ],
      },
      {
        id: "conduit",
        label: "Run new wire in exterior conduit",
        laborHours: 1.25,
        materialCost: 65,
        scopeLines: [
          "Run new control wire in exterior conduit and land it at the outdoor unit and the indoor control.",
        ],
      },
      {
        id: "inside",
        label: "Run new wire inside / open a chase",
        laborHours: 1.5,
        materialCost: 35,
        scopeLines: [
          "Run new control wire inside the structure (open a chase as needed) and land it at both ends.",
        ],
      },
    ],
  },
  {
    id: "ctrl_wire_count",
    prompt: "How many control wires are in place?",
    help: "Two wires is typical old AC. Communicating often needs more.",
    type: "single",
    required: true,
    when: { questionId: "ctrl_wire", oneOf: ["not_sure"] },
    options: [
      { id: "w2", label: "2 wires" },
      { id: "w3", label: "3 wires" },
      { id: "w4", label: "4 wires" },
      { id: "w5", label: "5 or more" },
    ],
  },
  {
    id: "ctrl_wire_run",
    prompt: "How far is the new control wire?",
    type: "linear_run",
    linearFamily: "thermostat",
    required: true,
    when: { questionId: "ctrl_wire", oneOf: ["cover", "exposed", "conduit", "inside"] },
  },
];

const outdoorDemoQuestions: ScopeQuestion[] = [
  {
    id: "demo_outdoor",
    prompt: "Old outdoor unit to remove?",
    type: "single",
    required: true,
    options: [
      { id: "not_applicable", label: "Nothing — new install" },
      {
        id: "demo_hp",
        label: "Existing heat pump",
        scopeLines: [
          "Recover the refrigerant to EPA requirements, then remove your existing outdoor unit, haul it away, and recycle it.",
        ],
      },
      {
        id: "demo_ac",
        label: "Existing air conditioner",
        scopeLines: [
          "Recover the refrigerant to EPA requirements, then remove your existing air conditioner, haul it away, and recycle it.",
        ],
      },
      {
        id: "by_others",
        label: "Removal by others",
        scopeLines: ["Removal of existing outdoor equipment by others."],
      },
    ],
  },
  {
    id: "demo_pull",
    prompt: "How hard to remove?",
    type: "single",
    required: true,
    when: { questionId: "demo_outdoor", oneOf: ["demo_hp", "demo_ac"] },
    options: [
      { id: "a_easy", label: "1 tech · ground · open path", laborHours: 0.5 },
      { id: "b_1long", label: "1 tech · longer carry", laborHours: 0.85 },
      { id: "c_2easy", label: "2 techs · stairs or tight gate", laborHours: 1.5 },
      { id: "d_2hard", label: "2 techs · hard path / hoist", laborHours: 2.25 },
      { id: "roof", label: "Roof / elevated — two people", laborHours: 2.5 },
    ],
  },
];

const outdoorSetQuestions: ScopeQuestion[] = [
  {
    id: "outdoor_set",
    prompt: "How do we set the new heat pump?",
    help: "Pick the crew that matches the path in. These units often take two people.",
    type: "single",
    required: true,
    options: [
      { id: "a_easy", label: "1 tech · ground · open path", laborHours: 0 },
      { id: "b_1long", label: "1 tech · longer carry", laborHours: 0.35 },
      { id: "c_2easy", label: "2 techs · stairs, slope, or tight gate", laborHours: 0.85 },
      { id: "d_2hard", label: "2 techs · hoist or very tight", laborHours: 1.5 },
      { id: "roof", label: "Roof / elevated — two people", laborHours: 1.75 },
    ],
  },
];

const heatPumpScope: ScopeQuestionnaire = {
  id: "heat_pump_v1",
  familyIds: ["heat_pump"],
  title: "Heat pump site conditions",
  blurb: "Replace or new, then pad, set, line set. Electrical stays last.",
  source: "builtin",
  questions: [
    ...outdoorDemoQuestions,
    {
      id: "outdoor_location",
      prompt: "Where does this heat pump sit?",
      type: "single",
      required: true,
      hidden: true,
      options: [
        {
          id: "side_yard",
          label: "Side / rear of the house",
          scopeLines: [
            "Set the heat pump at the agreed side or rear of the home, level and secured to meet local code.",
          ],
        },
        {
          id: "front",
          label: "Front of the house",
          scopeLines: [
            "Set the heat pump at the front of the home, level and secured to meet local code.",
          ],
        },
        {
          id: "tight_access",
          label: "Tight access / long carry",
          laborHours: 1.5,
          scopeLines: [
            "Set the heat pump at the agreed spot. The path in is tight — we protect landscaping and hardscape.",
          ],
        },
        {
          id: "roof",
          label: "Roof / elevated mount",
          laborHours: 3,
          materialCost: 250,
          scopeLines: [
            "Set the heat pump on an approved roof or elevated mount, level and secured to meet local code.",
          ],
        },
      ],
    },
    ...outdoorSetQuestions,
    ...lineSetQuestions,
    ...controlWireQuestions,
  ],
};

const furnaceAccess: ScopeQuestionnaire = {
  id: "furnace_access_v1",
  familyIds: ["furnace"],
  title: "Furnace site conditions",
  blurb: "Access, vent, then the shared gas package.",
  source: "builtin",
  questions: [
    {
      id: "furn_demo",
      prompt: "Old furnace to remove?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        {
          id: "demo",
          label: "Demo existing furnace",
          scopeLines: [
            "Remove your existing furnace, haul it away, and recycle it.",
          ],
        },
        {
          id: "demo_patch",
          label: "Demo existing furnace · with patching",
          scopeLines: [
            "Remove your existing furnace, haul it away, and recycle it.",
          ],
        },
        {
          id: "by_others",
          label: "By others",
          scopeLines: ["By others, removal of existing furnace."],
        },
        { id: "not_applicable", label: "Not applicable" },
      ],
    },
    {
      id: "furn_demo_pull",
      prompt: "How hard to remove the furnace?",
      type: "single",
      required: true,
      when: { questionId: "furn_demo", oneOf: ["demo", "demo_patch"] },
      options: [
        { id: "easy", label: "Easy — open path", laborHours: 0.5 },
        { id: "typical", label: "Typical", laborHours: 1 },
        { id: "hard", label: "Hard — tight or stairs", laborHours: 2 },
      ],
    },
    {
      id: "equipment_access",
      prompt: "Will this furnace fit the path in?",
      type: "boolean",
      required: true,
    },
    {
      id: "access_location",
      prompt: "Where does this furnace sit?",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "attic", label: "Attic", scopeLines: ["Furnace is located in the attic; protect ceilings and walkways during changeout."] },
        { id: "crawl", label: "Crawl space", scopeLines: ["Furnace is located in the crawl space; work from proper access points."] },
        { id: "closet", label: "Interior closet / mechanical room", scopeLines: ["Furnace is in an interior mechanical closet; protect floors and finishes."] },
        { id: "garage", label: "Garage", scopeLines: ["Furnace is in the garage; maintain clearances and protect floors."] },
        { id: "other", label: "Other / mixed", scopeLines: ["Furnace location as confirmed on site with the homeowner."] },
      ],
    },
    {
      id: "access_solution",
      prompt: "How do we make a path for this furnace?",
      type: "single",
      required: true,
      when: { questionId: "equipment_access", isFalse: true },
      options: [
        { id: "cut_in_access", label: "Cut in new custom access (Acme HVAC)", laborHours: 4, materialCost: 180, scopeLines: ["Cut in a new custom access opening sized for safe equipment removal and install."] },
        { id: "cut_in_access_door_trim", label: "Cut in access with door & trim (painting by others)", laborHours: 6, materialCost: 420, scopeLines: ["Cut in a new custom access opening sized for equipment path.", "Install access door and trim; painting of door/trim/walls by others."] },
        { id: "owner_access_by_others", label: "Owner / others cut in access before install", scopeLines: ["Owner (or others) will provide equipment access before install day."] },
      ],
    },
    ...ATTIC_ACCESS_QUESTIONS,
    {
      id: "vent_flue",
      prompt: "Reuse the flue, or new?",
      type: "single",
      required: true,
      info: "bvent",
      options: [
        { id: "reuse_ok", label: "Reconnect to existing flue. I verified it meets current code", scopeLines: ["Reconnect furnace venting to the existing Type-B / draft system."] },
        { id: "new_vent", label: "New vent / liner / PVC as required", laborHours: 1, materialCost: 80, scopeLines: ["Install new venting (and combustion-air piping if required) per furnace listing and code."] },
        { id: "vent_by_others", label: "Vent work by others", scopeLines: ["Primary vent modifications by others; Acme HVAC makes final appliance connection."] },
      ],
    },
    {
      id: "vent_run",
      prompt: "How far is the PVC vent run?",
      help: "Condensing / 90%+ furnaces. 2-pipe or single PVC. Split stretches if height or access changes.",
      type: "linear_run",
      linearFamily: "pvc_vent",
      required: true,
      when: [
        { questionId: "vent_flue", equals: "new_vent" },
        { questionId: "furn_vent_kind", equals: "pvc" },
      ],
    },
    {
      id: "furn_bvent_run",
      prompt: "How far is the Type-B flue run?",
      help: "80% furnaces. Oval B-vent. Split stretches if access changes.",
      type: "linear_run",
      linearFamily: "bvent",
      required: true,
      when: [
        { questionId: "vent_flue", equals: "new_vent" },
        { questionId: "furn_vent_kind", equals: "bvent" },
      ],
    },
    {
      id: "furn_condensate",
      prompt: "How does condensate drain?",
      type: "single",
      required: true,
      when: { questionId: "furn_vent_kind", equals: "pvc" },
      options: [
        { id: "gravity", label: "Gravity drain" },
        { id: "pump", label: "Add condensate pump", laborHours: 1.25, materialCost: 185, scopeLines: ["Install condensate pump and discharge to approved location."] },
        { id: "by_others", label: "By others", scopeLines: ["Furnace condensate drain by others."] },
      ],
    },
    {
      id: "furn_cond_path",
      prompt: "Reconnect existing condensate, or new run?",
      help: "Replace jobs usually reconnect. New run only if the existing drain is wrong, missing, or we have to move it.",
      type: "single",
      required: true,
      when: { questionId: "furn_condensate", oneOf: ["gravity", "pump"] },
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing drain",
          laborHours: 0.2,
          scopeLines: [
            "Reconnect condensate to the existing drain after confirming slope and termination.",
          ],
        },
        {
          id: "new",
          label: "New condensate run",
          note: "Then length, access, and holes",
          laborHours: 0.35,
          scopeLines: [
            "Install new condensate drain, properly trapped and terminated.",
          ],
        },
      ],
    },
    {
      id: "furn_cond_run",
      prompt: "How far is the condensate pipe run?",
      type: "linear_run",
      linearFamily: "condensate",
      required: true,
      when: { questionId: "furn_cond_path", equals: "new" },
    },
    {
      id: "kit_media_filter",
      prompt: "What filter are we using?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "not_needed", label: "Not needed" },
        {
          id: "add",
          label: "Add media filter",
          laborHours: 0.35,
          scopeLines: [
            "Install new media air filter as specified on this system.",
          ],
        },
      ],
    },
  ],
};

const wallHeaterScope: ScopeQuestionnaire = {
  id: "wall_heater_v1",
  familyIds: ["wall_heater"],
  title: "Wall heater site conditions",
  blurb: "Path is seeded from the unit. Demo, install type, flue or DV, then gas. Rinnai gets electrical.",
  source: "builtin",
  questions: [
    {
      id: "wall_path",
      prompt: "Pick wall heater type",
      help: "Seeded from the equipment. Hidden in the advisor UI.",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "williams_lfl", label: "Williams · top-vent / LFL" },
        { id: "williams_dv", label: "Williams · direct vent" },
        { id: "rinnai_dv", label: "Rinnai · direct vent" },
      ],
    },
    {
      id: "install_type",
      prompt: "Replace in the same opening, or cut a new one?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "replace_existing", label: "Replace existing heater (same opening)", scopeLines: ["Install the new wall heater in the existing opening; match and seal the surround."] },
        { id: "cut_in_new", label: "Install new wall heater location", note: "Then kit type, attic, roof, and extra flue", scopeLines: ["Cut in a new wall opening for the wall heater per manufacturer template and framing requirements."] },
      ],
    },
    {
      id: "wall_sided",
      prompt: "Single or dual sided?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "single", label: "Single-sided" },
        { id: "dual", label: "Dual-sided" },
      ],
    },
    {
      id: "wall_demo",
      prompt: "Old wall heater to remove?",
      type: "single",
      required: true,
      options: [
        { id: "demo", label: "Demo existing heater", note: "Then how hard", scopeLines: ["Remove your existing wall heater, haul it away, and recycle it. Cap the gas and flue at that location."] },
        { id: "demo_patch", label: "Demo existing heater · with patching", note: "Then pull and patch", scopeLines: ["Remove your existing wall heater, haul it away, and recycle it. Cap the gas and flue at that location."] },
        { id: "by_others", label: "Removal by others", scopeLines: ["Removal of existing heater by others."] },
        { id: "not_applicable", label: "Not applicable — no demo" },
      ],
    },
    {
      id: "wall_demo_pull",
      prompt: "Dual-sided pull — one person or two?",
      type: "single",
      required: true,
      help: "Only dual-sided cabinets need a second person. Single-sided wall heaters are a one-person lift.",
      when: [
        { questionId: "wall_demo", oneOf: ["demo", "demo_patch"] },
        { questionId: "wall_sided", equals: "dual" },
      ],
      options: [
        { id: "1_good", label: "One person · open path", laborHours: 0.38 },
        { id: "1_hard", label: "One person · tight / stairs", laborHours: 0.63 },
        { id: "2_good", label: "Two people · dual-sided cabinet", laborHours: 1 },
        { id: "2_hard", label: "Two people · dual-sided · hard path", laborHours: 1.5 },
      ],
    },
    {
      id: "wall_demo_patch",
      prompt: "Who patches the wall?",
      type: "single",
      required: true,
      when: { questionId: "wall_demo", equals: "demo_patch" },
      options: [
        { id: "others", label: "Wall repairs by others", scopeLines: ["By others, proper wall repairs to meet code requirements."] },
        { id: "drywall", label: "Minor drywall patch · no paint / texture", materialCost: 19.11, laborHours: 0.25, scopeLines: ["Install rough wall patch as needed for new heater installation. By others, texture and painting if needed or to be priced out separately."] },
        { id: "plaster", label: "Minor lath & plaster patch · no paint / texture", materialCost: 25.48, laborHours: 0.5, scopeLines: ["Install rough wall patch as needed for new heater installation. By others, texture and painting if needed or to be priced out separately."] },
      ],
    },
    {
      id: "wall_new_type",
      prompt: "How do we install at the new location?",
      type: "single",
      required: true,
      when: { questionId: "install_type", equals: "cut_in_new" },
      options: [
        { id: "attic_crawl", label: "Attic · one floor with crawl space only", scopeLines: ["Install new wall heater at the discussed attic / one-floor crawl-space location."] },
        { id: "freestanding", label: "Free-standing kit (single-sided)", materialCost: 156.52, laborHours: 1, scopeLines: ["Install new Williams free standing wall heater kit to allow new heater to be installed at discussed location."] },
        { id: "flat_roof", label: "Flat roof (use free-standing kit)", materialCost: 156.52, laborHours: 1, scopeLines: ["Install new Williams free standing wall heater kit to allow new heater to be installed at discussed location."] },
        { id: "wood_panel", label: "Wood paneling (use free-standing kit)", materialCost: 156.52, laborHours: 1, scopeLines: ["Install new Williams free standing wall heater kit to allow new heater to be installed at discussed location."] },
        { id: "lath_plaster", label: "Lath & plaster (use free-standing kit)", materialCost: 156.52, laborHours: 1, scopeLines: ["Install new Williams free standing wall heater kit to allow new heater to be installed at discussed location."] },
      ],
    },
    {
      id: "wall_flue",
      prompt: "Reconnect, alter, or replace the existing LFL / Type-B flue?",
      type: "single",
      required: true,
      info: "bvent",
      when: [
        { questionId: "wall_path", equals: "williams_lfl" },
        { questionId: "install_type", equals: "replace_existing" },
      ],
      options: [
        { id: "verified", label: "Reconnect to existing — meets requirements", scopeLines: ["Connect new wall heater to existing type B exhaust system."] },
        { id: "connect", label: "Reconnect to existing — then how" },
        { id: "replace", label: "New flue — path meets code", note: "Then attic, extra feet, roof, upstairs", scopeLines: ["Replace existing wall heater flue where the path meets code."] },
        { id: "replace_flash", label: "New flue + cut in roof flashing", scopeLines: ["Replace existing wall heater flue and cut in new roof flashing."] },
        { id: "replace_asb", label: "New flue after asbestos (path meets code)", scopeLines: ["Replace existing flue after asbestos removal. Path confirmed to meet code."] },
        { id: "replace_asb_flash", label: "New flue after asbestos + roof flashing", scopeLines: ["Replace existing flue after asbestos removal and cut in new roof flashing."] },
      ],
    },
    {
      id: "wall_flue_connect",
      prompt: "Connect to the existing flue — how?",
      type: "single",
      required: true,
      when: { questionId: "wall_flue", equals: "connect" },
      options: [
        { id: "adj_easy", label: "Minor adjust / new cap · easy", materialCost: 46.87, laborHours: 0.5, scopeLines: ["Modify existing type B exhaust system to meet manufacturer specifications."] },
        { id: "adj_hard", label: "Minor adjust / new cap · hard", materialCost: 93.73, laborHours: 1, scopeLines: ["Modify existing type B exhaust system to meet manufacturer specifications."] },
        { id: "disclaimer", label: "Reconnect to existing flue · with disclaimer", scopeLines: ["Reconnect new wall heater to existing wall heater vent system."], benefitLines: ["Note: We could not verify the condition of the existing exhaust venting system because the flue is inaccessible. If we find the current flue does not meet manufacturer specifications, additional flue work will be required and priced separately."] },
        { id: "disclaimer_asb", label: "Reconnect to existing flue · asbestos disclaimer", scopeLines: ["Reconnect new wall heater to existing wall heater vent system."] },
        { id: "cap_easy_disc", label: "New cap · easy · with disclaimer", materialCost: 62.79, laborHours: 0.75, scopeLines: ["Modify existing type B exhaust system to meet manufacturer specifications."] },
        { id: "cap_hard_disc", label: "New cap · hard · with disclaimer", materialCost: 93.73, laborHours: 1, scopeLines: ["Modify existing type B exhaust system to meet manufacturer specifications."] },
      ],
    },
    {
      id: "wall_attic",
      prompt: "How hard is attic access for the flue?",
      type: "single",
      required: true,
      when: { any: [
        { questionId: "install_type", equals: "cut_in_new" },
        { questionId: "wall_flue", oneOf: ["replace", "replace_flash", "replace_asb", "replace_asb_flash"] },
      ] },
      options: [
        { id: "easy", label: "3'+ clearance · access within 10'", laborHours: 0.25, materialCost: 13.65 },
        { id: "typical", label: "3'+ clearance within 20' · or 2' clearance", laborHours: 0.5, materialCost: 13.65 },
        { id: "tight", label: "2'+ clearance within 20' · or 18\" clearance", laborHours: 0.75, materialCost: 13.65 },
        { id: "hard", label: "2'+ clearance · longer / tighter path", laborHours: 1, materialCost: 13.65 },
        { id: "very", label: "Very difficult attic", laborHours: 2, materialCost: 13.65 },
      ],
    },
    {
      id: "wall_flue_extra_ft",
      prompt: "Extra Type-B flue over 8 ft?",
      type: "linear_run",
      linearFamily: "bvent",
      required: false,
      help: "First 8 ft is in the base. Add stretches for extra flue — split if access changes.",
      when: { any: [
        { questionId: "install_type", equals: "cut_in_new" },
        { questionId: "wall_flue", oneOf: ["replace", "replace_flash", "replace_asb", "replace_asb_flash"] },
      ] },
    },
    {
      id: "wall_roof_access",
      prompt: "How hard is roof access?",
      type: "single",
      required: true,
      when: { questionId: "wall_flue", oneOf: ["replace", "replace_flash", "replace_asb", "replace_asb_flash"] },
      options: [
        { id: "1_safe", label: "1 person · safe access", laborHours: 0, materialCost: 6.37 },
        { id: "1_med", label: "1 person · medium access", laborHours: 0.25, materialCost: 6.37 },
        { id: "1_hard", label: "1 person · hard access", laborHours: 0.5, materialCost: 6.37 },
        { id: "2_safe", label: "2 people · safe access", laborHours: 1, materialCost: 6.37 },
        { id: "2_gear", label: "2 people · safety gear", laborHours: 1.5, materialCost: 6.37 },
        { id: "2_hard", label: "2 people · safety gear · very difficult", laborHours: 2, materialCost: 6.37 },
      ],
    },
    {
      id: "wall_units_above",
      prompt: "Units above this wall heater? Flue runs in the wall.",
      type: "single",
      required: true,
      when: { questionId: "wall_flue", oneOf: ["replace", "replace_flash", "replace_asb", "replace_asb_flash"] },
      options: [
        { id: "no", label: "No — full access to the wall flue" },
        { id: "yes", label: "Yes — unit(s) above, flue in the wall", benefitLines: ["Note: Acme will need access to the upstairs unit(s) directly above this wall heater during install."] },
      ],
    },
    {
      id: "wall_roof_pen",
      prompt: "What roof penetration?",
      type: "single",
      required: true,
      when: { any: [
        { questionId: "install_type", equals: "cut_in_new" },
        { questionId: "wall_flue", oneOf: ["replace_flash", "replace_asb_flash"] },
      ] },
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "existing", label: "Use existing flashing", scopeLines: ["Reuse existing roof flashing for the new Type-B flue."] },
        { id: "asphalt", label: "Asphalt shingles", scopeLines: ["Cut in new Type-B roof flashing through asphalt shingles."] },
        { id: "flat", label: "Flat roof", scopeLines: ["Cut in new Type-B roof flashing on the flat roof."] },
        { id: "metal", label: "Metal roofing", scopeLines: ["Cut in new Type-B roof flashing on metal roofing."] },
        { id: "clay_others", label: "Synthetic clay / barrel tile — by others", scopeLines: ["Roof flashing through synthetic clay / barrel tile by others."] },
        { id: "concrete_others", label: "Clay and concrete tile — by others", scopeLines: ["Roof flashing through clay or concrete tile by others."] },
      ],
    },
    {
      id: "wall_vent",
      prompt: "Wall ventilation needed?",
      type: "single",
      required: true,
      when: { questionId: "wall_path", equals: "williams_lfl" },
      options: [
        { id: "no", label: "Not needed" },
        { id: "firestop", label: "Install fire-stop & grill", materialCost: 50.05, laborHours: 0.5, scopeLines: ["Install a new fire-stop with ventilation grille at the ceiling between floors, or at a flat-roof termination, to meet code."] },
      ],
    },
    {
      id: "wall_shield",
      prompt: "Attic insulation shield needed?",
      type: "single",
      required: true,
      when: { questionId: "wall_path", equals: "williams_lfl" },
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "in_place", label: "Proper shield already in place" },
        { id: "with_new", label: "Yes — shield needed with new flue", materialCost: 25.48, scopeLines: ["Install required insulation shield around flue in attic to maintain proper ventilation."] },
        { id: "without_new", label: "Yes — shield needed without new flue", materialCost: 25.48, scopeLines: ["Install required insulation shield around flue in attic to maintain proper ventilation."] },
      ],
    },
    {
      id: "wall_shield_access",
      prompt: "How hard is attic access for the shield?",
      type: "single",
      required: true,
      when: { questionId: "wall_shield", equals: "without_new" },
      options: [
        { id: "easy", label: "Easy access", laborHours: 0.13 },
        { id: "medium", label: "Medium access", laborHours: 0.33 },
        { id: "hard", label: "Hard access", laborHours: 0.5 },
        { id: "very", label: "Very hard access", laborHours: 1 },
      ],
    },
    {
      id: "wall_stat",
      prompt: "Does this wall heater need a thermostat?",
      type: "single",
      required: true,
      when: { questionId: "wall_path", oneOf: ["williams_lfl", "williams_dv"] },
      options: [
        { id: "existing", label: "Connect to existing PGM stat / wiring", scopeLines: ["Connect new wall heater to existing programmable thermostat and wiring."] },
        { id: "install", label: "Install PGM thermostat (code required)", materialCost: 43.68, laborHours: 0.25, scopeLines: ["Install new battery operated programmable thermostat to meet code requirements (includes one year warranty by manufacturer)."] },
      ],
    },
    {
      id: "wall_stat_wire",
      prompt: "Thermostat wire already in place?",
      type: "single",
      required: true,
      when: { questionId: "wall_stat", equals: "install" },
      options: [
        { id: "yes", label: "Yes — wire is there" },
        { id: "no", label: "No — run new wire", note: "Then material, feet, and access" },
        { id: "look", label: "Look at it on site" },
      ],
    },
    {
      id: "wall_tstat_run",
      prompt: "How far is the thermostat wire run?",
      type: "linear_run",
      linearFamily: "thermostat",
      required: true,
      when: { questionId: "wall_stat_wire", oneOf: ["no", "new_run"] },
    },
    {
      id: "wall_dv_pen",
      prompt: "Which wall for the vent kit?",
      type: "single",
      required: true,
      when: { questionId: "wall_path", oneOf: ["williams_dv", "rinnai_dv"] },
      options: [
        { id: "existing", label: "Proper opening already in place" },
        { id: "wood", label: "Wood siding · cut in", laborHours: 0.5, materialCost: 19.11, scopeLines: ["Cut in new exterior wall opening for new exhaust kit and clean-up debris."] },
        { id: "stucco", label: "Stucco siding · cut in", laborHours: 0.75, materialCost: 25.48, scopeLines: ["Cut in new exterior wall opening for new exhaust kit and clean-up debris."] },
        { id: "brick", label: "Brick / tile siding · cut in", laborHours: 1, materialCost: 25.48, scopeLines: ["Cut in new exterior wall opening for new exhaust kit and clean-up debris."] },
        { id: "shingle", label: "Wood shingle siding · cut in", laborHours: 0.5, materialCost: 19.11, scopeLines: ["Cut in new exterior wall opening for new exhaust kit and clean-up debris."] },
      ],
    },
    {
      id: "wall_dv_exist_access",
      prompt: "How hard is the existing vent opening?",
      type: "single",
      required: true,
      when: { questionId: "wall_dv_pen", equals: "existing" },
      options: [
        { id: "walk", label: "Walk-up · no ladder", laborHours: 0.25 },
        { id: "lvl1", label: "Small ladder · first floor", laborHours: 0.75 },
        { id: "lvl2", label: "Second-floor ladder", laborHours: 1.25 },
        { id: "lvl3", label: "Third-floor ladder", laborHours: 1.75 },
        { id: "lvl4", label: "Fourth-floor / tallest", laborHours: 2.25 },
      ],
    },
    {
      id: "wall_dv_cut_access",
      prompt: "How hard to cut the vent opening?",
      type: "single",
      required: true,
      when: { questionId: "wall_dv_pen", oneOf: ["wood", "stucco", "brick", "shingle"] },
      options: [
        { id: "no_ladder", label: "No ladder · under 8' · good access", laborHours: 0.25 },
        { id: "l2", label: "Small ladder · harder access", laborHours: 0.75 },
        { id: "l3", label: "Second-floor ladder", laborHours: 1.25 },
        { id: "l4", label: "Third-floor ladder", laborHours: 1.75 },
        { id: "l5", label: "Fourth-floor / tallest · hardest access", laborHours: 2.25 },
      ],
    },
    {
      id: "wall_dv_ext",
      prompt: "Williams DV extension kit (up to 24\")",
      type: "single",
      required: true,
      when: { questionId: "wall_path", equals: "williams_dv" },
      options: [
        { id: "no", label: "Not needed" },
        { id: "yes", label: "Yes — up to 24\" extension kit", materialCost: 93.73, laborHours: 0.5, scopeLines: ['Install new Williams up to 24" wall extension kit.'] },
      ],
    },
    {
      id: "wall_rin_ext",
      prompt: "Need a Rinnai vent kit?",
      type: "single",
      required: true,
      when: { questionId: "wall_path", equals: "rinnai_dv" },
      options: [
        { id: "no", label: "Not needed" },
        { id: "yes", label: "Add Rinnai extension kit", scopeLines: ["Install Rinnai flue extension kit as needed to meet manufacturer requirements, install exposed cover as needed."] },
      ],
    },
    {
      id: "wall_rin_power",
      prompt: "Need a Rinnai 120V plug?",
      help: "EnergySaver has a built-in thermostat. It only needs a grounded 120V outlet — no wall stat, no thermostat wire.",
      type: "single",
      required: true,
      when: { questionId: "wall_path", equals: "rinnai_dv" },
      options: [
        {
          id: "existing",
          label: "Plug into existing 120V outlet",
          laborHours: 0.15,
          scopeLines: [
            "Connect the Rinnai EnergySaver to the existing grounded 120-volt outlet at the heater.",
          ],
        },
        {
          id: "add_outlet",
          label: "Add a 120V outlet at the heater",
          note: "Then how far",
          laborHours: 0.75,
          materialCost: 45,
          scopeLines: [
            "Install a new grounded 120-volt outlet at the EnergySaver and plug the unit in.",
          ],
        },
        {
          id: "by_others",
          label: "120V outlet by others",
          scopeLines: [
            "120-volt outlet for the EnergySaver by others. Plug-in at startup.",
          ],
        },
        { id: "not_applicable", label: "Not applicable" },
      ],
    },
    {
      id: "wall_rin_power_run",
      prompt: "How far is the new 120V run?",
      type: "linear_run",
      linearFamily: "electrical",
      required: true,
      when: { questionId: "wall_rin_power", equals: "add_outlet" },
    },
    {
      id: "finish_note",
      prompt: "Who finishes the wall?",
      type: "single",
      required: false,
      when: { questionId: "install_type", equals: "cut_in_new" },
      options: [
        { id: "finish_by_others", label: "Drywall / paint / trim by others", scopeLines: ["Wall patching, texture, paint, and decorative trim around the new opening by others."] },
        { id: "finish_basic", label: "Acme HVAC basic patch only (paint by others)", laborHours: 1.5, materialCost: 60, scopeLines: ["Basic wall patch at the cut-in; final texture and paint by others."] },
      ],
    },
  ],
};

const airHandlerScope: ScopeQuestionnaire = {
  id: "air_handler_v1",
  familyIds: ["air_handler"],
  title: "Air handler site conditions",
  blurb: "Demo, access, condensate. Electrical is the shared package, then service light.",
  source: "builtin",
  questions: [
    {
      id: "ah_demo",
      prompt: "Old equipment to remove?",
      type: "single",
      required: true,
      options: [
        { id: "not_applicable", label: "Not applicable" },
        { id: "by_others", label: "By others — removal and disposal", scopeLines: ["By others, removal and disposal of existing equipment."] },
        { id: "remove_fau", label: "Remove furnace / FAU", note: "Then how hard", materialCost: 125.38, scopeLines: ["Remove your existing furnace, haul it away, and recycle it."] },
        { id: "demo_other", label: "Remove / demo other (floor, wall, or electric heater)", note: "Then what" },
      ],
    },
    {
      id: "ah_demo_pull",
      prompt: "How hard to remove the FAU?",
      type: "single",
      required: true,
      when: { questionId: "ah_demo", oneOf: ["remove_fau", "demo_other"] },
      options: [
        { id: "a_easy", label: "1 tech · stand-up · open path", laborHours: 0.5 },
        { id: "b_1tech", label: "1 tech · longer pull", laborHours: 1 },
        { id: "c_2easy", label: "2 techs · stairs or easy path", laborHours: 1.5 },
        { id: "d_2tight", label: "2 techs · tight / two-person lift", laborHours: 1.75 },
        { id: "e_2hard", label: "2 techs · hard path", laborHours: 2.5 },
        { id: "d_2attic", label: "2 techs · attic", laborHours: 1.5 },
        { id: "g_3attic", label: "3 techs · attic", laborHours: 4 },
        { id: "d_2base", label: "2 techs · basement / tight", laborHours: 1.75 },
        { id: "g_3base", label: "3 techs · basement / hoist", laborHours: 4 },
      ],
    },
    {
      id: "ah_demo_other",
      prompt: "Anything else to remove?",
      type: "single",
      required: true,
      when: { questionId: "ah_demo", equals: "demo_other" },
      options: [
        { id: "floor_cap", label: "Floor heater — cap gas/flue · rough floor patch", scopeLines: ["Remove your existing floor furnace, haul it away, and recycle it. Cap the gas and flue. Install a rough floor patch as needed. Flooring, texture, trim and painting by others."] },
        { id: "floor_grille", label: "Floor heater — keep location and grille as new return", scopeLines: ["Remove existing floor heater and cap off gas line and flue. Use the existing floor heater location and grille as the new return-air inlet."] },
        { id: "wall", label: "Wall heater — rough patch · texture/trim/paint by others", materialCost: 62.79, scopeLines: ["Remove your existing wall heater, haul it away, and recycle it. Cap the gas and flue at that location. Install a rough wall patch. Texture, trim and painting by others."] },
        { id: "electric", label: "Electric heater(s) — patch / trim / paint by others", materialCost: 57.33, scopeLines: ["Remove and dispose of electric heater(s). Properly disconnect electrical and remove or secure wiring in approved accessible junction box(s). Close up opening(s) with rough patch. All texture, trim, flooring and painting by others."] },
      ],
    },
    {
      id: "ah_demo_floor",
      prompt: "Floor heater sides and clearance?",
      type: "single",
      required: true,
      when: { questionId: "ah_demo_other", oneOf: ["floor_cap", "floor_grille"] },
      options: [
        { id: "non_dual_30", label: "Single-sided · 30\" to 7\" clearance" },
        { id: "dual_30", label: "Double-sided · 30\" to 7\" clearance" },
        { id: "non_dual_18", label: "Single-sided · 18–30\" or 7–9\" clearance" },
        { id: "dual_18", label: "Double-sided · 18–30\" or 7–9\" clearance" },
      ],
    },
    {
      id: "ah_demo_wall",
      prompt: "Single-sided or double-sided wall heater?",
      type: "single",
      required: true,
      when: { questionId: "ah_demo_other", equals: "wall" },
      options: [
        { id: "single", label: "Single sided", laborHours: 1.25 },
        { id: "double", label: "Double sided", laborHours: 1.75 },
      ],
    },
    {
      id: "ah_demo_elec",
      prompt: "Electric heaters — how many, and is patching needed?",
      type: "single",
      required: true,
      when: { questionId: "ah_demo_other", equals: "electric" },
      options: [
        { id: "1_none", label: "1 heater · no patching", laborHours: 0.5 },
        { id: "1_patch", label: "1 heater · patching", laborHours: 0.88 },
        { id: "1_hard", label: "1 heater · patching hard", laborHours: 1.13 },
        { id: "2_none", label: "2 heaters · no patching", laborHours: 1 },
        { id: "2_patch", label: "2 heaters · patching", laborHours: 1.5 },
        { id: "3_none", label: "3 heaters · no patching", laborHours: 1.5 },
      ],
    },
    {
      id: "cabinet_fit",
      prompt: "Will this air handler fit the path in?",
      type: "boolean",
      required: true,
    },
    {
      id: "ah_access_ok",
      prompt: "Is code access already in place?",
      type: "boolean",
      required: false,
      hidden: true,
    },
    {
      id: "ah_access",
      prompt: "What access does this unit need?",
      help: "Proper means you verified it meets code and this unit goes through it.",
      type: "single",
      required: true,
      hidden: false,
      options: [
        {
          id: "in_place",
          label: "Proper",
          note: "I verified code + this unit",
        },
        {
          id: "enlarge",
          label: "Enlarge the access opening",
          note: "Then difficulty",
        },
        {
          id: "cut_in",
          label: "Cut a new access opening",
          note: "Then difficulty",
        },
        {
          id: "by_others",
          label: "By others",
          scopeLines: ["Equipment access by others."],
        },
      ],
    },
    {
      id: "ah_access_diff",
      prompt: "How hard is the access door / hatch work?",
      type: "single",
      required: true,
      when: { questionId: "ah_access", oneOf: ["enlarge", "cut_in"] },
      options: [
        { id: "easy", label: "Easy" },
        { id: "med", label: "Medium" },
        { id: "hard", label: "Hard" },
      ],
    },
    {
      id: "ah_access_finish",
      prompt: "Who finishes the door, trim, and paint?",
      type: "single",
      required: true,
      when: { questionId: "ah_access", oneOf: ["enlarge", "cut_in"] },
      options: [
        { id: "others", label: "By others — door / hatch / trim / texture / paint", scopeLines: ["Enlarge existing equipment access to meet code requirements (by others, proper access door/hatch, trim, texture & painting)."] },
        { id: "door", label: "Acme door and trim · paint by others", scopeLines: ["Enlarge existing equipment access to meet code requirements (includes proper access door/hatch & trim. All painting by others)."] },
        { id: "paint", label: "Acme door, trim, and matched paint", scopeLines: ["Enlarge existing equipment access to meet code requirements (includes new access door/hatch, trim and painting as needed)."] },
      ],
    },
    ...ATTIC_ACCESS_QUESTIONS,
    {
      id: "ah_location",
      prompt: "Where does this air handler go?",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "attic", label: "Attic", scopeLines: ["Air handler located in the attic; protect ceilings and provide service access."] },
        { id: "closet", label: "Closet / mechanical room", scopeLines: ["Air handler in closet/mechanical room with code clearances and finished protection."] },
        { id: "crawl", label: "Crawl space / basement", scopeLines: ["Air handler in the crawl or basement; protect and level as required."] },
        { id: "basement", label: "Basement", scopeLines: ["Air handler in the basement; protect and level as required."] },
        { id: "garage", label: "Garage", scopeLines: ["Air handler in the garage, set to meet local code."] },
      ],
    },
    {
      id: "condensate",
      prompt: "How does condensate drain?",
      type: "single",
      required: true,
      options: [
        { id: "gravity_ok", label: "It drains downhill — no pump" },
        { id: "pump", label: "Needs a condensate pump", laborHours: 1.25, materialCost: 185, scopeLines: ["Install condensate pump and discharge to approved location; test float and safety switch."] },
        { id: "drain_by_others", label: "Drain work by others", scopeLines: ["Primary drain path by others; Acme HVAC connects the air handler drain pan outlet."] },
      ],
    },
    {
      id: "ah_cond_path",
      prompt: "Reconnect existing condensate, or new run?",
      help: "Replace jobs usually reconnect. New run only if the existing drain is wrong, missing, or we have to move it.",
      type: "single",
      required: true,
      when: { questionId: "condensate", oneOf: ["gravity_ok", "pump"] },
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing drain",
          laborHours: 0.2,
          scopeLines: [
            "Reconnect condensate to the existing drain after confirming slope and termination.",
          ],
        },
        {
          id: "new",
          label: "New condensate run",
          note: "Then length, access, and holes",
          laborHours: 0.35,
          scopeLines: [
            "Install new condensate drain, properly trapped and terminated.",
          ],
        },
      ],
    },
    {
      id: "ah_cond_run",
      prompt: "How far is the condensate pipe run?",
      type: "linear_run",
      linearFamily: "condensate",
      required: true,
      when: { questionId: "ah_cond_path", equals: "new" },
    },
    {
      id: "thermostat_hp",
      prompt: "What thermostat are we using?",
      type: "single",
      required: true,
      options: [
        { id: "reuse", label: "Reuse existing thermostat", scopeLines: ["Reuse existing thermostat where compatible; verify operation with the new system."] },
        { id: "new_std", label: "New thermostat · existing wire", materialCost: 85, laborHours: 0.5, scopeLines: ["Install new thermostat on the existing wire and configure for the system type."] },
        { id: "new_wire", label: "New thermostat · new wire run", note: "Then feet, access, and holes", materialCost: 85, laborHours: 0.5, scopeLines: ["Install new thermostat and run new thermostat wire."] },
        { id: "by_others", label: "Thermostat by others", scopeLines: ["Thermostat by others; Acme connects and verifies control of the new system."] },
      ],
    },
    {
      id: "tstat_run",
      prompt: "How far is the thermostat wire run?",
      help: "18/5 for most systems. 18/8 for heat pumps / communicating.",
      type: "linear_run",
      linearFamily: "thermostat",
      required: true,
      when: { questionId: "thermostat_hp", equals: "new_wire" },
    },
    {
      id: "kit_media_filter",
      prompt: "What filter are we using?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "not_needed", label: "Not needed" },
        {
          id: "add",
          label: "Add media filter",
          laborHours: 0.35,
          scopeLines: [
            "Install new media air filter as specified on this system.",
          ],
        },
      ],
    },
  ],
};

const ductlessScope: ScopeQuestionnaire = {
  id: "ductless_v1",
  familyIds: ["ductless"],
  title: "Mini-split / ductless site conditions",
  blurb:
    "Pick how many zones, then each head. Carrier and Mitsubishi share this path — swap brands without rebuilding the job.",
  source: "builtin",
  questions: [
    {
      id: "demo_outdoor",
      prompt: "Old outdoor unit to remove?",
      type: "single",
      required: true,
      options: [
        { id: "not_applicable", label: "Nothing — new install" },
        {
          id: "demo_ms",
          label: "Existing mini-split",
          scopeLines: [
            "Recover the refrigerant to EPA requirements, then remove the existing outdoor unit and indoor heads, haul them away, and recycle them.",
          ],
        },
        {
          id: "demo_hp",
          label: "Existing heat pump / condenser",
          scopeLines: [
            "Recover the refrigerant to EPA requirements, then remove your existing outdoor unit, haul it away, and recycle it.",
          ],
        },
        {
          id: "by_others",
          label: "Outdoor removal by others",
          scopeLines: [],
        },
      ],
    },
    {
      id: "install_type",
      prompt: "Replace the mini-split, or new?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        {
          id: "replace",
          label: "Replace existing ductless system",
          scopeLines: [
            "Recover the refrigerant to EPA requirements, then remove the existing outdoor unit and indoor heads, haul them away, and recycle them.",
          ],
        },
        {
          id: "new",
          label: "New ductless system (no prior mini-split)",
          laborHours: 1,
          scopeLines: [
            "Install a new ductless outdoor unit and indoor heads designed for this home.",
          ],
        },
      ],
    },
    {
      id: "ms_brands",
      prompt: "Pick mini-split brand(s)",
      help: "Picked on the walk. Carrier and Mitsubishi stay as packages.",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "carrier", label: "Carrier" },
        { id: "mitsubishi", label: "Mitsubishi" },
        {
          id: "both",
          label: "Both — show as packages",
          benefitLines: [
            "You can compare Carrier and Mitsubishi on this same design — same rooms, same line sets, same labor path.",
          ],
        },
      ],
    },
    {
      id: "ms_zones",
      prompt: "Pick how many rooms",
      help: "Picked on the unit step. 1 is a one-to-one. 2–5 share one outdoor. Carrier home-run tops out around 6. Mitsubishi 6–8 needs a distribution box.",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "1", label: "1 zone · one-to-one" },
        { id: "2", label: "2 zones" },
        { id: "3", label: "3 zones" },
        { id: "4", label: "4 zones" },
        { id: "5", label: "5 zones" },
        {
          id: "6",
          label: "6 zones · Carrier home-run / Mitsubishi dist. box",
          note: "Carrier 38MGR-class typically home-runs up to 6. Mitsubishi 6+ uses PAC-MKA.",
        },
        {
          id: "7",
          label: "7 zones · Mitsubishi distribution box",
          note: "Carrier does not sell a 7-zone outdoor. Mitsubishi 7 needs PAC-MKA.",
        },
        {
          id: "8",
          label: "8 zones · Mitsubishi distribution box",
          note: "Carrier typically stays at 5–6 without a hub. Mitsubishi 8 needs PAC-MKA boxes.",
        },
      ],
    },
    {
      id: "ms_demo_gas",
      prompt: "Are we also removing old gas heat?",
      help: "Wall heater, furnace, floor furnace — each one is its own pull.",
      type: "single",
      required: true,
      options: [
        { id: "no", label: "No old gas heat on this job" },
        { id: "yes", label: "Yes — pull old gas appliances" },
        {
          id: "by_others",
          label: "Gas removal by others",
          scopeLines: ["Removal of existing gas heating appliances by others."],
        },
      ],
    },
    {
      id: "ms_demo_apps",
      prompt: "How many old appliances, and what kind?",
      help: "Wall heater, furnace, floor heater — tap the scenarios that apply.",
      type: "gas_app_repeat",
      required: true,
      when: { questionId: "ms_demo_gas", equals: "yes" },
    },
    {
      id: "demo_pull",
      prompt: "How hard to remove the outdoor unit?",
      type: "single",
      required: true,
      when: { questionId: "demo_outdoor", oneOf: ["demo_ms", "demo_hp"] },
      options: [
        { id: "a_easy", label: "1 tech · ground · open path", laborHours: 0.5 },
        { id: "b_1long", label: "1 tech · longer carry", laborHours: 0.85 },
        { id: "c_2easy", label: "2 techs · stairs or tight gate", laborHours: 1.5 },
        { id: "d_2hard", label: "2 techs · hard path / hoist", laborHours: 2.25 },
        { id: "roof", label: "Roof / elevated — two people", laborHours: 2.5 },
      ],
    },
    {
      id: "ms_outdoor_place",
      prompt: "Where does this heat pump sit?",
      type: "single",
      required: true,
      options: [
        {
          id: "grade",
          label: "Grade / side yard",
          scopeLines: [
            "Set the new outdoor unit on a proper pad at grade, level and clear of the structure per manufacturer requirements.",
          ],
        },
        {
          id: "elevated",
          label: "Elevated stand / brackets",
          laborHours: 0.75,
          materialCost: 145,
          scopeLines: [
            "Set the new outdoor unit on an approved elevated stand or wall brackets, level and secured.",
          ],
        },
        {
          id: "roof",
          label: "Roof",
          laborHours: 2,
          materialCost: 220,
          scopeLines: [
            "Set the new outdoor unit on the roof with approved supports, vibration isolation, and safe service access.",
          ],
        },
        {
          id: "balcony",
          label: "Balcony / deck",
          laborHours: 1,
          materialCost: 90,
          scopeLines: [
            "Set the new outdoor unit on the balcony or deck with approved isolation and clearances.",
          ],
        },
      ],
    },
    ...outdoorSetQuestions,
    ...msHeadQuestions(1),
    ...msHeadQuestions(2, { questionId: "ms_zones", oneOf: ["2", "3", "4", "5", "8"] }),
    ...msHeadQuestions(3, { questionId: "ms_zones", oneOf: ["3", "4", "5", "8"] }),
    ...msHeadQuestions(4, { questionId: "ms_zones", oneOf: ["4", "5", "8"] }),
    ...msHeadQuestions(5, { questionId: "ms_zones", oneOf: ["5", "8"] }),
    {
      id: "ms_more_heads",
      prompt: "Name rooms 6–8 (Mitsubishi)",
      help: "Name rooms 6, 7, and 8. Styles follow the same list as the first five.",
      type: "text",
      required: true,
      when: { questionId: "ms_zones", equals: "8" },
      placeholder: "e.g. Bonus · high wall; Hall · 1-way cassette; Office · high wall",
      scopeLines: [
        "Additional indoor heads as listed on this measure, each with its own refrigerant line from the distribution box.",
      ],
    },
    {
      id: "ms_hub_need",
      prompt: "Need a Mitsubishi distribution box?",
      help: "Home-run MXZ-C (2–5 ports on the outdoor) usually does not. MXZ-SM / 8-port needs a PAC-MKA box.",
      type: "single",
      required: true,
      when: [
        { questionId: "ms_brands", oneOf: ["mitsubishi", "both"] },
        { questionId: "ms_zones", oneOf: ["5"] },
      ],
      options: [
        { id: "no", label: "No — ports on the outdoor (home-run)" },
        {
          id: "yes",
          label: "Yes — PAC-MKA / distribution box",
          laborHours: 3.5,
          materialCost: 980,
        },
      ],
    },
    {
      id: "ms_hub_place",
      prompt: "Where does the distribution box go?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ms_zones", equals: "8" },
          { questionId: "ms_hub_need", equals: "yes" },
        ],
      },
      options: [
        { id: "attic", label: "Attic" },
        { id: "closet", label: "Closet / indoor mechanical" },
        { id: "garage", label: "Garage" },
        { id: "other", label: "Other accessible location" },
      ],
    },
    {
      id: "ms_hub_power",
      prompt: "How is the box powered?",
      help: "Powered from the outdoor. Residential boxes do not get a dedicated indoor circuit.",
      type: "single",
      required: false,
      hidden: true,
      when: {
        any: [
          { questionId: "ms_zones", equals: "8" },
          { questionId: "ms_hub_need", equals: "yes" },
        ],
      },
      options: [
        {
          id: "from_outdoor",
          label: "Powered from the outdoor unit",
          scopeLines: [
            "Power the distribution box from the outdoor unit and confirm it is properly protected.",
          ],
        },
      ],
    },
    {
      id: "ms_hub_light",
      prompt: "Service light / switch at the distribution box?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ms_zones", equals: "8" },
          { questionId: "ms_hub_need", equals: "yes" },
        ],
      },
      options: [
        {
          id: "add",
          label: "Add service light and switch",
          laborHours: 0.45,
          materialCost: 48,
          scopeLines: [
            "Install a service light and switch at the distribution box so the equipment can be serviced safely.",
          ],
        },
        { id: "exists", label: "Already there" },
      ],
    },
    {
      id: "ms_hub_pan",
      prompt: "Secondary drain pan under the box (attic)?",
      type: "single",
      required: true,
      when: { questionId: "ms_hub_place", equals: "attic" },
      options: [
        {
          id: "yes",
          label: "Yes — pan under the box",
          laborHours: 0.6,
          materialCost: 95,
          scopeLines: [
            "Install a secondary drain pan under the attic distribution box and terminate the pan drain to an approved location.",
          ],
        },
        { id: "not_applicable", label: "Not in the attic / not needed" },
      ],
    },
    {
      id: "ms_slim_filter",
      prompt: "What filter on this indoor?",
      help: "No default. AprilAire if you can walk up to it and it fits. Filter grille when the bay is too tight. Same question as a full-size air handler.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ms_h1_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h2_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h3_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h4_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h5_style", oneOf: ["slim_duct", "ducted_ah"] },
        ],
      },
      options: [
        {
          id: "aprilaire",
          label: "AprilAire media — walk-up access and it fits",
          laborHours: 1.1,
          materialCost: 285,
          scopeLines: [
            "Install an AprilAire media cabinet on the slim indoor so you change a long-life filter instead of a small washable screen.",
          ],
        },
        {
          id: "grille",
          label: "Filter grille — tight or not walk-up",
          laborHours: 0.6,
          materialCost: 85,
          scopeLines: [
            "Install a return filter grille you can reach and change. That grille is what protects this indoor — not the small washable screen that ships with the unit.",
          ],
        },
      ],
    },
    {
      id: "ms_slim_ducts",
      prompt: "What ducts on this indoor?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ms_h1_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h2_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h3_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h4_style", oneOf: ["slim_duct", "ducted_ah"] },
          { questionId: "ms_h5_style", oneOf: ["slim_duct", "ducted_ah"] },
        ],
      },
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing ducts",
          laborHours: 1.5,
          scopeLines: [
            "Reconnect the slim indoor to the existing supply and return. Seal connections and confirm the ducts can deliver the airflow this indoor needs.",
          ],
        },
        {
          id: "tune",
          label: "Tune-up existing ducts",
          laborHours: 2.5,
          materialCost: 85,
          scopeLines: [
            "Tune and seal the existing supply and return serving this slim indoor so the new equipment can move the air it was built for.",
          ],
        },
        {
          id: "new",
          label: "New supply and return for this indoor",
          laborHours: 4,
          materialCost: 420,
          scopeLines: [
            "Install new supply and return duct for the slim indoor, insulated and sealed, with a proper return path to the filter.",
          ],
        },
      ],
    },
    {
      id: "ms_wall_ctrl",
      prompt: "Remote and Wi-Fi, or add a wall control?",
      help: "Visible heads ship with remote and Wi-Fi. This is not asked on the walk — wall control is an accessory if they open it.",
      type: "single",
      required: false,
      hidden: true,
      when: {
        any: [
          { questionId: "ms_h1_style", oneOf: ["high_wall", "low_wall", "one_way", "four_way"] },
          { questionId: "ms_h2_style", oneOf: ["high_wall", "low_wall", "one_way", "four_way"] },
          { questionId: "ms_h3_style", oneOf: ["high_wall", "low_wall", "one_way", "four_way"] },
          { questionId: "ms_h4_style", oneOf: ["high_wall", "low_wall", "one_way", "four_way"] },
          { questionId: "ms_h5_style", oneOf: ["high_wall", "low_wall", "one_way", "four_way"] },
        ],
      },
      options: [
        {
          id: "no",
          label: "Remote and Wi-Fi — what’s in the box",
          scopeLines: [
            "Set up the handheld remote and Wi-Fi on the indoor you can see. Show you heat, cool, and the app.",
          ],
        },
        {
          id: "add",
          label: "Yes — add a wall controller",
          laborHours: 0.5,
          materialCost: 185,
          scopeLines: [
            "Install a wall controller at the requested location and set it up with the indoor it serves.",
          ],
        },
        {
          id: "slim_kit",
          label: "Slim indoor kit control only (no extra wall control on heads)",
          scopeLines: [
            "Use the wall control that belongs with the hidden indoor. Visible heads stay on remote and Wi-Fi.",
          ],
        },
      ],
    },
    {
      id: "ms_wall_wire",
      prompt: "Wall-control wire in place?",
      type: "single",
      required: true,
      when: { questionId: "ms_wall_ctrl", equals: "add" },
      options: [
        {
          id: "existing",
          label: "Use existing thermostat wire",
          laborHours: 0.25,
          scopeLines: [
            "Land the wall controller on existing low-voltage wire after confirming it is intact.",
          ],
        },
        {
          id: "new",
          label: "Run new thermostat wire",
          note: "Then feet, access, and holes",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Run new thermostat cable from the indoor to the wall controller location.",
          ],
        },
      ],
    },
    {
      id: "ms_wall_wire_run",
      prompt: "How far is the wall-control wire?",
      type: "linear_run",
      linearFamily: "thermostat",
      required: true,
      when: { questionId: "ms_wall_wire", equals: "new" },
    },
    {
      id: "ms_slim_ctrl",
      prompt: "How do we control this indoor?",
      help: "Slim ducted does not ship a handheld remote the way a wall head does. Kit control at the unit, or a wall controller at a location.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ms_h1_style", equals: "slim_duct" },
          { questionId: "ms_h2_style", equals: "slim_duct" },
          { questionId: "ms_h3_style", equals: "slim_duct" },
          { questionId: "ms_h4_style", equals: "slim_duct" },
          { questionId: "ms_h5_style", equals: "slim_duct" },
        ],
      },
      options: [
        {
          id: "kit",
          label: "Kit control that ships with it",
          scopeLines: [
            "Set up the kit control that ships with the slim indoor and show you heat and cool.",
          ],
        },
        {
          id: "wall",
          label: "Wall controller at a location",
          laborHours: 0.5,
          materialCost: 185,
          scopeLines: [
            "Install a wall controller at the requested location for the slim indoor and set it up with the unit it serves.",
          ],
        },
      ],
    },
    {
      id: "ms_slim_ctrl_place",
      prompt: "Where does that wall controller land?",
      type: "text",
      required: true,
      when: { questionId: "ms_slim_ctrl", equals: "wall" },
      placeholder: "e.g. Hall by the return · Living doorway",
      scopeLines: [
        "Mount the slim-indoor wall controller at the location noted on this measure.",
      ],
    },
    {
      id: "ms_ah_ctrl",
      prompt: "Where does the wall control land?",
      help: "Ducted air handler ships a wall control. Remote / Wi-Fi can still ride along. New wire is priced here so the option is real.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ms_h1_style", equals: "ducted_ah" },
          { questionId: "ms_h2_style", equals: "ducted_ah" },
          { questionId: "ms_h3_style", equals: "ducted_ah" },
          { questionId: "ms_h4_style", equals: "ducted_ah" },
          { questionId: "ms_h5_style", equals: "ducted_ah" },
        ],
      },
      options: [
        {
          id: "at_unit",
          label: "At the air handler",
          laborHours: 0.35,
          materialCost: 0,
          scopeLines: [
            "Set up the wall control that ships with the ducted air handler at the unit.",
          ],
        },
        {
          id: "existing_wire",
          label: "On existing thermostat wire",
          laborHours: 0.5,
          materialCost: 0,
          scopeLines: [
            "Land the wall control that ships with the ducted air handler on existing thermostat wire after confirming it is intact.",
          ],
        },
        {
          id: "new_wire",
          label: "New thermostat wire to a wall",
          note: "Then feet, access, and holes",
          laborHours: 0.6,
          materialCost: 18,
          scopeLines: [
            "Install the wall control that ships with the ducted air handler and run new thermostat cable to the wall location.",
          ],
        },
      ],
    },
    {
      id: "ms_ah_ctrl_run",
      prompt: "How far is the thermostat wire for this air handler?",
      type: "linear_run",
      linearFamily: "thermostat",
      required: true,
      when: { questionId: "ms_ah_ctrl", equals: "new_wire" },
    },
    {
      id: "ms_permit",
      prompt: "Need a permit?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        {
          id: "include",
          label: "Include mechanical permit (always on a mini-split)",
          // Never compiles onto this measure’s customer contract.
        },
      ],
    },
  ],
};

function andWhen(
  base: ScopeWhen | ScopeWhen[] | undefined,
  extra: ScopeWhen,
): ScopeWhen | ScopeWhen[] {
  if (!base) return extra;
  return [...(Array.isArray(base) ? base : [base]), extra];
}

function msHeadQuestions(
  n: number,
  when?: ScopeWhen | ScopeWhen[],
): ScopeQuestion[] {
  const prefix = `ms_h${n}`;
  const whenArr = when ? (Array.isArray(when) ? when : [when]) : undefined;
  const wallHeight = andWhen(whenArr, {
    questionId: `${prefix}_style`,
    oneOf: ["high_wall", "one_way"],
  });
  const cassette = andWhen(whenArr, {
    questionId: `${prefix}_style`,
    equals: "one_way",
  });
  const ahOnly = andWhen(whenArr, {
    questionId: `${prefix}_style`,
    equals: "ducted_ah",
  });
  const runNew = andWhen(whenArr, {
    questionId: `${prefix}_run`,
    equals: "new",
  });
  const runReuse = andWhen(whenArr, {
    questionId: `${prefix}_run`,
    equals: "reuse",
  });
  return [
    {
      id: `${prefix}_room`,
      prompt: `Which room is this head in?`,
      type: "single",
      required: true,
      when: whenArr,
      options: [
        { id: "other", label: "Custom" },
        { id: "living", label: "Living room" },
        { id: "family", label: "Family room" },
        { id: "dining", label: "Dining" },
        { id: "kitchen", label: "Kitchen" },
        { id: "primary", label: "Primary bedroom" },
        { id: "bed2", label: "Bedroom 2" },
        { id: "bed3", label: "Bedroom 3" },
        { id: "guest", label: "Guest room" },
        { id: "office", label: "Office" },
        { id: "bonus", label: "Bonus / loft" },
        { id: "media", label: "Media room" },
        { id: "garage", label: "Garage" },
        { id: "laundry", label: "Laundry" },
        { id: "gym", label: "Gym" },
        { id: "hall", label: "Hall" },
        { id: "basement", label: "Basement" },
        { id: "sunroom", label: "Sunroom" },
        { id: "play", label: "Playroom" },
        { id: "loft", label: "Loft" },
      ],
    },
    {
      id: `${prefix}_room_name`,
      prompt: `What do they call this room?`,
      type: "text",
      required: true,
      when: andWhen(whenArr, { questionId: `${prefix}_room`, equals: "other" }),
      placeholder: "e.g. Nana’s room · gym loft",
    },
    {
      id: `${prefix}_style`,
      prompt: `Pick the indoor unit style`,
      help: "The indoor unit (sometimes called a head) is what heats and cools this room. High wall, low wall, cassette, then slimline. Ducted air handler uses existing ducts.",
      type: "single",
      required: true,
      when: whenArr,
      options: [
        {
          id: "high_wall",
          label: "High wall",
          laborHours: n === 1 ? 0 : 1.6,
          materialCost: n === 1 ? 0 : 0,
          scopeLines: [
            "Mount a high-wall indoor head in {room} on an approved wall, flash and seal the wall penetration, and slope the condensate so it drains.",
          ],
        },
        {
          id: "one_way",
          label: "Thin 1-way ceiling cassette (joist bay)",
          laborHours: 1.75,
          scopeLines: [
            "Install a thin one-way ceiling cassette in {room}, in a standard joist bay. Air is aimed into the room so the space actually feels it.",
          ],
        },
        {
          id: "low_wall",
          label: "Low wall / floor",
          laborHours: 1.5,
          scopeLines: [
            "Install a low-wall indoor in {room}, secured and clear of furnishings, with the condensate and refrigerant lines concealed as designed.",
          ],
        },
        {
          id: "slim_duct",
          label: "Slim ducted indoor (last resort / hidden)",
          laborHours: 2.25,
          scopeLines: [
            "Install a slim, hidden indoor unit for {room}. A small supply and return feed the room so you do not need a wall head.",
          ],
        },
        {
          id: "ducted_ah",
          label: "Ducted air handler (uses existing ducts)",
          laborHours: 3.5,
          materialCost: 180,
          scopeLines: [
            "Install a ducted indoor air handler for {room}, connected to the existing duct system so that space is conditioned with the same outdoor unit as the wall heads.",
          ],
        },
        {
          id: "four_way",
          label: "4-way cassette",
          laborHours: 2.25,
          scopeLines: [
            "Install a 4-way ceiling cassette in {room}, set so air throws to the space, with condensate and refrigerant lines concealed as designed.",
          ],
        },
      ],
    },
    {
      id: `${prefix}_throw`,
      prompt: `Can this 1-way throw into the room?`,
      help: "One-way cassettes are directional. Not the center of the room. The comfort advisor must own the location.",
      type: "single",
      required: true,
      when: cassette,
      options: [
        {
          id: "yes",
          label: "Yes — location throws into the space",
        },
      ],
    },
    {
      id: `${prefix}_height`,
      prompt: `How high is this indoor?`,
      help: "Only for high-wall and 1-way cassette. Hidden and ducted indoors skip this.",
      type: "single",
      required: true,
      when: wallHeight,
      options: [
        { id: "std", label: "Standard wall / 8-ft ceiling" },
        {
          id: "tall",
          label: "Tall wall or 10–12 ft ceiling",
          laborHours: 0.35,
        },
        {
          id: "high",
          label: "High / vaulted / ladder work",
          laborHours: 0.85,
        },
      ],
    },
    {
      id: `${prefix}_run`,
      prompt: `New line set, or reuse a path?`,
      help: "This indoor only. New run asks length and difficulty next. Reuse stays on this page if the old path is still good.",
      type: "single",
      required: true,
      when: whenArr,
      options: [
        {
          id: "new",
          label: "New line set — length next",
          note: "Access, cover, holes — one page",
          scopeLines: [
            "Install a new refrigerant line set from the outdoor condenser to this indoor unit.",
          ],
        },
        {
          id: "reuse",
          label: "Reuse an existing chase / path",
          scopeLines: [
            "Route this indoor’s refrigerant line on the existing path where it is sound.",
            "Acme does not warranty existing infrastructure — path, copper, insulation, or interconnect wiring. Warranty covers new equipment and the work performed this visit.",
          ],
        },
      ],
    },
    {
      id: `${prefix}_run_takeoff`,
      prompt: `Line set to this indoor`,
      help: "Slide Easy / Medium / Hard. Cover at 0 = none. Holes at the bottom. Sold line set is rounded up.",
      type: "linear_run",
      linearFamily: "line_set",
      required: true,
      when: runNew,
    },
    {
      id: `${prefix}_ctrl`,
      prompt: `What’s on this existing line?`,
      help: "Solid 14/4 is what new equipment wants. Older Fujitsu-style 3-conductor is not enough. Not verified = we treat it as 3-conductor until we see it.",
      type: "single",
      required: true,
      when: runReuse,
      options: [
        {
          id: "w14_4",
          label: "Solid 4-conductor (14/4)",
          scopeLines: [
            "Land the new indoor on the existing 14/4 interconnect after confirming it is intact.",
            "Acme does not warranty existing infrastructure — path, copper, insulation, or interconnect wiring. Warranty covers new equipment and the work performed this visit.",
          ],
        },
        {
          id: "w3",
          label: "Only 3-conductor (older Fujitsu-style)",
          scopeLines: [
            "Existing interconnect is 3-conductor (older Fujitsu-style). Proper 14/4 is required for this equipment.",
            "Acme does not warranty existing infrastructure — path, copper, insulation, or interconnect wiring. Warranty covers new equipment and the work performed this visit.",
          ],
        },
        {
          id: "unverified",
          label: "Not verified",
          scopeLines: [
            "Existing interconnect was not verified on this visit. Confirm 14/4 before relying on the old run.",
            "Acme does not warranty existing infrastructure — path, copper, insulation, or interconnect wiring. Warranty covers new equipment and the work performed this visit.",
          ],
        },
      ],
    },
    {
      id: `${prefix}_14_4`,
      prompt: `How do we get 14/4 on this run?`,
      help: "3-conductor or unverified — pull 14/4 in the cover when it will go, otherwise a new run.",
      type: "single",
      required: true,
      when: andWhen(runReuse, {
        questionId: `${prefix}_ctrl`,
        oneOf: ["w3", "unverified"],
      }),
      options: [
        {
          id: "cover",
          label: "Pull 14/4 in the existing cover",
          laborHours: 0.65,
          materialCost: 28,
          scopeLines: [
            "Pull new 14/4 interconnect in the existing line-set cover and land it at both ends.",
          ],
        },
        {
          id: "new",
          label: "New 14/4 run",
          laborHours: 0.95,
          materialCost: 42,
          scopeLines: [
            "Run new 14/4 interconnect with this indoor and land it at both ends.",
          ],
        },
      ],
    },
    {
      id: `${prefix}_ctrl_count`,
      prompt: `How many wires in this line?`,
      help: "Kept for older drafts. Interconnect question above is the live ask.",
      type: "single",
      required: false,
      hidden: true,
      when: andWhen(runReuse, {
        questionId: `${prefix}_ctrl`,
        equals: "yes",
      }),
      options: [
        { id: "w2", label: "2 wires" },
        { id: "w3", label: "3 wires" },
        { id: "w4", label: "4 wires" },
        { id: "w5", label: "5 or more" },
      ],
    },
    {
      id: `${prefix}_ah_place`,
      prompt: `Where does this air handler sit?`,
      help: "Same locations as a full-size air handler. Nothing is pre-selected.",
      type: "single",
      required: true,
      when: ahOnly,
      options: [
        { id: "attic", label: "Attic" },
        { id: "closet", label: "Closet / indoor mechanical" },
        { id: "garage", label: "Garage" },
        { id: "crawl", label: "Crawl" },
        { id: "other", label: "Other — name it next" },
      ],
    },
    {
      id: `${prefix}_ah_place_name`,
      prompt: `Name this air handler spot`,
      type: "text",
      required: true,
      when: andWhen(ahOnly, {
        questionId: `${prefix}_ah_place`,
        equals: "other",
      }),
      placeholder: "e.g. Bonus closet · Garage attic",
    },
  ];
}

const acScope: ScopeQuestionnaire = {
  id: "ac_v1",
  familyIds: ["ac"],
  title: "Air conditioner site conditions",
  blurb: "Demo outdoor unit, then pad, set, line set. Electrical stays last.",
  source: "builtin",
  questions: [
    ...outdoorDemoQuestions.map((q) =>
      q.id === "demo_outdoor"
        ? { ...q, options: (q.options || []).filter((o) => o.id !== "demo_hp") }
        : q.id === "demo_pull"
          ? { ...q, when: { questionId: "demo_outdoor", equals: "demo_ac" } }
          : q,
    ),
    {
      id: "outdoor_location",
      prompt: "Where does this heat pump sit?",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "normal", label: "Normal yard access", scopeLines: ["Set outdoor condenser with manufacturer clearances on the approved pad location."] },
        { id: "tight", label: "Tight access / long carry", laborHours: 1.25, scopeLines: ["Condenser placement requires extended equipment path and site protection."] },
      ],
    },
    ...outdoorSetQuestions,
    ...lineSetQuestions,
    ...controlWireQuestions,
  ],
};

const waterHeaterTankScope: ScopeQuestionnaire = {
  id: "water_heater_tank_v1",
  familyIds: ["water_heater"],
  title: "Water heater site conditions",
  blurb: "Style is seeded from the equipment. Tank kit, water lines, tankless, hybrid, and gas attach as needed.",
  source: "builtin",
  questions: [
    {
      id: "wh_style",
      prompt: "Pick water heater type",
      help: "Seeded from the equipment. Hidden in the advisor UI.",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "electric-tank", label: "Electric tank" },
        { id: "gas-tank", label: "Gas tank" },
        { id: "he-gas", label: "High-eff gas" },
        { id: "tankless", label: "Tankless" },
        { id: "hybrid", label: "Hybrid heat pump" },
        { id: "sanden-split", label: "Sanden split" },
      ],
    },
    {
      id: "wh_navien_a",
      prompt: "Navien A-series on this job?",
      help: "Seeded. Hidden in the advisor UI.",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    {
      id: "san_fit",
      prompt: "Does this Sanden tank fit the current location?",
      help: "Bigger tank is better if it fits. If not, we price relocate against keeping the smaller tank in place.",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "sanden-split" },
      options: [
        {
          id: "yes",
          label: "Yes — it fits here",
          scopeLines: [
            "Set the Sanden storage tank in the existing water-heater location.",
          ],
        },
        {
          id: "no",
          label: "No — we have to move it",
          note: "Then relocate path",
        },
      ],
    },
    {
      id: "san_reloc",
      prompt: "Where does the larger tank go?",
      type: "single",
      required: true,
      when: { questionId: "san_fit", equals: "no" },
      options: [
        {
          id: "near",
          label: "Nearby closet / same room",
          laborHours: 1.5,
          materialCost: 85,
          scopeLines: [
            "Relocate the Sanden tank to a nearby closet or same-room position so the larger tank will fit. Water lines extended and finished as needed.",
          ],
        },
        {
          id: "garage",
          label: "Garage",
          laborHours: 3,
          materialCost: 185,
          scopeLines: [
            "Relocate the Sanden tank to the garage. New water lines, drain, and seismic as required.",
          ],
        },
        {
          id: "other_floor",
          label: "Different floor",
          laborHours: 5,
          materialCost: 320,
          scopeLines: [
            "Relocate the Sanden tank to another floor. New water lines, drain, and penetrations as required.",
          ],
        },
        {
          id: "hard",
          label: "Hard access / crawl / tight",
          laborHours: 6.5,
          materialCost: 280,
          scopeLines: [
            "Relocate the Sanden tank through hard access. Extra labor for tight path and new lines.",
          ],
        },
      ],
    },
    {
      id: "san_pipe",
      prompt: "Water lines, outdoor to tank?",
      help: "Manufacturer max 66 ft, 23 ft vertical, 6 bends. Slide Easy / Medium / Hard. Stay inside that.",
      type: "linear_run",
      linearFamily: "water",
      required: true,
      when: { questionId: "wh_style", equals: "sanden-split" },
    },
    {
      id: "san_bends",
      prompt: "How many bends in those water lines?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_style", equals: "sanden-split" },
      options: [
        { id: "few", label: "0–2 bends" },
        { id: "mid", label: "3–4 bends", laborHours: 0.35 },
        { id: "max", label: "5–6 bends (max)", laborHours: 0.75 },
      ],
    },
    {
      id: "san_od",
      prompt: "What does the Sanden sit on?",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "sanden-split" },
      options: [
        {
          id: "exist_pad",
          label: "Use a pad that’s already there",
          scopeLines: [
            "Set the Sanden outdoor unit on the existing pad.",
          ],
        },
        {
          id: "new_pad",
          label: "New preformed pad",
          laborHours: 0.5,
          materialCost: 85,
          scopeLines: [
            "Set the Sanden outdoor unit on a new preformed equipment pad.",
          ],
        },
        {
          id: "concrete",
          label: "New concrete pad",
          laborHours: 2.5,
          materialCost: 220,
          scopeLines: [
            "Set the Sanden outdoor unit on a new concrete pad. Bolt it down so it stays put.",
          ],
        },
        {
          id: "wall",
          label: "Wall bracket",
          laborHours: 1.25,
          materialCost: 165,
          scopeLines: [
            "Mount the Sanden outdoor unit on a wall bracket.",
          ],
        },
      ],
    },
    {
      id: "san_tape",
      prompt: "Freeze kit / heat tape on the water lines?",
      help: "Bay Area usually no. Offer if the outdoor run is exposed or out of area.",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "sanden-split" },
      options: [
        { id: "no", label: "Not needed" },
        {
          id: "yes",
          label: "Add freeze kit",
          laborHours: 0.75,
          materialCost: 145,
          scopeLines: [
            "Install freeze protection on the outdoor water lines between the Sanden outdoor unit and the tank.",
          ],
        },
      ],
    },
    {
      id: "wh_demo",
      prompt: "Old water heater to remove?",
      type: "single",
      required: true,
      options: [
        { id: "demo", label: "Demo existing water heater", note: "Then how hard", scopeLines: ["Remove your existing water heater, haul it away, and recycle it."] },
        { id: "demo_patch", label: "Demo existing water heater · with patching", note: "Then pull and patch", scopeLines: ["Remove your existing water heater, haul it away, and recycle it."] },
        { id: "by_others", label: "By others", scopeLines: ["By others, removal of existing water heating equipment."] },
        { id: "not_applicable", label: "Not applicable" },
      ],
    },
    {
      id: "wh_demo_pull",
      prompt: "How hard is the pull?",
      type: "single",
      required: true,
      when: { questionId: "wh_demo", oneOf: ["demo", "demo_patch"] },
      options: [
        { id: "easy", label: "Easy · 1 tech · no stairs", laborHours: 0.5 },
        { id: "typical", label: "Typical · 1 tech · harder path", laborHours: 0.75 },
        { id: "two_tech", label: "2 techs", laborHours: 0.9 },
        { id: "hard", label: "Hard · 2 techs", laborHours: 2 },
        { id: "attic", label: "Attic / unusual · 3 techs", laborHours: 3 },
      ],
    },
    {
      id: "wh_demo_patch",
      prompt: "Patch after the old tank?",
      type: "single",
      required: true,
      when: { questionId: "wh_demo", equals: "demo_patch" },
      options: [
        { id: "others", label: "Closet / wall repairs by others", scopeLines: ["By others, proper closet or wall repairs after water heater removal."] },
        { id: "drywall", label: "Minor drywall patch · no paint / texture", materialCost: 19.11, laborHours: 0.25, scopeLines: ["Install rough wall or closet patch as needed after water heater removal. Texture and painting by others or priced separately."] },
        { id: "platform", label: "Remove stand / platform only", laborHours: 0.25, scopeLines: ["Remove the existing water heater stand or platform. Opening left ready for the new work."] },
      ],
    },
    {
      id: "wh_demo_gas",
      prompt: "What happens to the old gas?",
      help: "Indoor tank coming out — cap that location. Extend or modify if the new unit (tankless or otherwise) is somewhere else.",
      type: "single",
      required: true,
      when: [
        { questionId: "wh_demo", oneOf: ["demo", "demo_patch"] },
        { questionId: "wh_job_type", oneOf: ["relocate_5", "relocate", "all_new"] },
      ],
      options: [
        {
          id: "cap",
          label: "Cap gas at the old location",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Cap the old gas line at the water heater we remove.",
          ],
        },
        {
          id: "cap_extend",
          label: "Cap at the old location · extend / modify to the new unit",
          note: "Then the gas run",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Cap the old gas line at the water heater we remove.",
            "Alter and extend the gas line to the new equipment. Install sediment trap and shutoff as required.",
          ],
        },
        {
          id: "already",
          label: "Gas already capped / made safe",
        },
        {
          id: "by_others",
          label: "Gas cap / relocate by others",
          scopeLines: ["Gas cap and any relocate of the old water heater gas by others."],
        },
        {
          id: "not_applicable",
          label: "No gas at the old heater",
        },
      ],
    },
    {
      id: "cabinet_fit",
      prompt: "Will this tank fit through the opening and path?",
      type: "boolean",
      required: true,
      when: { questionId: "wh_style", notEquals: "tankless" },
    },
    {
      id: "wh_access_plan",
      prompt: "How do we get the tank in?",
      type: "single",
      required: true,
      when: { questionId: "cabinet_fit", isFalse: true },
      options: [
        { id: "cut_in_access", label: "Cut in access (Acme)", laborHours: 1.5, materialCost: 60, scopeLines: ["Cut in access sized for the selected water heater."] },
        { id: "owner_access", label: "Owner / others provide access first", scopeLines: ["Owner or others will provide tank access before install day."] },
        { id: "plan_later", label: "Flag for production — plan on site", scopeLines: ["Water heater path flagged tight — production to confirm access before install."] },
      ],
    },
    ...ATTIC_ACCESS_QUESTIONS,
    {
      id: "wh_pan_active",
      prompt: "Drain pan path in place?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    {
      id: "wh_pan_drain",
      prompt: "How does the new pan drain?",
      help: "Existing drain line only if it is proper and working. New PVC if we have to run it.",
      type: "single",
      required: true,
      when: { questionId: "wh_pan_active", equals: "yes" },
      options: [
        {
          id: "reconnect",
          label:
            "Reconnect to existing drain-pan line · I verified it is proper and in good working order",
          laborHours: 0.2,
          scopeLines: [
            "Reconnect the new drain pan to the existing drain line after the advisor verifies it is proper and working.",
          ],
        },
        {
          id: "new",
          label: "New PVC drain from the pan",
          note: "Then run, holes, and where it ends",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Install a new drain pan with a new PVC drain terminated to the exterior.",
          ],
        },
        {
          id: "receptor",
          label: "Short stub to a receptor in the same room",
          laborHours: 0.25,
          materialCost: 12,
          scopeLines: [
            "Install a new drain pan with a short drain stub to a receptor in the same room.",
          ],
        },
      ],
    },
    {
      id: "wh_pan_term",
      prompt: "Where will the pan drain terminate?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "floor_drain", label: "Floor drain" },
        { id: "laundry", label: "Laundry standpipe" },
        { id: "exterior", label: "Exterior" },
        { id: "crawl", label: "Crawl / garage" },
        { id: "receptor", label: "Receptor" },
        { id: "by_others", label: "By others" },
      ],
    },
    {
      id: "wh_pan_run",
      prompt: "How far is the pan drain?",
      help: "Length, access, penetrations, and where it terminates.",
      type: "linear_run",
      linearFamily: "condensate",
      required: true,
      when: { questionId: "wh_pan_drain", equals: "new" },
    },
    {
      id: "wh_pan_pen",
      prompt: "New holes for the pan drain?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "none", label: "No new holes" },
        { id: "wood", label: "Wood" },
        { id: "stucco", label: "Stucco" },
        { id: "brick", label: "Brick / tile" },
      ],
    },
    {
      id: "wh_water_lines",
      prompt: "Reuse the water lines, or new?",
      type: "single",
      required: true,
      options: [
        { id: "not_applicable", label: "Not applicable" },
        { id: "reconnect", label: "Reconnect existing water lines", laborHours: 0.5, materialCost: 30.94, scopeLines: ["Reconnect new water heater to existing hot and cold water lines with new flex connectors and shutoffs as needed."] },
        { id: "alter_5", label: "Alter water lines within 5 ft", laborHours: 0.75, materialCost: 43.68, scopeLines: ["Install hot and cold water connections with flexible connectors as needed."] },
        { id: "new_extend", label: "New or extend water lines", note: "¾\" copper — then feet, access, and holes" },
        { id: "by_others", label: "By others", scopeLines: ["Water line work by others."] },
      ],
    },
    {
      id: "wh_wl_run",
      prompt: "How far is the water line run?",
      help: "New water lines are ¾\" copper. Set feet, access, and holes.",
      type: "linear_run",
      linearFamily: "water",
      required: true,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
    },
    {
      id: "wh_wl_tie",
      prompt: "Where do we tie in water?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
      options: [
        { id: "copper_1", label: "Tie into copper · 1 line" },
        { id: "copper_2", label: "Tie into copper · 2 lines" },
        { id: "galv_1", label: "Tie into galvanized · 1 line" },
        { id: "galv_2", label: "Tie into galvanized · 2 lines" },
      ],
    },
    {
      id: "wh_wl_tie_access",
      prompt: "How hard is the water tie-in?",
      type: "single",
      required: true,
      hidden: true,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
      options: [
        { id: "good", label: "Good access" },
        { id: "medium", label: "Medium" },
        { id: "hard", label: "Hard" },
        { id: "vhard", label: "Very hard" },
      ],
    },
    {
      id: "wh_wl_copper_ft",
      prompt: "How many feet of copper?",
      type: "count",
      required: false,
      hidden: true,
      unitLabel: "ft",
      materialCost: 16.38,
      countMin: 0,
      countMax: 80,
      countStep: 5,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
    },
    {
      id: "wh_wl_copper_diff",
      prompt: "How hard is the copper run?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
      options: [
        { id: "open", label: "Open / easy", laborHours: 0.03 },
        { id: "typical", label: "Typical", laborHours: 0.04 },
        { id: "tight", label: "Tight", laborHours: 0.06 },
      ],
    },
    {
      id: "wh_wl_pen",
      prompt: "Any new water-line holes?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
      options: [
        { id: "none", label: "None" },
        { id: "wood", label: "Wood", laborHours: 0.15, materialCost: 6.37 },
        { id: "stucco", label: "Stucco", laborHours: 0.25, materialCost: 6.37 },
        { id: "brick", label: "Brick / tile", laborHours: 0.4, materialCost: 6.37 },
      ],
    },
    {
      id: "wh_wl_pen_qty",
      prompt: "How many water-line penetrations?",
      type: "count",
      required: false,
      hidden: true,
      unitLabel: "penetrations",
      countMin: 1,
      countMax: 6,
      when: { questionId: "wh_wl_pen", oneOf: ["wood", "stucco", "brick"] },
    },
    {
      id: "wh_wl_stories",
      prompt: "Water line up stories?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_water_lines", equals: "new_extend" },
      options: [
        { id: "1", label: "1 story", laborHours: 0 },
        { id: "2", label: "2 story", laborHours: 0.25 },
        { id: "3", label: "3 story", laborHours: 0.5 },
      ],
    },
    {
      id: "wh_gas_vent",
      prompt: "What happens to the draft hood?",
      type: "single",
      required: true,
      info: "bvent",
      when: [
        { questionId: "wh_style", equals: "gas-tank" },
        { questionId: "wh_vent_kind", notEquals: "pvc" },
      ],
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing B-vent / draft hood. I verified it meets current code",
          scopeLines: [
            "Reconnect the new gas water heater to the existing B-vent / draft hood.",
          ],
        },
        {
          id: "modify",
          label: "Modify / clean up the existing B-vent",
          laborHours: 0.5,
          materialCost: 32,
          scopeLines: [
            "Modify and clean up the existing B-vent and draft hood so the new water heater vents properly.",
          ],
        },
        {
          id: "new_bvent",
          label: "Also — new Type-B vent",
          note: "Then remaining vent + feet",
          scopeLines: ["Install new or altered Type-B vent for the gas water heater."],
        },
        {
          id: "by_others",
          label: "Also — vent work by others",
          scopeLines: ["Gas water heater vent work by others."],
        },
      ],
    },
    {
      id: "wh_gas_vent_remaining",
      prompt: "How much B-vent is left?",
      help: "The new run ties into existing pipe. Is that remaining vent proper?",
      type: "single",
      required: true,
      info: "bvent",
      when: { questionId: "wh_gas_vent", equals: "new_bvent" },
      options: [
        {
          id: "ca_ok",
          label: "Tie in to remaining B-vent. I verified it meets current code",
          scopeLines: [
            "Tie the new or altered Type-B run into the existing vent.",
          ],
        },
        {
          id: "all_new",
          label: "Entire vent is new — nothing existing to verify",
          scopeLines: [
            "Type-B vent is new for this water heater. No existing vent left to verify.",
          ],
        },
        {
          id: "by_others",
          label: "Remaining vent by others",
          scopeLines: ["Remaining Type-B vent work by others."],
        },
      ],
    },
    {
      id: "wh_bvent_run",
      prompt: "How far is the Type-B flue run?",
      type: "linear_run",
      linearFamily: "bvent",
      info: "bvent",
      required: true,
      when: { questionId: "wh_gas_vent", equals: "new_bvent" },
    },
    {
      id: "wh_comfort_valve",
      prompt: "Need the Navien comfort valve?",
      type: "single",
      required: false,
      when: [
        { questionId: "wh_style", equals: "tankless" },
        { questionId: "wh_navien_a", equals: "yes" },
      ],
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "add", label: "Add comfort valve", laborHours: 0.5, scopeLines: ["Install Navien comfort valve so the tankless can maintain a ready loop."] },
      ],
    },
    {
      id: "wh_service_kit",
      prompt: "Need a service valve kit?",
      type: "single",
      required: false,
      when: { questionId: "wh_style", equals: "tankless" },
      options: [
        { id: "include", label: "Include service valve kit", laborHours: 0.25, scopeLines: ["Install manufacturer service valve kit for isolation and flushing."] },
        { id: "existing", label: "Reuse existing service valves" },
      ],
    },
    {
      id: "wh_mount_tankless",
      prompt: "Where do we mount the tankless?",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "tankless" },
      options: [
        { id: "interior", label: "Interior wall mount", scopeLines: ["Mount tankless water heater on approved interior wall."] },
        { id: "exterior", label: "Exterior mount", scopeLines: ["Mount tankless water heater on approved exterior wall."] },
      ],
    },
    {
      id: "wh_tl_vent",
      prompt: "Need high-efficiency PVC vent?",
      type: "single",
      required: true,
      when: { any: [
        { questionId: "wh_style", equals: "tankless" },
        { questionId: "wh_style", equals: "he-gas" },
        { questionId: "wh_vent_kind", equals: "pvc" },
      ] },
      options: [
        { id: "not_applicable", label: "Not applicable" },
        { id: "reconnect", label: "Existing PVC vent is proper · reconnect", materialCost: 25.48, laborHours: 0.75, scopeLines: ["Reconnect the new water heater to the existing high-efficiency PVC vent. Existing vent is proper."] },
        { id: "new_2pipe", label: "New 2-pipe PVC vent", note: "Then feet and access", scopeLines: ["Install new two-pipe PVC intake and exhaust for the high-efficiency water heater."] },
        { id: "exterior_cap", label: "Exterior-mount cap", scopeLines: ["Exterior-mount tankless with manufacturer termination cap."] },
      ],
    },
    {
      id: "wh_tl_vent_run",
      prompt: "How far is the PVC vent run?",
      type: "linear_run",
      linearFamily: "pvc_vent",
      required: true,
      when: { questionId: "wh_tl_vent", equals: "new_2pipe" },
    },
    {
      id: "wh_120_plug",
      prompt: "Need a 120V plug?",
      help: "Tankless and high-efficiency gas tanks need a grounded 120V outlet — not a 240V circuit.",
      type: "single",
      required: true,
      when: { questionId: "wh_style", oneOf: ["tankless", "he-gas"] },
      options: [
        {
          id: "existing",
          label: "Plug into existing 120V outlet",
          laborHours: 0.15,
          scopeLines: [
            "Connect the new water heater to the existing grounded 120-volt outlet at the unit.",
          ],
        },
        {
          id: "add_outlet",
          label: "Add a 120V outlet at the unit",
          note: "Then how far",
          laborHours: 0.75,
          materialCost: 45,
          scopeLines: [
            "Install a new grounded 120-volt outlet at the water heater and plug the unit in.",
          ],
        },
        {
          id: "by_others",
          label: "120V outlet by others",
          scopeLines: ["120-volt outlet for the water heater by others. Plug-in at startup."],
        },
        { id: "not_applicable", label: "Not applicable" },
      ],
    },
    {
      id: "wh_120_plug_run",
      prompt: "How far is the new 120V run?",
      type: "linear_run",
      linearFamily: "electrical",
      required: true,
      when: { questionId: "wh_120_plug", equals: "add_outlet" },
    },
    {
      id: "wh_tl_condensate",
      prompt: "How does condensate drain?",
      type: "single",
      required: true,
      when: { any: [
        { questionId: "wh_style", oneOf: ["tankless", "hybrid", "he-gas"] },
        { questionId: "wh_vent_kind", equals: "pvc" },
      ] },
      options: [
        { id: "gravity", label: "Gravity drain" },
        { id: "pump", label: "Add condensate pump", laborHours: 1.25, materialCost: 185, scopeLines: ["Install condensate pump and discharge to approved location."] },
        { id: "by_others", label: "By others" },
      ],
    },
    {
      id: "wh_tl_cond_path",
      prompt: "Reconnect the condensate drain, or run a new one?",
      help: "Gravity or pump is already set. Reconnect if the existing drain still works; new run if we have to pipe it out.",
      type: "single",
      required: true,
      when: { questionId: "wh_tl_condensate", oneOf: ["gravity", "pump"] },
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing drain",
          laborHours: 0.2,
          scopeLines: [
            "Reconnect condensate to the existing drain after confirming slope and termination.",
          ],
        },
        {
          id: "new",
          label: "New condensate run",
          note: "Then length, access, and holes",
          laborHours: 0.35,
          scopeLines: [
            "Install new condensate drain, properly trapped and terminated.",
          ],
        },
      ],
    },
    {
      id: "wh_tl_cond_run",
      prompt: "How far is the condensate pipe run?",
      type: "linear_run",
      linearFamily: "condensate",
      required: true,
      when: { questionId: "wh_tl_cond_path", equals: "new" },
    },
    {
      id: "wh_hy_noise",
      prompt: "Client OK with hybrid sound here?",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "hybrid" },
      options: [
        { id: "ok", label: "Client is OK with current location" },
        { id: "relocate", label: "Client wants the unit moved" },
      ],
    },
    {
      id: "wh_hy_mixing",
      prompt: "Does this hybrid need a mixing valve?",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "hybrid" },
      options: [
        { id: "caleffi", label: "Add required mixing valve (Caleffi)", materialCost: 218.4, laborHours: 0.75, scopeLines: ["Install 3-way adjustable thermostatic mixing valve on the new hybrid water heater."] },
        { id: "not_needed", label: "Not needed" },
      ],
    },
    {
      id: "wh_hy_duct",
      prompt: "Does this hybrid need ventilation ducting?",
      type: "single",
      required: true,
      when: { questionId: "wh_style", equals: "hybrid" },
      options: [
        { id: "no_duct", label: "Room larger than 700 ft² — no duct" },
        { id: "one", label: "1-duct required", scopeLines: ["Install one ventilation duct for the hybrid water heater."] },
        { id: "two", label: "2-ducts required", scopeLines: ["Install two ventilation ducts for the hybrid water heater."] },
      ],
    },
    {
      id: "wh_drain_pan",
      prompt: "Need a drain pan?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_style", notEquals: "tankless" },
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "add", label: "Add drain pan", laborHours: 0.25, scopeLines: ["Install a water heater drain pan under the new tank."] },
      ],
    },
    {
      id: "wh_stand",
      prompt: "Need a stand?",
      type: "single",
      required: true,
      hidden: true,
      when: { questionId: "wh_style", notEquals: "tankless" },
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "s24", label: "24\" stand · 16\" tall", materialCost: 136.5, laborHours: 0.13, scopeLines: ["Install new water heater equipment stand as needed to elevate water heater."] },
        { id: "s30", label: "30\" stand · 16\" tall", materialCost: 188.27, laborHours: 0.25, scopeLines: ["Install new water heater equipment stand as needed to elevate water heater."] },
        { id: "s34", label: "34\" stand · 16\" tall", materialCost: 190.99, laborHours: 0.25, scopeLines: ["Install new water heater equipment stand as needed to elevate water heater."] },
      ],
    },
    {
      id: "wh_expansion",
      prompt: "Need an expansion tank?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_style", notEquals: "tankless" },
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "add", label: "Add expansion tank", laborHours: 0.35, scopeLines: ["Install expansion tank on the cold water line as required for a closed system."] },
      ],
    },
    {
      id: "wh_prefilter",
      prompt: "Need a pre-filter?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_style", notEquals: "tankless" },
      options: [
        { id: "not_needed", label: "Not needed" },
        { id: "add", label: "Add pre-filter", laborHours: 0.35, scopeLines: ["Install sediment pre-filter on the incoming water line."] },
      ],
    },
    {
      id: "wh_tp",
      prompt: "Can we reuse the T&P drain?",
      help: "The new heater comes with the T&P. This is the drain line only. Reconnect is a CA verify — tap i on that button for code.",
      type: "single",
      required: true,
      info: "tp",
      when: { questionId: "wh_style", notEquals: "tankless" },
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing T&P drain. I verified it meets current code",
          laborHours: 0.15,
          scopeLines: [
            "Reconnect the new water heater T&P to the existing drain line.",
          ],
        },
        {
          id: "new_drain",
          label: "New / reroute the drain",
          laborHours: 0.5,
          materialCost: 22,
          scopeLines: [
            "Install a new T&P drain line from the new water heater to an approved discharge.",
          ],
        },
        {
          id: "by_others",
          label: "Drain work by others",
          scopeLines: ["T&P drain line work by others."],
        },
      ],
    },
    {
      id: "wh_bonding",
      prompt: "Need bonding / dielectric?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "wh_style", notEquals: "tankless" },
      options: [
        { id: "not_needed", label: "Existing bonding OK" },
        { id: "add", label: "Add bonding jumper / dielectrics", laborHours: 0.25, materialCost: 18, scopeLines: ["Install bonding jumper and dielectric unions as required on the new water heater."] },
      ],
    },
    {
      id: "wh_recirc",
      prompt: "Reconnect to existing recirc?",
      help: "Existing loop only. We do not design or price a new recirc system here.",
      type: "single",
      required: true,
      hidden: false,
      options: [
        {
          id: "none",
          label: "No recirc",
          scopeLines: [],
        },
        {
          id: "reattach",
          label: "Reconnect existing recirc",
          laborHours: 0.35,
          scopeLines: [
            "Reconnect the existing recirculation loop to the new water heater.",
          ],
        },
      ],
    },
  ],
};

const gasLineScope: ScopeQuestionnaire = {
  id: "gas_line_v1",
  familyIds: ["furnace", "water_heater", "wall_heater"],
  title: "Gas line",
  blurb: "Same gas package on furnace, tank, tankless, and wall heater. Hidden on electric and hybrid tanks.",
  source: "builtin",
  questions: [
    {
      id: "gas_path",
      prompt: "Reuse the gas line, or new?",
      type: "single",
      required: true,
      when: [
        { questionId: "wh_style", notEquals: "electric-tank" },
        { questionId: "wh_style", notEquals: "hybrid" },
        { questionId: "wh_style", notEquals: "sanden-split" },
      ],
      options: [
        { id: "not_applicable", label: "Not applicable" },
        { id: "by_others", label: "By others", scopeLines: ["Gas line work by others."] },
        {
          id: "reconnect",
          label: "Reconnect existing gas",
          laborHours: 0.25,
          materialCost: 18,
          scopeLines: ["Connect the new unit to the existing gas line. Install sediment trap and shutoff as required."],
        },
        {
          id: "alter",
          label: "Alter / extend existing gas",
          note: "Then pipe type, feet, and access",
          laborHours: 0.5,
          materialCost: 28,
          scopeLines: ["Alter and extend the existing gas line to the new equipment location. Install sediment trap and shutoff as required."],
        },
        {
          id: "new",
          label: "Install new gas line",
          note: "Then pipe type, feet, and access",
          laborHours: 0.75,
          materialCost: 35,
          scopeLines: ["Install a new gas line to the new equipment. Install sediment trap and shutoff as required."],
        },
      ],
    },
    {
      id: "gas_run",
      prompt: "How far is the gas line run?",
      help: "Split stretches if you change pipe or access — e.g. flex in the crawl, then galvanized up the wall.",
      type: "linear_run",
      linearFamily: "gas",
      required: true,
      when: { questionId: "gas_path", oneOf: ["alter", "new"] },
    },
    {
      id: "gas_tie",
      prompt: "Gas tie-in already there?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "gas_path", oneOf: ["alter", "new"] },
      options: [
        { id: "good", label: "Good access", laborHours: 0.25 },
        { id: "medium", label: "Medium", laborHours: 0.5 },
        { id: "hard", label: "Hard", laborHours: 0.75 },
        { id: "vhard", label: "Very hard", laborHours: 1.25 },
      ],
    },
    {
      id: "gas_pen",
      prompt: "Any gas penetrations?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "none", label: "None" },
        { id: "wood", label: "Wood" },
        { id: "stucco", label: "Stucco" },
        { id: "brick", label: "Brick / tile" },
        { id: "roof", label: "Roof" },
      ],
    },
    {
      id: "gas_pen_qty",
      prompt: "How many gas penetrations?",
      type: "count",
      required: false,
      hidden: true,
      unitLabel: "penetrations",
      countMin: 1,
      countMax: 6,
    },
    {
      id: "gas_offsets",
      prompt: "Any hard-pipe offsets?",
      type: "count",
      required: false,
      hidden: true,
      unitLabel: "offsets",
      laborHours: 0.15,
      countMin: 0,
      countMax: 6,
      when: { questionId: "gas_path", oneOf: ["alter", "new"] },
    },
    {
      id: "gas_stories",
      prompt: "Gas line up stories?",
      type: "single",
      required: false,
      hidden: true,
      when: { questionId: "gas_path", oneOf: ["alter", "new"] },
      options: [
        { id: "1", label: "1 story", laborHours: 0 },
        { id: "2", label: "2 story", laborHours: 0.25 },
        { id: "3", label: "3 story", laborHours: 0.5 },
      ],
    },
  ],
};

const electricalScope: ScopeQuestionnaire = {
  id: "electrical_v1",
  familyIds: ["heat_pump", "ac", "air_handler", "water_heater", "ev_charger", "ductless", "humidifier", "dehumidifier"],
  title: "Electrical",
  blurb: "One electrical tree: path, then panel, then wire. Last site block on heat pump, AC, air handler, ductless, and electric/hybrid/tankless water heaters. Rinnai wall heaters use the 120V plug question on that path — not this tree.",
  source: "builtin",
  questions: [
    {
      id: "elec_path",
      prompt: "What power does this unit need?",
      help: "Reconnect what's there, extend it, or run a new circuit. Amp size is already set from this unit.",
      type: "single",
      required: true,
      when: { questionId: "wh_style", notEquals: "gas-tank" },
      options: [
        { id: "new", label: "Install a new dedicated circuit", note: "Then panel, wire stretches, penetrations", laborHours: 1.25, materialCost: 180 },
        { id: "alter", label: "Alter / extend existing circuit", note: "Same breaker — new path, length, or landing", laborHours: 0.5, materialCost: 40 },
        { id: "reconnect", label: "Reconnect existing circuit", note: "Same landing — whip / disconnect only", laborHours: 0.25, materialCost: 25 },
        { id: "by_others", label: "Electrical by others" },
        { id: "not_applicable", label: "Not applicable" },
      ],
    },
    {
      id: "elec_amps",
      prompt: "What size breaker?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "a15_20", label: "15 / 20 amp" },
        { id: "a25_30", label: "25 / 30 amp" },
        { id: "a35_40", label: "35 / 40 amp" },
        { id: "a45_50", label: "45 / 50 amp" },
      ],
    },
    {
      id: "elec_voltage",
      prompt: "What voltage?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "v110", label: "110 / 120V" },
        { id: "v220", label: "220 / 240V" },
      ],
    },
    {
      id: "elec_panel_room",
      prompt: "Does the panel have room for the new breaker?",
      type: "single",
      required: true,
      when: { questionId: "elec_path", equals: "new" },
      options: [
        { id: "yes", label: "Yes — room in the panel. I verified", materialCost: 41.68, laborHours: 0.5 },
        { id: "no", label: "No — panel is full / work by others", scopeLines: ["Existing panel does not have space for a new breaker. Panel work to make space is by others unless listed on this proposal."] },
      ],
    },
    {
      id: "elec_closet",
      prompt: "Is the panel in a closet?",
      type: "single",
      required: true,
      when: { questionId: "elec_path", equals: "new" },
      options: [
        { id: "open", label: "Open / accessible wall" },
        { id: "closet", label: "Closet or enclosed space", scopeLines: ["Panel is in a closet or enclosed space. Relocation, if required, is by others."] },
      ],
    },
    {
      id: "elec_panel_brand",
      prompt: "What panel type?",
      type: "single",
      required: true,
      when: { questionId: "elec_path", equals: "new" },
      options: [
        { id: "standard", label: "Standard / known good" },
        { id: "fpe", label: "FPE — we will not land a breaker" },
        { id: "zinsco", label: "Zinsco — we will not land a breaker" },
        { id: "unknown", label: "Unknown — verify on site" },
      ],
    },
    {
      id: "elec_panel_wall",
      prompt: "How is the panel mounted?",
      type: "single",
      required: true,
      when: { questionId: "elec_path", equals: "new" },
      options: [
        { id: "surface", label: "Surface / exposed" },
        { id: "flush_sheetrock", label: "Flush in sheetrock" },
        { id: "flush_stucco", label: "Flush in stucco" },
      ],
    },
    {
      id: "elec_run",
      prompt: "How far is the new circuit run?",
      help: "Tap Romex, conduit, or both. Slide Easy / Medium / Hard for each. Same idea as the line set page.",
      type: "linear_run",
      linearFamily: "electrical",
      required: true,
      when: { questionId: "elec_path", oneOf: ["alter", "new"] },
    },
    {
      id: "elec_pen",
      prompt: "Any electrical penetrations?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "none", label: "None" },
        { id: "wood", label: "Wood" },
        { id: "stucco", label: "Stucco" },
        { id: "brick", label: "Brick" },
      ],
    },
    {
      id: "elec_pen_qty",
      prompt: "How many electrical penetrations?",
      type: "count",
      required: false,
      hidden: true,
      unitLabel: "penetrations",
      countMin: 1,
      countMax: 6,
    },
  ],
};

const serviceLightScope: ScopeQuestionnaire = {
  id: "service_light_gfi_v1",
  familyIds: ["furnace", "air_handler", "water_heater"],
  title: "Service light / GFI",
  blurb: "Shared indoor service light and GFI. Always last.",
  source: "builtin",
  questions: [
    {
      id: "service_light",
      prompt: "Service light, switch, or GFI at this equipment?",
      type: "single",
      required: false,
      options: [
        { id: "not_applicable", label: "Not applicable" },
        { id: "existing", label: "Existing light and GFI OK" },
        { id: "add_light", label: "Add service light", laborHours: 0.5, materialCost: 35, scopeLines: ["Install service light at the equipment."] },
        { id: "add_gfi", label: "Add GFI receptacle", laborHours: 0.5, materialCost: 45, scopeLines: ["Install GFI receptacle within reach of the equipment."] },
        { id: "add_both", label: "Add service light and GFI", laborHours: 0.75, materialCost: 70, scopeLines: ["Install service light and GFI receptacle at the equipment."] },
        { id: "by_others", label: "By others", scopeLines: ["Service light / GFI by others."] },
      ],
    },
  ],
};

const seismicStrapScope: ScopeQuestionnaire = {
  id: "seismic_strap_v1",
  familyIds: ["water_heater"],
  title: "Earthquake strap",
  blurb: "Tank water heaters only. Include = new straps. Skip = existing straps still good.",
  source: "builtin",
  questions: [
    {
      id: "strap_active",
      prompt: "Straps already in the quote?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    {
      id: "strap_kind",
      prompt: "Need earthquake straps?",
      help: "Code wants the equipment secured. New straps — or leave the existing if they are still good and usable.",
      type: "single",
      required: true,
      when: { questionId: "strap_active", equals: "yes" },
      options: [
        {
          id: "new",
          label: "Install new straps",
          note: "To current code as needed",
          laborHours: 0.4,
          materialCost: 52,
          scopeLines: [
            "Install new proper earthquake strapping system to meet current code requirements as needed.",
          ],
        },
        {
          id: "existing",
          label: "Existing straps are good",
          note: "Still usable — leave in place",
          scopeLines: [
            "Existing earthquake strapping is in good, usable condition and remains in place.",
          ],
        },
      ],
    },
  ],
};

const padScope: ScopeQuestionnaire = {
  id: "pad_v1",
  familyIds: ["heat_pump", "ac", "ductless"],
  title: "Concrete pad",
  blurb: "Asked only when the pad accessory is included or offered.",
  source: "builtin",
  questions: [
    {
      id: "pad_active",
      prompt: "Pad already in the quote?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    {
      id: "pad_base",
      prompt: "What pad is this outdoor unit sitting on?",
      help: "New preformed pad is the standard sit. A pad that’s already there is fine if it’s sound. A poured concrete pad is an extra — include it on extras if you want it bolted down.",
      type: "single",
      required: true,
      when: { questionId: "pad_active", notEquals: "yes" },
      options: [
        {
          id: "preform",
          label: "New preformed pad",
          laborHours: 0.45,
          materialCost: 85,
          scopeLines: [
            "Set a new preformed equipment pad, level and sized for this outdoor unit.",
          ],
        },
        {
          id: "existing",
          label: "Use a pad that’s already there",
          scopeLines: [
            "Set the outdoor unit on the existing pad. Confirm the pad is level and sized for the new unit.",
          ],
        },
      ],
    },
    {
      id: "pad_preform_grade",
      prompt: "Is the ground level?",
      help: "Preformed pads need a level sit. Slope costs extra.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "pad_base", equals: "preform" },
          { questionId: "pad_kind", equals: "preform" },
        ],
      },
      options: [
        {
          id: "flat",
          label: "Level",
          art: "/pad/flat.svg?v=3",
          scopeLines: ["Set the preformed pad on level grade."],
        },
        {
          id: "slope",
          label: "Slight slope",
          art: "/pad/slope.svg?v=3",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Set the preformed pad on a slight slope and shim so the outdoor unit sits level.",
          ],
        },
        {
          id: "steep",
          label: "Steep / needs a stand",
          art: "/pad/steep.svg?v=3",
          laborHours: 0.85,
          materialCost: 45,
          scopeLines: [
            "Build a level sit for the preformed pad on the steep grade so the outdoor unit is secure.",
          ],
        },
      ],
    },
    {
      id: "pad_offer_custom",
      prompt: "Is the optional concrete pad going in the same place?",
      help: "Yes uses this outdoor’s location. We’ll still ask how hard the pour is.",
      type: "single",
      required: true,
      when: [
        { questionId: "pad_base", equals: "preform" },
        {
          any: [
            { questionId: "pad_active", equals: "offer" },
            { questionId: "pad_path", equals: "option" },
          ],
        },
      ],
      options: [
        {
          id: "same",
          label: "Yes — same place",
        },
        {
          id: "different",
          label: "Also — different location",
        },
      ],
    },
    {
      id: "pad_kind",
      prompt: "What pad are we setting on?",
      help: "New pour is what Include / Option prices. A pad that’s already there stays on the list if it is sound.",
      type: "single",
      required: true,
      when: { questionId: "pad_active", equals: "yes" },
      options: [
        {
          id: "new",
          label: "Pour a new pad",
          note: "Then ground, haul-in, and old pad",
          scopeLines: [
            "Pour a new custom concrete pad and set the outdoor unit on it.",
          ],
        },
        {
          id: "existing",
          label: "Use a pad that’s already there",
          scopeLines: [
            "Set the outdoor unit on the existing pad. Confirm the pad is level and sized for the new unit.",
          ],
        },
      ],
    },
    {
      id: "pad_grade",
      prompt: "What's the ground like?",
      help: "Tap the picture. We size the pad to this unit — no size question.",
      type: "single",
      required: true,
      hidden: false,
      when: {
        any: [
          { questionId: "pad_kind", equals: "new" },
          { questionId: "pad_offer_custom", oneOf: ["option", "include", "yes", "same", "different"] },
        ],
      },
      options: [
        {
          id: "flat",
          label: "Level",
          note: "Pad sits flat",
          art: "/pad/flat.svg?v=3",
          scopeLines: ["Pour a new pad on level grade, sized to this outdoor unit."],
        },
        {
          id: "slope",
          label: "Slight slope",
          note: "A little grade",
          art: "/pad/slope.svg?v=3",
          laborHours: 0.55,
          materialCost: 35,
          scopeLines: ["Form and pour the pad on a slight slope, sized to this outdoor unit."],
        },
        {
          id: "hill",
          label: "Steep slope",
          note: "Stepped forms",
          art: "/pad/steep.svg?v=3",
          laborHours: 1.3,
          materialCost: 85,
          scopeLines: ["Form and pour a stepped pad on the steep grade, sized to this outdoor unit."],
        },
        {
          id: "piers",
          label: "Hillside stands",
          note: "Four mounts into the bank",
          art: "/pad/piers.svg?v=3",
          laborHours: 2.4,
          materialCost: 185,
          scopeLines: [
            "Build an elevated pad on four mounts anchored into the hillside and set the outdoor unit on it.",
          ],
        },
      ],
    },
    {
      id: "pad_size",
      prompt: "How big is this pad?",
      type: "single",
      required: false,
      hidden: true,
      when: {
        any: [
          { questionId: "pad_kind", equals: "new" },
          { questionId: "pad_offer_custom", oneOf: ["option", "include", "yes", "same", "different"] },
        ],
      },
      options: [
        {
          id: "standard",
          label: "Standard — sized to this unit",
          scopeLines: [
            "Pad sized to the outdoor unit footprint with required overhang.",
          ],
        },
        {
          id: "oversize",
          label: "Oversized footprint",
          laborHours: 0.4,
          materialCost: 55,
        },
        {
          id: "thick",
          label: 'Extra thick (6")',
          laborHours: 0.45,
          materialCost: 65,
        },
      ],
    },
    {
      id: "pad_haul_in",
      prompt: "How does the concrete get there?",
      help: "This is the labor. Mixer next to the pad is easy. Through the house is not.",
      type: "single",
      required: true,
      hidden: false,
      when: {
        any: [
          { questionId: "pad_kind", equals: "new" },
          { questionId: "pad_offer_custom", oneOf: ["option", "include", "yes", "same", "different"] },
        ],
      },
      options: [
        {
          id: "at_pad",
          label: "Mixer at the pad",
          note: "Truck or mixer parks right there",
          scopeLines: ["Place concrete with the mixer at the pad."],
        },
        {
          id: "short",
          label: "Short wheelbarrow",
          note: "Under 50 feet",
          laborHours: 0.4,
          scopeLines: ["Wheelbarrow concrete a short run to the pad."],
        },
        {
          id: "long",
          label: "Around the house",
          note: "Long walk",
          laborHours: 0.95,
          scopeLines: ["Haul concrete a long run around the house to the pad."],
        },
        {
          id: "inside",
          label: "Through the house",
          note: "Or up stairs",
          laborHours: 1.4,
          scopeLines: [
            "Haul concrete through the house or up stairs to the pad location.",
          ],
        },
      ],
    },
    {
      id: "pad_rebar",
      prompt: "Does this pad need mesh or rebar?",
      type: "single",
      required: false,
      hidden: true,
      when: {
        any: [
          { questionId: "pad_kind", equals: "new" },
          { questionId: "pad_offer_custom", oneOf: ["option", "include", "yes", "same", "different"] },
        ],
      },
      options: [
        { id: "none", label: "No extra steel" },
        { id: "mesh", label: "Wire mesh", laborHours: 0.15, materialCost: 22, scopeLines: ["Set wire mesh in the pad pour."] },
        { id: "rebar", label: "Rebar grid", laborHours: 0.4, materialCost: 48, scopeLines: ["Set a rebar grid in the pad pour."] },
      ],
    },
    {
      id: "pad_haul",
      prompt: "Is there an old pad to haul away?",
      help: "Even on an all-new mini-split they may have left an AC pad.",
      type: "single",
      required: false,
      hidden: true,
      when: {
        any: [
          { questionId: "pad_kind", equals: "new" },
          { questionId: "pad_offer_custom", oneOf: ["option", "include", "yes", "same", "different"] },
        ],
      },
      options: [
        {
          id: "none",
          label: "No old pad",
        },
        {
          id: "haul",
          label: "Yes — haul it",
          laborHours: 0.85,
          materialCost: 45,
          scopeLines: ["Remove and haul away the existing pad."],
        },
        {
          id: "leave",
          label: "Also — leave the old pad",
        },
      ],
    },
    {
      id: "sound_wall",
      prompt: "Need a sound wall?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "none", label: "None" },
        {
          id: "hold",
          label: "Hold",
          scopeLines: [
            "Outdoor sound wall at the condensing unit — design and price to follow.",
          ],
        },
      ],
    },
    {
      id: "disguise_wall",
      prompt: "Need a disguise wall?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "none", label: "None" },
        {
          id: "hold",
          label: "Hold",
          scopeLines: [
            "Privacy / disguise wall at the outdoor unit — design and price to follow.",
          ],
        },
      ],
    },
  ],
};

const bathFanScope: ScopeQuestionnaire = {
  id: "bath_fan_v1",
  familyIds: ["bath_fan"],
  title: "Bath fan site conditions",
  blurb: "Job type first (replace / new / contractor), then CFM, then the fan. Site questions follow that path.",
  source: "builtin",
  questions: [
    {
      id: "fan_visit",
      prompt: "Is this bath fan the only work on this visit?",
      help: "If a crew that should be on a big job is rolling just for a fan, price a trip so the company does not lose the shirt. Hidden when a major is already on this job.",
      type: "single",
      required: true,
      options: [
        {
          id: "with",
          label: "With other work on this job",
          note: "Ride-along — no trip",
        },
        {
          id: "alone",
          label: "This fan is the only work",
          note: "Adds trip labor and dollars so a dedicated visit pencils",
          laborHours: 1.25,
          materialCost: 95,
        },
      ],
    },
    {
      id: "install_type",
      prompt: "How is this bath fan going in?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        {
          id: "replace_existing",
          label: "Replace existing fan",
          scopeLines: [
            "Remove your existing bath fan, haul it away, and recycle it.",
          ],
        },
        {
          id: "cut_in_new",
          label: "Cut in a new fan",
          scopeLines: [
            "Cut in a new bath fan opening per the manufacturer template and framing.",
            "Run new exhaust duct to the exterior with a working damper.",
          ],
        },
        {
          id: "contractor_new",
          label: "New fan for a contractor",
          scopeLines: [
            "Cut in a new bath fan opening per the manufacturer template and framing.",
            "Patch, texture, and paint by others.",
            "Exhaust duct to the exterior by others.",
            "Electrical to the bath fan by others.",
          ],
        },
      ],
    },
    {
      id: "fan_fit",
      prompt: "Will the fan sit in the same opening?",
      type: "single",
      required: true,
      when: { questionId: "install_type", equals: "replace_existing" },
      options: [
        {
          id: "yes",
          label: "Yes — same opening, no extra cut",
        },
        {
          id: "no",
          label: "No — we have to open the ceiling",
          note: "Then surface and patch",
        },
      ],
    },
    {
      id: "fan_surface",
      prompt: "What is the ceiling or wall we are cutting?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "install_type", equals: "cut_in_new" },
          { questionId: "fan_fit", equals: "no" },
        ],
      },
      options: [
        {
          id: "sheetrock",
          label: "Sheetrock",
          laborHours: 0.35,
          materialCost: 22,
          scopeLines: [
            "Acme HVAC will install a rough patch at the opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "plaster",
          label: "Lath and plaster",
          laborHours: 0.65,
          materialCost: 32,
          scopeLines: [
            "Acme HVAC will install a rough plaster patch at the opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "tile_ceiling",
          label: "Tile ceiling",
          laborHours: 0.85,
          materialCost: 28,
          scopeLines: [
            "Cut the tile ceiling as needed for the new fan. We will take care to minimize dust. Tile work cannot be returned to showroom condition — some residual dust is expected.",
            "Acme HVAC will install a rough patch at the opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "tile_wall",
          label: "Tile wall",
          laborHours: 0.85,
          materialCost: 28,
          scopeLines: [
            "Cut the tile wall as needed for the new fan. We will take care to minimize dust. Tile work cannot be returned to showroom condition — some residual dust is expected.",
            "Acme HVAC will install a rough patch at the opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "by_contractor",
          label: "Finish by contractor",
          scopeLines: [
            "Opening cut per the manufacturer template. Patch, texture, and paint by others.",
          ],
        },
      ],
    },
    {
      id: "fan_duct",
      prompt: "What about the exhaust duct?",
      type: "single",
      required: true,
      when: { questionId: "install_type", equals: "replace_existing" },
      options: [
        {
          id: "reuse",
          label: "Reuse existing — it already goes outdoors",
          scopeLines: [
            "Reuse the existing exhaust duct to the exterior and confirm the damper.",
          ],
        },
        {
          id: "new",
          label: "Run new duct to the exterior",
          laborHours: 1.25,
          materialCost: 85,
          scopeLines: [
            "Run new exhaust duct to the exterior with a working damper.",
          ],
        },
        {
          id: "by_others",
          label: "Duct work by others",
          scopeLines: ["Exhaust duct to the exterior by others."],
        },
      ],
    },
    {
      id: "fan_elec",
      prompt: "Where is this circuit coming from?",
      help: "Attic steal is short if the wire is already there and you verified it. New circuit is from the panel. Reconnect if 120 is already at the fan.",
      type: "single",
      required: true,
      options: [
        {
          id: "attic",
          label: "Tie into existing attic wire",
          note: "Verified proper to use — short run",
          laborHours: 0.45,
          materialCost: 28,
          scopeLines: [
            "Tie into existing attic wiring, verified proper for this fan.",
          ],
        },
        {
          id: "in_place",
          label: "120V is already at the fan",
          laborHours: 0.2,
          materialCost: 12,
          scopeLines: ["Reconnect the existing 120-volt at the fan."],
        },
        {
          id: "by_others",
          label: "Electrical by others",
          scopeLines: ["Electrical to the bath fan by others."],
        },
        {
          id: "new",
          label: "Install a new circuit from the panel",
          note: "Then where the panel is",
          laborHours: 0.75,
          materialCost: 65,
          scopeLines: ["Install a new 120-volt circuit to the bath fan."],
        },
      ],
    },
    {
      id: "fan_panel_where",
      prompt: "Where is the panel?",
      help: "This is what you measure — upstairs closet, garage, or the main at the meter.",
      type: "single",
      required: true,
      when: { questionId: "fan_elec", equals: "new" },
      options: [
        {
          id: "upstairs_closet",
          label: "Upstairs closet",
        },
        {
          id: "garage",
          label: "Garage",
        },
        {
          id: "main_meter",
          label: "Main at the meter",
        },
        {
          id: "other",
          label: "Other panel location",
        },
      ],
    },
    {
      id: "fan_needs_switch",
      prompt: "Need a wall switch for this fan?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        { id: "yes", label: "Needs a wall switch" },
        { id: "no", label: "Sensors — no switch required" },
      ],
    },
    {
      id: "fan_switch",
      prompt: "Need a wall switch for this fan?",
      help: "A new switch in a finished bath means open wall, top plate, maybe a joist block. Acme leaves a rough patch. Texture and paint stay with the owner.",
      type: "single",
      required: true,
      when: { questionId: "fan_needs_switch", equals: "yes" },
      options: [
        {
          id: "new_switch",
          label: "Install a new wall switch",
          note: "Usual on a new fan",
          laborHours: 0.85,
          materialCost: 42,
          scopeLines: [
            "Install a new wall switch for the bath fan.",
          ],
        },
        {
          id: "existing_switch",
          label: "Use the existing switch",
          scopeLines: ["Reuse the existing wall switch for the bath fan."],
        },
        {
          id: "by_others",
          label: "Switch by others",
          scopeLines: ["Wall switch for the bath fan by others."],
        },
      ],
    },
    {
      id: "fan_switch_add",
      prompt: "Add a manual wall switch?",
      help: "Sense and humidity fans meet code without a switch. Offer one only if they want a manual override.",
      type: "single",
      required: true,
      when: { questionId: "fan_needs_switch", equals: "no" },
      options: [
        {
          id: "no",
          label: "No switch — sensors do the job",
        },
        {
          id: "override",
          label: "Add a manual override switch",
          note: "Then how we feed it",
          laborHours: 0.85,
          materialCost: 42,
          scopeLines: [
            "Install a manual override wall switch for the bath fan.",
          ],
        },
      ],
    },
    {
      id: "fan_switch_feed",
      prompt: "How do we feed the switch?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "fan_switch", equals: "new_switch" },
          { questionId: "fan_switch_add", equals: "override" },
        ],
      },
      options: [
        {
          id: "fan_then_down",
          label: "Power to the fan, then down to the switch",
          note: "Usual",
          scopeLines: [
            "Feed power to the fan and drop a switch leg to the wall.",
          ],
        },
        {
          id: "switch_then_up",
          label: "Power to the switch, then up to the fan",
          scopeLines: [
            "Feed power to the wall switch and run the switched leg up to the fan.",
          ],
        },
        {
          id: "drop_leg",
          label: "Hot already at the ceiling — drop a switch leg",
          scopeLines: [
            "Existing hot at the fan. Drop a switch leg to the new wall switch.",
          ],
        },
      ],
    },
    {
      id: "fan_switch_path",
      prompt: "What’s between us and that switch?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "fan_switch", equals: "new_switch" },
          { questionId: "fan_switch_add", equals: "override" },
        ],
      },
      options: [
        {
          id: "open_plate",
          label: "Open the wall / drill the top plate",
          note: "Usual",
          laborHours: 0.45,
          materialCost: 18,
        },
        {
          id: "joist_block",
          label: "Joist block we cannot drill",
          laborHours: 0.75,
          materialCost: 22,
        },
        {
          id: "chase",
          label: "Chase is already there — no finish work",
        },
        {
          id: "tile",
          label: "Tile at the switch",
          laborHours: 0.85,
          materialCost: 28,
          scopeLines: [
            "Cut the tile at the switch as needed. We will take care to minimize dust. Tile work cannot be returned to showroom condition — some residual dust is expected.",
          ],
        },
      ],
    },
    {
      id: "fan_switch_patch",
      prompt: "Who finishes the switch opening?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "fan_switch_path", equals: "open_plate" },
          { questionId: "fan_switch_path", equals: "joist_block" },
          { questionId: "fan_switch_path", equals: "tile" },
        ],
      },
      options: [
        {
          id: "sheetrock",
          label: "Sheetrock",
          laborHours: 0.35,
          materialCost: 22,
          scopeLines: [
            "Acme HVAC will install a rough patch at the switch opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "plaster",
          label: "Lath and plaster",
          laborHours: 0.65,
          materialCost: 32,
          scopeLines: [
            "Acme HVAC will install a rough plaster patch at the switch opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "tile",
          label: "Tile",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Acme HVAC will install a rough patch at the switch opening. Texture and paint are by the owner.",
          ],
        },
      ],
    },
    {
      id: "fan_cfm",
      prompt: "Set this fan to?",
      type: "single",
      required: false,
      hidden: true,
      options: [
        {
          id: "50",
          label: "50 CFM",
          scopeLines: ["Set the fan to 50 CFM for this bathroom."],
        },
        {
          id: "80",
          label: "80 CFM",
          scopeLines: ["Set the fan to 80 CFM for this bathroom."],
        },
        {
          id: "110",
          label: "110 CFM",
          scopeLines: ["Set the fan to 110 CFM for this bathroom."],
        },
      ],
    },
    {
      id: "fan_elec_run",
      prompt: "New 120V run to the fan",
      type: "linear_run",
      linearFamily: "electrical",
      required: true,
      when: { questionId: "fan_elec", equals: "new" },
    },
  ],
};

const electricalJobScope: ScopeQuestionnaire = {
  id: "electrical_job_v1",
  familyIds: ["electrical"],
  title: "Electrical job",
  blurb: "Standalone tool-belt electrical — not the outdoor disconnect, not the heat-pump tree.",
  source: "builtin",
  questions: [
    {
      id: "ejob_light_kind",
      prompt: "Light, switch, or both?",
      type: "single",
      required: true,
      hidden: true,
      when: { questionId: "ejob", equals: "light" },
      options: [
        {
          id: "both",
          label: "Light and switch",
          scopeLines: [
            "Install a new light and a matching wall switch, concealed, to meet code.",
          ],
        },
        {
          id: "light_only",
          label: "Light only",
          scopeLines: [
            "Install a new light on this circuit. No new wall switch on this measure.",
          ],
        },
        {
          id: "switch_only",
          label: "Switch only",
          scopeLines: [
            "Install a new wall switch for the existing light.",
          ],
        },
      ],
    },
    {
      id: "ejob",
      prompt: "What electrical work is this?",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "c120", label: "New 120-volt circuit" },
        { id: "c240", label: "New 240-volt circuit" },
        { id: "gfi", label: "GFCI / receptacle" },
        { id: "light", label: "Light and wall switch" },
        { id: "sub", label: "Sub panel" },
        { id: "custom", label: "Custom electrical" },
      ],
    },
    {
      id: "ejob_visit",
      prompt: "Is this electrical the only work on this visit?",
      help: "A dedicated roll for a receptacle or a light needs trip labor so the company does not lose the shirt. Hidden when a major is already on this job.",
      type: "single",
      required: true,
      options: [
        { id: "with", label: "With other work on this job", note: "Ride-along — no trip" },
        {
          id: "alone",
          label: "This is the only work",
          note: "Adds trip labor",
          laborHours: 1.5,
          materialCost: 85,
        },
      ],
    },
    {
      id: "ejob_240_load",
      prompt: "What is this 240-volt circuit for?",
      help: "That sets the amp size. A dryer is not a car charger.",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "c240" },
      options: [
        {
          id: "dryer",
          label: "Dryer",
          note: "30 amp",
          laborHours: 0.35,
          materialCost: 45,
          scopeLines: [
            "Install a new 30-amp, 240-volt dryer circuit, breaker, and receptacle to meet code and the appliance listing.",
          ],
        },
        {
          id: "range",
          label: "Range / oven",
          note: "40 amp",
          laborHours: 0.45,
          materialCost: 65,
          scopeLines: [
            "Install a new 40-amp, 240-volt range circuit, breaker, and receptacle to meet code and the appliance listing.",
          ],
        },
        {
          id: "ev",
          label: "Car charger",
          note: "50 amp",
          laborHours: 0.55,
          materialCost: 95,
          scopeLines: [
            "Install a new 50-amp, 240-volt circuit for a Level 2 car charger, including the breaker and listed receptacle or hard-wire landing.",
          ],
        },
        {
          id: "other",
          label: "Other 240-volt load",
          note: "30 amp typical — confirm the nameplate",
          laborHours: 0.35,
          materialCost: 45,
          scopeLines: [
            "Install a new 240-volt circuit, breaker, and landing sized to the nameplate of this equipment.",
          ],
        },
      ],
    },
    {
      id: "ejob_120_kind",
      prompt: "What is this 120-volt circuit for?",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "c120" },
      options: [
        {
          id: "outlet",
          label: "New receptacle",
          scopeLines: [
            "Install a new 120-volt, 15/20-amp circuit and receptacle to meet code.",
          ],
        },
        {
          id: "dedicated",
          label: "Dedicated circuit for equipment",
          scopeLines: [
            "Install a new dedicated 120-volt, 15/20-amp circuit for this equipment.",
          ],
        },
        {
          id: "outdoor",
          label: "Outdoor / weather-protected",
          scopeLines: [
            "Install a new 120-volt outdoor circuit with a weather-protected GFCI receptacle.",
          ],
        },
      ],
    },
    {
      id: "ejob_gfi_kind",
      prompt: "What GFCI work?",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "gfi" },
      options: [
        {
          id: "replace",
          label: "Replace the existing receptacle with GFCI",
          laborHours: 0.35,
          materialCost: 28,
          scopeLines: [
            "Replace the existing receptacle with a listed GFCI device and confirm it trips and resets.",
          ],
        },
        {
          id: "new",
          label: "Add a new GFCI receptacle",
          note: "Then where the power comes from",
          laborHours: 0.55,
          materialCost: 38,
          scopeLines: [
            "Install a new listed GFCI receptacle and confirm it trips and resets.",
          ],
        },
      ],
    },
    {
      id: "ejob_custom",
      prompt: "Describe this electrical work",
      help: "This becomes the title and the first line on the packet. Keep it something a homeowner can read.",
      type: "text",
      required: true,
      when: { questionId: "ejob", equals: "custom" },
      placeholder: "Example: Relocate the garage opener outlet and add a disconnect",
    },
    {
      id: "ejob_source",
      prompt: "Where is this circuit coming from?",
      help: "Attic steal is short if the wire is already there and you verified it. New is from the panel. A light job is usually 15/20 amp — not a 50-amp feeder.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ejob", equals: "c120" },
          { questionId: "ejob", equals: "c240" },
          { questionId: "ejob", equals: "light" },
          { questionId: "ejob_gfi_kind", equals: "new" },
        ],
      },
      options: [
        {
          id: "attic",
          label: "Tie into existing wire nearby",
          note: "Verified proper to use — short run",
          laborHours: 0.45,
          materialCost: 28,
          scopeLines: [
            "Tie into existing wiring, verified proper for this load, and extend to the new landing.",
          ],
        },
        {
          id: "in_place",
          label: "Power is already at this location",
          laborHours: 0.2,
          materialCost: 12,
          scopeLines: [
            "Reconnect and land on the existing 120-volt at this location.",
          ],
        },
        {
          id: "by_others",
          label: "Electrical by others",
          scopeLines: ["Electrical work described here is by others."],
        },
        {
          id: "new",
          label: "Install a new circuit from the panel",
          note: "Then where the panel is",
          laborHours: 0.85,
          materialCost: 75,
        },
      ],
    },
    {
      id: "ejob_panel",
      prompt: "Where is the panel?",
      help: "This is what you measure — upstairs closet, garage, or the main at the meter.",
      type: "single",
      required: true,
      when: { questionId: "ejob_source", equals: "new" },
      options: [
        { id: "upstairs_closet", label: "Upstairs closet" },
        { id: "garage", label: "Garage" },
        { id: "main_meter", label: "Main at the meter" },
        { id: "other", label: "Other panel location" },
      ],
    },
    {
      id: "ejob_run",
      prompt: "How far is the new wire run?",
      type: "linear_run",
      linearFamily: "electrical",
      required: true,
      when: { questionId: "ejob_source", equals: "new" },
    },
    {
      id: "ejob_switch",
      prompt: "Need a wall switch?",
      help: "A new switch in a finished room means open wall, top plate, maybe a joist block. Acme leaves a rough patch. Texture and paint stay with the owner. No exposed work in a living space.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ejob_light_kind", equals: "both" },
          { questionId: "ejob_light_kind", equals: "switch_only" },
        ],
      },
      options: [
        {
          id: "new_switch",
          label: "Install a new wall switch",
          note: "Usual",
          laborHours: 0.85,
          materialCost: 42,
          scopeLines: ["Install a new wall switch for this light."],
        },
        {
          id: "existing_switch",
          label: "Use the existing switch",
          scopeLines: ["Reuse the existing wall switch for this light."],
        },
        {
          id: "by_others",
          label: "Switch by others",
          scopeLines: ["Wall switch by others."],
        },
      ],
    },
    {
      id: "ejob_switch_feed",
      prompt: "How do we feed the switch?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ejob_switch", equals: "new_switch" },
          { questionId: "ejob_light_kind", equals: "switch_only" },
        ],
      },
      options: [
        {
          id: "fan_then_down",
          label: "Power to the fixture, then down to the switch",
          note: "Usual",
          scopeLines: [
            "Feed power to the fixture and drop a switch leg to the wall.",
          ],
        },
        {
          id: "switch_then_up",
          label: "Power to the switch, then up to the fixture",
          scopeLines: [
            "Feed power to the wall switch and run the switched leg up to the fixture.",
          ],
        },
        {
          id: "drop_leg",
          label: "Hot already at the box — drop a switch leg",
          scopeLines: [
            "Existing hot at the fixture. Drop a switch leg to the new wall switch.",
          ],
        },
      ],
    },
    {
      id: "ejob_switch_path",
      prompt: "What’s between us and that switch?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ejob_switch", equals: "new_switch" },
          { questionId: "ejob_light_kind", equals: "switch_only" },
        ],
      },
      options: [
        {
          id: "open_plate",
          label: "Open the wall / drill the top plate",
          note: "Usual",
          laborHours: 0.45,
          materialCost: 18,
        },
        {
          id: "joist_block",
          label: "Joist block we cannot drill",
          laborHours: 0.75,
          materialCost: 22,
        },
        { id: "chase", label: "Chase is already there — no finish work" },
        {
          id: "tile",
          label: "Tile at the switch",
          laborHours: 0.85,
          materialCost: 28,
          scopeLines: [
            "Cut the tile at the switch as needed. We will take care to minimize dust. Tile work cannot be returned to showroom condition — some residual dust is expected.",
          ],
        },
      ],
    },
    {
      id: "ejob_switch_patch",
      prompt: "Who finishes the switch opening?",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "ejob_switch_path", equals: "open_plate" },
          { questionId: "ejob_switch_path", equals: "joist_block" },
          { questionId: "ejob_switch_path", equals: "tile" },
        ],
      },
      options: [
        {
          id: "sheetrock",
          label: "Sheetrock",
          laborHours: 0.35,
          materialCost: 22,
          scopeLines: [
            "Acme HVAC will install a rough patch at the switch opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "plaster",
          label: "Lath and plaster",
          laborHours: 0.65,
          materialCost: 32,
          scopeLines: [
            "Acme HVAC will install a rough plaster patch at the switch opening. Texture and paint are by the owner.",
          ],
        },
        {
          id: "tile",
          label: "Tile",
          laborHours: 0.35,
          materialCost: 18,
          scopeLines: [
            "Acme HVAC will install a rough patch at the switch opening. Texture and paint are by the owner.",
          ],
        },
      ],
    },
    {
      id: "ejob_sub_why",
      prompt: "Why this sub panel?",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "sub" },
      options: [
        {
          id: "full",
          label: "Main is full — no breaker spaces",
          scopeLines: [
            "The main panel does not have physical space for another breaker.",
          ],
        },
        {
          id: "distance",
          label: "Load is far from the main",
          scopeLines: [
            "The new load is far from the main. A sub panel is the clean way to land it.",
          ],
        },
        {
          id: "outdoor",
          label: "Outdoor / garage main is tight",
          scopeLines: [
            "The existing outdoor or garage panel is tight. A sub panel gives the new load a proper home.",
          ],
        },
      ],
    },
    {
      id: "ejob_sub_where",
      prompt: "Where does the sub panel go?",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "sub" },
      options: [
        {
          id: "garage",
          label: "Garage",
          scopeLines: ["Install the new sub panel in the garage."],
        },
        {
          id: "next_main",
          label: "Next to the main",
          scopeLines: ["Install the new sub panel next to the main panel."],
        },
        {
          id: "exterior",
          label: "Exterior wall",
          scopeLines: ["Install a weather-rated sub panel on the exterior wall."],
        },
        {
          id: "other",
          label: "Other location",
          scopeLines: ["Install the new sub panel at the agreed location."],
        },
      ],
    },
    {
      id: "ejob_sub_spaces",
      prompt: "How many spaces?",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "sub" },
      options: [
        { id: "s8", label: "8 space", scopeLines: ["Provide an 8-space sub panel."] },
        { id: "s12", label: "12 space", scopeLines: ["Provide a 12-space sub panel."] },
        { id: "s20", label: "20 space", scopeLines: ["Provide a 20-space sub panel."] },
        { id: "s24", label: "24 space", scopeLines: ["Provide a 24-space sub panel."] },
      ],
    },
    {
      id: "ejob_sub_feeder",
      prompt: "Feeder from the main panel?",
      help: "This is the large run. Conduit if the path is exposed or outdoor.",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "sub" },
      options: [
        {
          id: "we_run",
          label: "Acme runs the feeder",
          note: "Then the run",
          laborHours: 1.75,
          materialCost: 220,
          scopeLines: [
            "Install a properly sized feeder from the main panel to the new sub panel, land the ground and neutrals, and label the new panel.",
          ],
        },
        {
          id: "by_others",
          label: "Feeder by others",
          scopeLines: [
            "Feeder from the main to the sub panel by others. Acme lands and labels after the feeder is ready.",
          ],
        },
      ],
    },
    {
      id: "ejob_sub_feeder_run",
      prompt: "How far is the feeder?",
      type: "linear_run",
      linearFamily: "electrical",
      required: true,
      when: { questionId: "ejob_sub_feeder", equals: "we_run" },
    },
    {
      id: "ejob_sub_move",
      prompt: "Move existing circuits?",
      type: "single",
      required: true,
      when: { questionId: "ejob", equals: "sub" },
      options: [
        {
          id: "move",
          label: "Move circuits off the main onto the sub",
          laborHours: 0.75,
          materialCost: 35,
          scopeLines: [
            "Move existing circuits from the full main onto the new sub panel so the new load lands on a proper breaker.",
          ],
        },
        {
          id: "new_only",
          label: "New load only — leave existing circuits",
          scopeLines: [
            "Land the new load on the sub panel. Existing circuits stay on the main.",
          ],
        },
      ],
    },
  ],
};


const DUCT_BUILD_WHEN: ScopeWhen = {
  any: [
    { questionId: "duct_plan", oneOf: ["replace", "add"] },
    { questionId: "duct_offer_new", equals: "yes" },
  ],
};

export const DUCT_BUILD_QUESTION_IDS = [
  "duct_material",
  "duct_material_opts",
  "duct_where",
  "duct_attic_diff",
  "duct_crawl_diff",
  "duct_crawl_mix",
  "duct_garage_kd",
  "duct_enlarge",
  "duct_enlarge_qty",
  "duct_cutin",
  "duct_cutin_qty",
  "duct_tile",
  "duct_add_qty",
  "duct_run_qty",
  "duct_run_ft",
] as const;

export function isDuctOfferBuild(a: ScopeAnswers | null | undefined): boolean {
  const plan = String(a?.duct_plan || "");
  return a?.duct_offer_new === "yes" && (plan === "reconnect" || plan === "meets");
}

export function ductWhereLiveIds(families: string[]): string[] {
  const f = new Set(families || []);
  const ducted = ["heat_pump", "furnace", "ac", "air_handler", "coil"].some(
    (id) => f.has(id),
  );
  const pkg = f.has("package_unit");
  const mini = f.has("ductless") && !ducted && !pkg;
  if (mini) return ["inside", "soffit", "attic"];
  if (pkg && !ducted) return ["roof_curb", "attic", "inside", "garage"];
  const ids = ["attic", "crawl", "garage", "inside", "soffit"];
  if (pkg) ids.push("roof_curb");
  return ids;
}

export const ALL_DUCT_WHERE_IDS = [
  "attic",
  "crawl",
  "garage",
  "inside",
  "soffit",
  "roof_curb",
] as const;

function whenParentAnswered(rule: ScopeWhen, answers: ScopeAnswers): boolean {
  if ("any" in rule) return rule.any.some((r) => whenParentAnswered(r, answers));
  if (!("questionId" in rule)) return true;
  const v = answers[rule.questionId];
  if (v == null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

export function shadedSiteQuestions(
  quiz: ScopeQuestionnaire | null | undefined,
  answers: ScopeAnswers,
): ScopeQuestion[] {
  if (!quiz) return [];
  return quiz.questions.filter((q) => {
    if (q.hidden) return false;
    if (isQuestionVisible(q, answers || {})) return false;
    if (!q.when) return false;
    const rules = Array.isArray(q.when) ? q.when : [q.when];
    return rules.every((r) => whenParentAnswered(r, answers || {}));
  });
}

const ductworkScope: ScopeQuestionnaire = {
  id: "ductwork_v1",
  familyIds: ["ductwork"],
  title: "Ductwork",
  blurb:
    "One measure: reconnect, already-meets, tune-up, replace, or add a run. HERS / required CFM lives here — not a separate tune-up chip.",
  questions: [
    {
      id: "duct_plan",
      prompt: "Keep the ducts, or replace?",
      help: "Reconnect if the system is good. Tune-up if it needs sealing and airflow work. Replace when it will not deliver the CFM this equipment needs. Recently replaced = reconnect only.",
      type: "single",
      required: true,
      options: [
        {
          id: "reconnect",
          label: "Reconnect to existing ducts",
          note: "Connections proper · existing stays",
          laborHours: 1.5,
          materialCost: 85,
          scopeLines: [
            "Reconnect the new equipment to the existing duct system. Seal and secure every new connection so it is airtight and meets manufacturer requirements.",
          ],
          benefitLines: [
            "Existing ducts stay. New connections are sealed so the equipment can actually use them.",
          ],
        },
        {
          id: "meets",
          label: "Ducts recently replaced · meet requirements",
          note: "No duct work beyond reconnect",
          laborHours: 0.75,
          materialCost: 40,
          scopeLines: [
            "Existing duct system was recently replaced and meets the airflow and HERS requirements for this equipment. Reconnect only — seal new connections at the equipment.",
          ],
        },
        {
          id: "tune",
          label: "Tune-up existing ducts",
          note: "Seal + airflow so it can meet HERS / required CFM",
          laborHours: 4,
          materialCost: 280,
          scopeLines: [
            "Tune and seal the existing duct system so it can meet HERS and the airflow this equipment needs. Seal accessible joints, takeoffs, and returns. Repair crushed or disconnected sections in the work path.",
          ],
          benefitLines: [
            "Existing ducts brought up so this equipment can move the air it was designed for.",
          ],
        },
        {
          id: "replace",
          label: "Replace the duct system",
          note: "New ducts sized for this equipment",
          laborHours: 10,
          materialCost: 1600,
          scopeLines: [
            "Remove accessible existing ducts in the work areas and install a new duct system sized for this equipment. All new ducts insulated per manufacturer and code requirements. Hard metal fittings at full-radius turns so flex is not crushed and airflow stays open.",
          ],
          benefitLines: [
            "New ducts built for this equipment — not leftover pipe from an old furnace.",
          ],
        },
        {
          id: "add",
          label: "Add run(s) only",
          note: "One or two extra supplies / returns",
          laborHours: 2.25,
          materialCost: 160,
          scopeLines: [
            "Add the scoped supply or return runs and connect them to the existing system. Seal new connections.",
          ],
        },
      ],
    },
    {
      id: "duct_cfm",
      prompt: "Will the existing ducts deliver the CFM this equipment needs?",
      help: "About 400 CFM per ton. A 3-ton needs ~1,200 CFM. If you are not sure, treat it as no and offer replacement.",
      type: "single",
      required: true,
      when: { questionId: "duct_plan", oneOf: ["reconnect", "tune"] },
      options: [
        {
          id: "yes",
          label: "Yes — sized for this equipment",
          scopeLines: [
            "Existing ducts are sized to deliver the airflow this equipment needs.",
          ],
        },
        {
          id: "no",
          label: "No — undersized or restricted",
          scopeLines: [
            "The existing ducts are undersized or restricted for this equipment.",
          ],
        },
        {
          id: "unknown",
          label: "Not verified on site",
          scopeLines: [
            "Existing duct airflow was not verified on site. We will commission to the airflow we can achieve; replacement remains recommended if rooms starve.",
          ],
        },
      ],
    },
    {
      id: "duct_tune_qty",
      prompt: "How many ducts need to be tuned up to meet HERS?",
      help: "Count the runs we will seal and set so this equipment can pass HERS / required CFM. That is the whole tune-up — not a full duct replacement.",
      type: "count",
      required: true,
      countMin: 1,
      countMax: 16,
      countStep: 1,
      unitLabel: "ducts",
      laborHours: 0.175,
      materialCost: 10,
      when: { questionId: "duct_plan", equals: "tune" },
      scopeLines: [
        "Tune and seal {count} existing duct run(s) so the system can meet HERS and the airflow this equipment needs.",
      ],
    },
    {
      id: "duct_offer_new",
      prompt: "Offer new ducts as a recommended option?",
      help: "If the existing system is not ideal, put replacement on the packet as a company recommendation so it is in writing.",
      type: "single",
      required: true,
      when: {
        any: [
          { questionId: "duct_plan", oneOf: ["reconnect", "meets"] },
          { questionId: "duct_cfm", oneOf: ["no", "unknown"] },
        ],
      },
      options: [
        {
          id: "yes",
          label: "Yes — recommended option",
          benefitLines: [
            "Replacement ducts offered as a recommended option so you can decide with the numbers in front of you.",
          ],
          scopeLines: [
            "We recommend replacing the existing duct system so the new equipment can deliver its rated airflow. That option is priced on this proposal.",
          ],
        },
        {
          id: "no",
          label: "No — existing only",
        },
      ],
    },
    {
      id: "duct_material",
      prompt: "What duct material?",
      help: "Pick the one we are installing. Wire flex is the usual. Aluma flex if they asked. KD 26-ga through a garage — fire-rated, then a jacket so it matches the house.",
      type: "single",
      required: true,
      when: DUCT_BUILD_WHEN,
      options: [
        {
          id: "flex",
          label: "Wire flex · R-8",
          note: "25-ft sticks · code default",
          materialCost: 0,
          scopeLines: [
            "New duct sections are R-8 insulated wire-helix flexible duct, installed to manufacturer stretch and support requirements.",
          ],
        },
        {
          id: "luma",
          label: "Aluma flex",
          note: "Shorter sticks · more joints",
          laborHours: 1.25,
          materialCost: 220,
          scopeLines: [
            "Use Aluma flex where specified. Joints sealed at each connection.",
          ],
        },
        {
          id: "kd",
          label: "KD 26-ga + jacket",
          note: "Garage / fire-rated · jacket matches the house",
          laborHours: 2.5,
          materialCost: 480,
          scopeLines: [
            "Where ducts pass a garage or other fire-rated space, run fire-rated galvanized steel with approved fittings. Pull a matching insulated jacket over the steel so the finished run looks like the rest of the system.",
          ],
        },
      ],
    },
    {
      id: "duct_material_opts",
      prompt: "Also price these as customer options?",
      help: "Optional. Tap every other material you want on the packet. Skip if this job is only the one you just picked.",
      type: "multi",
      required: false,
      when: DUCT_BUILD_WHEN,
      options: [
        { id: "flex", label: "Also offer wire flex", materialCost: 0 },
        {
          id: "luma",
          label: "Also offer Aluma flex",
          laborHours: 1.25,
          materialCost: 220,
        },
        {
          id: "kd",
          label: "Also offer KD 26-ga + jacket",
          laborHours: 2.5,
          materialCost: 480,
        },
      ],
    },
    {
      id: "duct_where",
      prompt: "Where do the ducts run?",
      help: "Tap every place we work. Garage opens the KD path. Crawl asks how much is tight.",
      type: "multi",
      required: true,
      when: DUCT_BUILD_WHEN,
      options: [
        { id: "attic", label: "Attic", laborHours: 0.25 },
        { id: "crawl", label: "Crawl / basement", laborHours: 0.25 },
        {
          id: "garage",
          label: "Garage",
          laborHours: 1,
          scopeLines: [
            "A portion of the run is through a garage and will be fire-rated galvanized steel with an insulated jacket.",
          ],
        },
        {
          id: "inside",
          label: "Inside the house",
          note: "Drop ceiling / closet / conditioned",
          laborHours: 0.25,
        },
      ],
    },
    {
      id: "duct_attic_diff",
      prompt: "How hard is the attic?",
      type: "single",
      required: true,
      when: { questionId: "duct_where", includes: "attic" },
      options: [
        { id: "easy", label: "Easy — open, walk or kneel", laborHours: 0 },
        { id: "hard", label: "Packed or hot attic", laborHours: 1.5 },
        { id: "very", label: "Very hard — low, blown-in, heat", laborHours: 3 },
      ],
    },
    {
      id: "duct_crawl_diff",
      prompt: "How hard is the crawl?",
      help: "Do not average the whole crawl. If half is sit-up and half is belly, pick Mixed.",
      type: "single",
      required: true,
      when: { questionId: "duct_where", includes: "crawl" },
      options: [
        { id: "easy", label: "Easy — sit-up or walk", laborHours: 0.5 },
        { id: "mixed", label: "Mixed — part easy, part tight", laborHours: 2 },
        { id: "tight", label: "Tight — belly crawl", laborHours: 4 },
      ],
    },
    {
      id: "duct_crawl_mix",
      prompt: "How much of the crawl is the tight part?",
      type: "single",
      required: true,
      when: { questionId: "duct_crawl_diff", equals: "mixed" },
      options: [
        { id: "less", label: "Less than half", laborHours: 0.5 },
        { id: "half", label: "About half", laborHours: 1 },
        { id: "most", label: "Most of it", laborHours: 2 },
      ],
    },
    {
      id: "duct_garage_kd",
      prompt: "Garage run needs KD 26-ga. Include it?",
      help: "Fire-rated steel through the garage, then a jacket. Already picked if KD is the system material.",
      type: "single",
      required: true,
      when: { questionId: "duct_where", includes: "garage" },
      options: [
        {
          id: "yes",
          label: "Yes — KD through the garage",
          laborHours: 2,
          materialCost: 380,
          scopeLines: [
            "Garage portion is fire-rated galvanized steel with an insulated jacket to match the house.",
          ],
        },
        { id: "already", label: "KD is already the system material" },
      ],
    },
    {
      id: "duct_run_qty",
      prompt: "About how many runs are we touching?",
      type: "count",
      required: true,
      countMin: 1,
      countMax: 24,
      countStep: 1,
      unitLabel: "runs",
      laborHours: 0.35,
      materialCost: 40,
      when: {
        any: [
          { questionId: "duct_plan", equals: "replace" },
          { questionId: "duct_offer_new", equals: "yes" },
        ],
      },
    },
    {
      id: "duct_add_qty",
      prompt: "How many new runs?",
      type: "count",
      required: true,
      countMin: 1,
      countMax: 8,
      countStep: 1,
      unitLabel: "runs",
      laborHours: 2,
      materialCost: 140,
      when: { questionId: "duct_plan", equals: "add" },
      scopeLines: [
        "Add {count} new supply or return run(s), sealed at the takeoff and the boot.",
      ],
    },
    {
      id: "duct_enlarge",
      prompt: "Are we enlarging existing boots?",
      type: "single",
      required: true,
      when: DUCT_BUILD_WHEN,
      options: [
        { id: "none", label: "No — leave boots as they are" },
        {
          id: "some",
          label: "Yes — enlarge boots",
          laborHours: 1.25,
          materialCost: 70,
          scopeLines: [
            "Enlarge existing boots where the new airflow needs a larger opening.",
          ],
        },
      ],
    },
    {
      id: "duct_enlarge_qty",
      prompt: "How many boots are we enlarging?",
      type: "count",
      required: true,
      countMin: 1,
      countMax: 20,
      countStep: 1,
      unitLabel: "boots",
      laborHours: 0.45,
      materialCost: 28,
      when: { questionId: "duct_enlarge", equals: "some" },
      scopeLines: [
        "Enlarge {count} existing register boot(s) to match the new airflow.",
      ],
    },
    {
      id: "duct_cutin",
      prompt: "Are we cutting in new boots / registers?",
      type: "single",
      required: true,
      when: DUCT_BUILD_WHEN,
      options: [
        {
          id: "none",
          label: "No — reuse existing boots",
          scopeLines: [
            "Reuse existing boots and registers where they are sound and sized for the new airflow.",
          ],
        },
        {
          id: "some",
          label: "Yes — cut in new boots",
          laborHours: 1.5,
          materialCost: 95,
          scopeLines: [
            "Cut in new boots and registers where scoped. We will do our best to contain dust. Residual dust is expected; finish cleaning of furnishings is by others.",
          ],
        },
      ],
    },
    {
      id: "duct_cutin_qty",
      prompt: "How many new boots?",
      type: "count",
      required: true,
      countMin: 1,
      countMax: 20,
      countStep: 1,
      unitLabel: "boots",
      laborHours: 0.6,
      materialCost: 48,
      when: { questionId: "duct_cutin", equals: "some" },
      scopeLines: [
        "Cut in {count} new register boot(s) and install new grilles.",
      ],
    },
    {
      id: "duct_tile",
      prompt: "Any new boots through tile, plaster, or a tall ceiling?",
      help: "Tile and plaster make dust we cannot fully contain. Tall ceilings change the labor.",
      type: "single",
      required: true,
      when: { questionId: "duct_cutin", equals: "some" },
      options: [
        { id: "no", label: "No — standard drywall / 8–10 ft" },
        {
          id: "tile",
          label: "Tile or plaster in the work",
          laborHours: 1.25,
          scopeLines: [
            "One or more boots cut through tile or plaster. We will take precautions to protect the room and minimize dust. We cannot return those surfaces to showroom condition; residual dust and finish work are expected.",
          ],
        },
        {
          id: "tall",
          label: "Ceiling over 12 ft in a room",
          laborHours: 1.5,
          scopeLines: [
            "One or more boots in a tall ceiling. Extra access and protection as needed.",
          ],
        },
        {
          id: "both",
          label: "Tile / plaster and a tall ceiling",
          laborHours: 2.5,
          scopeLines: [
            "Boots include tile or plaster and a tall ceiling. Extra protection and access. Residual dust is expected; finish cleaning by others.",
          ],
        },
      ],
    },
  ],
};

const humidifierScope: ScopeQuestionnaire = {
  id: "humidifier_v1",
  familyIds: ["humidifier"],
  title: "Humidifier site conditions",
  blurb: "Picture path first. Steam is its own walk. Water and drain stay internal except the work itself.",
  source: "builtin",
  questions: [
    {
      id: "hum_visit",
      prompt: "Is this humidifier the only work on this visit?",
      help: "Hidden when a major is already on this job.",
      type: "single",
      required: true,
      options: [
        { id: "with", label: "With other work on this job", note: "Ride-along — no trip" },
        {
          id: "alone",
          label: "This humidifier is the only work",
          note: "Adds trip labor",
          laborHours: 1.25,
          materialCost: 95,
        },
      ],
    },
    {
      id: "hum_kind",
      prompt: "Which Honeywell humidifier?",
      help: "Flow-through (bypass and powered) share a path. Steam is different. Both = two quotes.",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "flow", label: "Flow-through — bypass or powered" },
        { id: "steam", label: "Steam — TrueSTEAM" },
        { id: "both", label: "Quote both paths" },
      ],
    },
    {
      id: "hum_job",
      prompt: "Replace an existing humidifier, or new?",
      type: "single",
      required: true,
      options: [
        {
          id: "replace",
          label: "Replace existing",
          scopeLines: [
            "Remove your existing humidifier, haul it away, and recycle it.",
          ],
        },
        {
          id: "new",
          label: "New — none there now",
          scopeLines: ["Install a new whole-home humidifier on this system."],
        },
      ],
    },
    {
      id: "hum_mount",
      prompt: "Where does the humidifier mount?",
      type: "single",
      required: true,
      when: { questionId: "hum_kind", oneOf: ["flow", "both"] },
      options: [
        {
          id: "supply",
          label: "Supply plenum",
          scopeLines: ["Mount the humidifier on the supply plenum per the listing."],
        },
        {
          id: "return",
          label: "Return plenum",
          scopeLines: ["Mount the humidifier on the return plenum per the listing."],
        },
      ],
    },
    {
      id: "hum_water",
      prompt: "How do we tap water?",
      help: "Internal only — not on the contract. Saddle is cheaper. A real shutoff is what we prefer.",
      type: "single",
      required: true,
      options: [
        {
          id: "shutoff",
          label: "Real shutoff + line",
          note: "Preferred",
          laborHours: 0.35,
          materialCost: 28,
        },
        {
          id: "saddle",
          label: "Saddle valve (kit)",
          note: "Cheaper — not preferred",
        },
      ],
    },
    {
      id: "hum_drain",
      prompt: "How does the humidifier drain?",
      type: "single",
      required: true,
      options: [
        {
          id: "downhill",
          label: "It drains downhill — no pump",
          scopeLines: ["Run the humidifier drain to an approved downhill receptor."],
        },
        {
          id: "pump",
          label: "Needs a condensate pump",
          laborHours: 0.75,
          materialCost: 145,
          scopeLines: ["Install a condensate pump for the humidifier drain and test it."],
        },
      ],
    },
    {
      id: "hum_pan",
      prompt: "Does this humidifier need its own drain pan?",
      help: "Attic and finished ceilings usually yes.",
      type: "single",
      required: true,
      options: [
        {
          id: "yes",
          label: "Yes — pan under the humidifier",
          laborHours: 0.35,
          materialCost: 42,
          scopeLines: [
            "Set the humidifier in a drain pan. Attic equipment also gets the secondary pan and float switch.",
          ],
        },
        { id: "no", label: "No pan needed" },
      ],
    },
    {
      id: "hum_steam_power",
      prompt: "How do we power the steam unit?",
      help: "HM506 can often share a nearby 120V. HM512 needs a dedicated 15-amp circuit and a permit.",
      type: "single",
      required: true,
      when: { questionId: "hum_kind", oneOf: ["steam", "both"] },
      options: [
        {
          id: "nearby",
          label: "Use a nearby 120-volt (6-gal class)",
          note: "HM506 only",
        },
        {
          id: "dedicated",
          label: "New dedicated 15-amp 120-volt",
          note: "Required on 12-gal · pulls a permit",
          laborHours: 1.25,
          materialCost: 180,
          scopeLines: [
            "Install a dedicated 15-amp, 120-volt circuit for the steam humidifier and pull the electrical permit.",
          ],
        },
      ],
    },
    ...ATTIC_ACCESS_QUESTIONS,
  ],
};

const dehumidifierScope: ScopeQuestionnaire = {
  id: "dehumidifier_v1",
  familyIds: ["dehumidifier"],
  title: "Dehumidifier site conditions",
  blurb: "Honeywell TrueDRY. Hookup and drain first. 120V last.",
  source: "builtin",
  questions: [
    {
      id: "dh_visit",
      prompt: "Is this dehumidifier the only work on this visit?",
      help: "Hidden when a major is already on this job.",
      type: "single",
      required: true,
      options: [
        { id: "with", label: "With other work on this job", note: "Ride-along — no trip" },
        {
          id: "alone",
          label: "This dehumidifier is the only work",
          note: "Adds trip labor",
          laborHours: 1.25,
          materialCost: 95,
        },
      ],
    },
    {
      id: "dh_hookup",
      prompt: "How does it connect to the house?",
      type: "single",
      required: true,
      options: [
        {
          id: "existing",
          label: "Tie into existing ducts",
          scopeLines: [
            "Duct the dehumidifier into the existing supply and return so the whole house is dehumidified.",
          ],
        },
        {
          id: "dedicated",
          label: "Dedicated return / isolated space",
          laborHours: 1.5,
          materialCost: 220,
          scopeLines: [
            "Install a dedicated return (or isolate the space) and discharge dry air as scoped.",
          ],
        },
      ],
    },
    {
      id: "dh_drain",
      prompt: "How does the dehumidifier drain?",
      type: "single",
      required: true,
      options: [
        {
          id: "downhill",
          label: "It drains downhill — no pump",
          scopeLines: ["Run the dehumidifier drain to an approved downhill receptor."],
        },
        {
          id: "pump",
          label: "Needs a condensate pump",
          laborHours: 0.75,
          materialCost: 145,
          scopeLines: ["Install a condensate pump for the dehumidifier drain and test it."],
        },
      ],
    },
    {
      id: "dh_power",
      prompt: "How do we land 120-volt power?",
      type: "single",
      required: true,
      options: [
        { id: "nearby", label: "Use a nearby 120-volt", laborHours: 0.35, materialCost: 25 },
        {
          id: "dedicated",
          label: "New dedicated 120-volt circuit",
          note: "Pulls a permit",
          laborHours: 1.25,
          materialCost: 180,
          scopeLines: [
            "Install a dedicated 120-volt circuit for the dehumidifier and pull the electrical permit.",
          ],
        },
      ],
    },
    ...ATTIC_ACCESS_QUESTIONS,
  ],
};

const packageUnitScope: ScopeQuestionnaire = {
  id: "package_unit_v1",
  familyIds: ["package_unit"],
  title: "Package unit site conditions",
  blurb: "Foundation only. Stays dark until we finish the catalog and a full pass. Roof curb vs grade, then how we set it.",
  source: "builtin",
  questions: [
    {
      id: "pkg_job",
      prompt: "Replace the existing package unit, or new?",
      type: "single",
      required: true,
      options: [
        {
          id: "replace",
          label: "Replace what’s there",
          scopeLines: [
            "Remove the existing package unit, haul it away, and recycle it.",
          ],
        },
        {
          id: "new",
          label: "New — none there now",
          scopeLines: ["Install a new package unit at the agreed location."],
        },
      ],
    },
    {
      id: "pkg_kind",
      prompt: "Pick package unit type",
      type: "single",
      required: true,
      options: [
        { id: "gas_elec", label: "Gas heat / electric cool" },
        { id: "hp", label: "Heat pump package" },
        { id: "dual", label: "Dual fuel (heat pump + gas)" },
        { id: "elec", label: "All-electric (no gas)" },
      ],
    },
    {
      id: "pkg_place",
      prompt: "Where does this package unit sit?",
      type: "single",
      required: true,
      hidden: true,
      options: [
        { id: "roof_curb", label: "Roof curb" },
        { id: "grade", label: "On the ground" },
        { id: "other", label: "Other" },
      ],
    },
    {
      id: "pkg_curb",
      prompt: "Keep the curb, or new?",
      help: "Most change-outs reuse the curb or add an adapter. A new curb is a roof job.",
      type: "single",
      required: true,
      when: { questionId: "pkg_place", oneOf: ["roof_curb"] },
      options: [
        {
          id: "reuse",
          label: "Reuse the existing curb",
          scopeLines: [
            "Set the new package unit on the existing roof curb after confirming it is sound and the ducts line up.",
          ],
        },
        {
          id: "adapter",
          label: "Curb adapter (new unit, old curb)",
          laborHours: 2.5,
          materialCost: 890,
          scopeLines: [
            "Install a curb adapter so the new package unit sits on the existing curb and the supply and return line up.",
          ],
        },
        {
          id: "new",
          label: "New curb — roof work",
          laborHours: 6,
          materialCost: 1850,
          scopeLines: [
            "Install a new roof curb, flash it, and set the package unit. Roofing finish beyond the curb is as scoped.",
          ],
        },
      ],
    },
    {
      id: "pkg_set",
      prompt: "How do we set the unit?",
      help: "Rooftop almost always needs a crane. Ground units can be a lift or a crew.",
      type: "single",
      required: true,
      options: [
        {
          id: "crane",
          label: "Crane (typical rooftop)",
          note: "Contractor cost — enter later",
          laborHours: 2,
          scopeLines: [
            "Set the package unit by crane. Crane is a contractor line.",
          ],
        },
        {
          id: "lift",
          label: "All-terrain lift / telehandler",
          laborHours: 2.5,
          materialCost: 450,
          scopeLines: ["Set the package unit with a lift."],
        },
        {
          id: "crew",
          label: "Ground crew — no crane",
          laborHours: 3,
          scopeLines: ["Set the package unit from grade with our crew."],
        },
        {
          id: "by_others",
          label: "Set by others",
          scopeLines: ["Package unit set by others. Acme connects, starts, and warrants our work."],
        },
      ],
    },
    {
      id: "pkg_hail",
      prompt: "Hail / coil guards?",
      type: "single",
      required: true,
      options: [
        {
          id: "add",
          label: "Add hail guards",
          laborHours: 0.75,
          materialCost: 285,
          scopeLines: ["Install hail / coil guards on the package unit."],
        },
        { id: "has", label: "Already on the unit" },
        { id: "skip", label: "Not on this bid" },
      ],
    },
    {
      id: "pkg_gas",
      prompt: "Gas to the unit?",
      type: "single",
      required: true,
      when: { questionId: "pkg_kind", oneOf: ["gas_elec", "dual"] },
      options: [
        {
          id: "reuse",
          label: "Reconnect existing gas",
          scopeLines: ["Reconnect the existing gas line to the new package unit and leak-test."],
        },
        {
          id: "new",
          label: "New gas run",
          laborHours: 2,
          materialCost: 180,
          scopeLines: ["Run new gas to the package unit, sized per the listing, and leak-test."],
        },
        {
          id: "by_others",
          label: "Gas by others",
          scopeLines: ["Gas piping by others. Acme connects and leak-tests at the unit."],
        },
      ],
    },
    ...outdoorDemoQuestions,
    ...controlWireQuestions,
    ...ATTIC_ACCESS_QUESTIONS,
  ],
};

const airCleanerScope: ScopeQuestionnaire = {
  id: "air_cleaner_v1",
  familyIds: ["air_cleaner", "air_filter"],
  title: "Media filter",
  blurb: "With the new system, or added to existing. Verify there is room.",
  source: "builtin",
  questions: [
    {
      id: "filter_job",
      prompt: "Is this filter on the new system, or added to existing?",
      type: "single",
      required: true,
      options: [
        {
          id: "with_new",
          label: "With the new system we are installing",
          scopeLines: [
            "Install the media filter cabinet on the new system return, sized so the filter can be changed.",
          ],
        },
        {
          id: "add_exist",
          label: "Add to existing equipment",
          note: "More labor — adapt the return",
          laborHours: 1.25,
          materialCost: 85,
          scopeLines: [
            "Add a media filter cabinet to the existing return. Adapt the duct so the filter can be changed.",
          ],
        },
      ],
    },
    {
      id: "filter_room",
      prompt: "Is there room for the cabinet?",
      help: "Comfort advisor verifies this on site.",
      type: "single",
      required: true,
      options: [
        { id: "yes", label: "Yes — verified there is room" },
        {
          id: "adapt",
          label: "Tight — need to adapt / cut the return",
          laborHours: 0.75,
          materialCost: 45,
        },
        {
          id: "no",
          label: "Not enough room — cannot do a media cabinet",
          scopeLines: [
            "A media filter cabinet will not fit this return. We will not install one on this option.",
          ],
        },
      ],
    },
  ],
};

export const BUILTIN_SCOPE_QUESTIONNAIRES: ScopeQuestionnaire[] = [
  furnaceAccess,
  wallHeaterScope,
  heatPumpScope,
  airHandlerScope,
  waterHeaterTankScope,
  ductlessScope,
  acScope,
  seismicStrapScope,
  padScope,
  gasLineScope,
  electricalScope,
  serviceLightScope,
  bathFanScope,
  electricalJobScope,
  ductworkScope,
  humidifierScope,
  dehumidifierScope,
  airCleanerScope,
  packageUnitScope,
  zoningScope,
];

let _activeQuestionnaires: ScopeQuestionnaire[] = [
  ...BUILTIN_SCOPE_QUESTIONNAIRES,
];

export function setActiveScopeQuestionnaires(list: ScopeQuestionnaire[]): void {
  _activeQuestionnaires = list.length
    ? list.map((q) => ({ ...q, questions: q.questions.map((qq) => ({ ...qq })) }))
    : [...BUILTIN_SCOPE_QUESTIONNAIRES];
}

export function getActiveScopeQuestionnaires(): ScopeQuestionnaire[] {
  return _activeQuestionnaires;
}

/** Site questions first, then gas, then the full electrical tree, then service light. */
function isElectricalQuestion(q: ScopeQuestion): boolean {
  const id = q.id || "";
  if (id === "power" || id === "electrical" || id === "electrical_hp") return true;
  if (/^elec_/.test(id) || /^electrical_/.test(id) || /^panel_/.test(id)) {
    return true;
  }
  return false;
}

function advisorQuestionOrder(
  questions: ScopeQuestion[],
  familyId?: string,
): ScopeQuestion[] {
  if (familyId === "wall_heater") {
    const rank = (id: string) => {
      if (/^wall_path$|^install_type$|^wall_demo/.test(id)) return 0;
      if (/^gas_/.test(id)) return 1;
      if (
        /^wall_flue|^wall_attic|^wall_roof|^wall_vent|^wall_shield|^wall_new|^wall_units/.test(
          id,
        )
      )
        return 2;
      if (/^wall_dv|^wall_rin|^finish/.test(id)) return 3;
      if (/^wall_stat|^wall_tstat/.test(id)) return 4;
      return 2;
    };
    return [...questions].sort((a, b) => rank(a.id) - rank(b.id));
  }
  if (
    familyId === "ductless" ||
    familyId === "heat_pump" ||
    familyId === "ac"
  ) {
    const rank = (id: string) => {
      if (/^demo|^install_type|^ms_demo/.test(id)) return 0;
      if (/^pad_/.test(id)) return 1;
      if (/^gas_/.test(id)) return 3;
      if (/^elec_|^electrical_|^panel_/.test(id) || isElectricalQuestion({ id } as ScopeQuestion))
        return 4;
      return 2;
    };
    return [...questions].sort((a, b) => {
      const d = rank(a.id) - rank(b.id);
      if (d !== 0) return d;
      return 0;
    });
  }
  const site: ScopeQuestion[] = [];
  const gas: ScopeQuestion[] = [];
  const elec: ScopeQuestion[] = [];
  const service: ScopeQuestion[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    if (/^gas_/.test(q.id) || q.id === "gas_existing" || q.id === "gas_line") {
      gas.push(q);
    } else if (isElectricalQuestion(q)) {
      elec.push(q);
    } else if (q.id === "service_light") {
      service.push(q);
    } else {
      site.push(q);
    }
  }
  return [...site, ...gas, ...elec, ...service];
}

export function questionnaireForFamily(
  familyId: string,
): ScopeQuestionnaire | null {
  const matches = _activeQuestionnaires.filter((q) =>
    q.familyIds.includes(familyId),
  );
  if (!matches.length) return null;
  const drop =
    familyId === "heat_pump" || familyId === "ac"
      ? new Set([
          "condensate",
          "cond_run",
          "ah_cond_run",
          "ah_cond_path",
          "thermostat_hp",
          "tstat_run",
        ])
      : new Set<string>();
  const seen = new Set<string>();
  const merged = matches
    .flatMap((m) => m.questions)
    .filter((q) => !drop.has(q.id))
    .filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  const skipExtraHours = new Set([
    "permits",
    "hers",
    "load_calc",
    "conversion_guide",
    "hpwh_guide",
    "maintenance",
    "custom",
    "rebates",
  ]);
  const questions = advisorQuestionOrder(merged, familyId).map((q) => ({
    ...q,
    help: q.help || reasonFromId(q.id),
  }));
  if (!skipExtraHours.has(familyId) && !seen.has("extra_hours")) {
    questions.push({
      id: "extra_hours",
      prompt: "Check the work scope",
      help: "Read the customer language. Add extra hours or materials only if this sit is harder than the path you just walked. Zero is typical.",
      type: "number",
      required: true,
      countMin: 0,
      unitLabel: "hours",
      laborHours: 0,
      materialCost: 0,
      texts: 0,
      scopeLines: [],
    });
  }
  return {
    id: matches[0].id,
    familyIds: [familyId],
    title: matches[0].title,
    blurb: matches.map((m) => m.blurb).filter(Boolean).join(" "),
    source: "builtin",
    questions,
  };
}

export function visibleQuestions(
  q: ScopeQuestionnaire,
  answers: ScopeAnswers,
): ScopeQuestion[] {
  return q.questions.filter((qq) => isQuestionVisible(qq, answers || {}));
}

function choiceById(q: ScopeQuestion, id: string | null | undefined) {
  if (!id || !q.options) return null;
  return q.options.find((o) => o.id === id) || null;
}

export function priceGasAppDemos(items: GasAppDemoItem[]): {
  laborHours: number;
  materialCost: number;
  scopeLines: string[];
  summary: string;
} {
  let laborHours = 0;
  let materialCost = 0;
  const scopeLines: string[] = [];
  const labels: string[] = [];
  let extraDrywall = 0;
  let extraPlaster = 0;
  let extraOthers = 0;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const sid = item.scenarioId || item.kind || "wall_single";
    const sc = abandonById(sid) || abandonById("wall_single")!;
    laborHours += sc.laborHours;
    materialCost += sc.materialCost || 0;
    for (const line of sc.scopeLines) scopeLines.push(line);
    labels.push(sc.label);
    if (sc.allowPatch) {
      if (item.patch === "drywall") {
        extraDrywall += 1;
        laborHours += 0.25;
        materialCost += 19.11;
      } else if (item.patch === "plaster") {
        extraPlaster += 1;
        laborHours += 0.5;
        materialCost += 25.48;
      } else if (item.patch === "others") extraOthers += 1;
    }
  }
  if (extraDrywall) {
    scopeLines.push(
      extraDrywall === 1
        ? "Install rough wall patch at 1 opening after heater removal. Texture, trim and painting by others or priced separately."
        : `Install rough wall patch at ${extraDrywall} openings after heater removal. Texture, trim and painting by others or priced separately.`,
    );
  }
  if (extraPlaster) {
    scopeLines.push(
      extraPlaster === 1
        ? "Install rough lath-and-plaster patch at 1 opening after heater removal. Texture, trim and painting by others or priced separately."
        : `Install rough lath-and-plaster patch at ${extraPlaster} openings after heater removal. Texture, trim and painting by others or priced separately.`,
    );
  }
  if (extraOthers) {
    scopeLines.push("Wall / floor repairs at removed heater openings by others.");
  }
  return {
    laborHours: Math.round(laborHours * 100) / 100,
    materialCost: Math.round(materialCost * 100) / 100,
    scopeLines,
    summary: labels.length ? `Demo ${labels.join(" · ")}` : "Equipment demo",
  };
}

export function estimateScopeExtraSell(
  extraLaborHours: number,
  extraMaterialCost: number,
  rates?: {
    laborRate?: number;
    materialDivisor?: number;
    laborDivisor?: number;
  },
): number {
  return resolveMeasureSellPrice({
    materialCost: 0,
    laborHours: 0,
    unitPrice: 0,
    priceMode: "manual",
    extraLaborHours: Math.max(0, extraLaborHours),
    extraMaterialCost: Math.max(0, extraMaterialCost),
    rates: {
      laborRate: rates?.laborRate ?? DEFAULT_LABOR_RATE,
      materialDivisor: rates?.materialDivisor ?? DEFAULT_MATERIAL_DIVISOR,
      laborDivisor: rates?.laborDivisor ?? DEFAULT_LABOR_DIVISOR,
    },
  }).unitPrice;
}

function elecVoltageLabel(a: ScopeAnswers): string {
  return a.elec_voltage === "v110" ? "120-volt" : "240-volt";
}

function ductlessRoomLabel(id: string, custom?: string): string {
  if ((id === "other" || id === "custom") && String(custom || "").trim()) {
    return `the ${String(custom).trim()}`;
  }
  const map: Record<string, string> = {
    living: "the living room",
    family: "the family room",
    primary: "the primary bedroom",
    bed2: "bedroom 2",
    bed3: "bedroom 3",
    guest: "the guest room",
    office: "the office",
    bonus: "the bonus / loft",
    kitchen: "the kitchen",
    dining: "the dining room",
    media: "the media room",
    garage: "the garage",
    laundry: "the laundry",
    gym: "the gym",
    hall: "the hall",
    basement: "the basement",
    sunroom: "the sunroom",
    play: "the playroom",
    loft: "the loft",
    other: "the listed room",
    custom: "the listed room",
  };
  return map[id] || (id ? `the ${id}` : "the listed room");
}

function ductlessHeadScopeLine(
  style: string,
  room: string,
  unitName?: string,
): string | null {
  const who = unitName || "indoor";
  if (style === "high_wall")
    return `Mount the ${who} in ${room} on an approved wall, flash and seal the wall penetration, and slope the condensate so it drains.`;
  if (style === "one_way")
    return `Install the ${who} in ${room}, in a standard joist bay. Air is aimed into the room so the space actually feels it.`;
  if (style === "low_wall")
    return `Install the ${who} in ${room}, secured and clear of furnishings, with the condensate and refrigerant lines concealed as designed.`;
  if (style === "slim_duct")
    return `Install the ${who} for ${room}. A small supply and return feed the room so you do not need a wall head.`;
  return null;
}

export function compileScopeAnswers(
  familyId: string,
  answers: ScopeAnswers | null | undefined,
  rates?: {
    laborRate?: number;
    materialDivisor?: number;
    laborDivisor?: number;
  },
  ctx?: CompileCtx,
): CompiledScope {
  const quiz = questionnaireForFamily(familyId);
  if (!quiz) {
    return {
      questionnaireId: null,
      complete: true,
      missingRequired: [],
      scopeLines: [],
      benefitLines: [],
      extraLaborHours: 0,
      extraMaterialCost: 0,
      extraSellEstimate: 0,
      summary: [],
    };
  }

  const a = answers || {};
  const only = ctx?.onlyIds
    ? new Set(ctx.onlyIds)
    : null;
  const exclude = ctx?.excludeIds
    ? new Set(ctx.excludeIds)
    : new Set<string>();
  const visible = quiz.questions
    .filter((qq) => {
      if (!qq.when) return true;
      const rules = Array.isArray(qq.when) ? qq.when : [qq.when];
      return rules.every((r) => whenMatches(r, a || {}));
    })
    .filter((qq) => {
    if (exclude.has(qq.id)) return false;
    if (only && !only.has(qq.id)) return false;
    if (qq.hidden && isPlacementScopeQuestion(qq)) return false;
    if (qq.hidden && (/_name$/.test(qq.id) || qq.id === "san_bends")) return false;
    return true;
  });
  const missingRequired: string[] = [];
  const scopeLines: string[] = [];
  const benefitLines: string[] = [];
  const summary: string[] = [];
  let extraLaborHours = 0;
  let extraMaterialCost = 0;

  for (const qq of visible) {
    const raw = a[qq.id];

    if (qq.required) {
      const placementQ = isPlacementScopeQuestion(qq);
      if (placementQ) {
        // asked via placement picker
      } else if (qq.type === "boolean" && typeof raw !== "boolean") {
        missingRequired.push(qq.id);
      } else if (
        (qq.type === "single" || qq.type === "text") &&
        (raw == null || raw === "")
      ) {
        missingRequired.push(qq.id);
      } else if (qq.type === "multi" && (!Array.isArray(raw) || raw.length === 0)) {
        missingRequired.push(qq.id);
      } else if (qq.type === "number" || qq.type === "count") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) missingRequired.push(qq.id);
      } else if (qq.type === "repeat") {
        if (!Array.isArray(raw)) missingRequired.push(qq.id);
      } else if (qq.type === "gas_app_repeat") {
        if (!Array.isArray(raw) || raw.length === 0) missingRequired.push(qq.id);
      } else if (qq.type === "linear_run") {
        if (!linearRunComplete(raw, true, qq.linearFamily)) missingRequired.push(qq.id);
      }
    }

    if (qq.type === "boolean") {
      if (raw === true) summary.push("Yes: " + qq.prompt.slice(0, 40));
      else if (raw === false) summary.push("No: " + qq.prompt.slice(0, 40));
      continue;
    }

    if (qq.type === "single" && typeof raw === "string") {
      const ch = choiceById(qq, raw);
      if (ch) {
        const headStyle = /^ms_h(\d+)_style$/.exec(qq.id);
        if (headStyle) {
          const n = headStyle[1];
          const room = ductlessRoomLabel(
            String(a[`ms_h${n}_room`] || ""),
            String(a[`ms_h${n}_room_name`] || ""),
          );
          const unitName = ductlessIndoorUnitName({
            style: ch.id,
            kbtu: Number(a[`ms_h${n}_kbtu`] || 0) || null,
          });
          const raw = (ch.scopeLines || []).filter(Boolean);
          if (raw.length) {
            for (const line of raw) {
              scopeLines.push(
                line
                  .replace(/\{room\}/gi, room)
                  .replace(/\{unit\}/gi, unitName),
              );
            }
          } else {
            const custom = ductlessHeadScopeLine(ch.id, room, unitName);
            if (custom) scopeLines.push(custom);
          }
        } else if (qq.id === "elec_path") {
          const v = elecVoltageLabel(a);
          if (ch.id === "existing_5") {
            scopeLines.push(`Connect to the existing dedicated ${v} circuit within 5 feet.`);
          } else if (ch.id === "existing_10") {
            scopeLines.push(`Connect to the existing dedicated ${v} circuit within 10 feet.`);
          } else if (ch.id === "reconnect") {
            scopeLines.push(
              `Connect the new unit to the existing ${v} circuit and confirm it is sized and protected for this equipment.`,
            );
          } else if (ch.id === "alter") {
            scopeLines.push(
              `Extend the existing ${v} circuit to the new equipment location.`,
            );
          } else if (ch.id === "new") {
            scopeLines.push(
              `Install a new dedicated ${v} circuit, breaker, and disconnect for the equipment.`,
            );
          } else if (ch.id === "by_others") {
            scopeLines.push(
              "Electrical work by others. Final connection and startup after power is ready.",
            );
          }
        } else if (qq.id === "fan_elec" && ch.id === "new") {
          const where = String(a.fan_panel_where || "");
          const from =
            where === "upstairs_closet"
              ? " from the upstairs closet panel"
              : where === "garage"
                ? " from the garage panel"
                : where === "main_meter"
                  ? " from the main panel at the meter"
                  : where === "other"
                    ? " from the panel"
                    : "";
          scopeLines.push(
            `Install a new 120-volt circuit${from} to the bath fan.`,
          );
        } else if (qq.id === "ejob_source" && ch.id === "new") {
          const where = String(a.ejob_panel || "");
          const from =
            where === "upstairs_closet"
              ? " from the upstairs closet panel"
              : where === "garage"
                ? " from the garage panel"
                : where === "main_meter"
                  ? " from the main panel at the meter"
                  : where === "other"
                    ? " from the panel"
                    : "";
          const job = String(a.ejob || "");
          const volts = job === "c240" ? "240-volt" : "120-volt";
          scopeLines.push(
            `Install a new ${volts} circuit${from} using listed materials, land it on a proper breaker, and leave the work inspectable.`,
          );
        } else if (/^ms_h(\d+)_throw$/.test(qq.id)) {
          // Advisor confirm only — the cassette line already says air is aimed into the room.
        } else if (/^ms_h(\d+)_run$/.test(qq.id)) {
          const n = /^ms_h(\d+)_run$/.exec(qq.id)?.[1] || "1";
          const room = ductlessRoomLabel(
            String(a[`ms_h${n}_room`] || ""),
            String(a[`ms_h${n}_room_name`] || ""),
          );
          const indoor = room || "this indoor";
          for (const line of ch.scopeLines || []) {
            scopeLines.push(
              line
                .replace(/this indoor/gi, indoor)
                .replace(/\{room\}/gi, indoor),
            );
          }
        } else if (qq.id === "ms_permit") {
          // Advisor-owned. Permits live on the permits measure, never this contract.
        } else if (qq.id === "duct_where" && ch.id === "garage" && a.duct_material === "kd") {
          // KD material line already covers the garage fire-rated run.
        } else {
          for (const line of ch.scopeLines || []) scopeLines.push(line);
        }
        for (const line of ch.benefitLines || []) benefitLines.push(line);
        extraLaborHours += Math.max(0, ch.laborHours || 0);
        extraMaterialCost += Math.max(0, ch.materialCost || 0);
        summary.push(ch.label);
      }
      continue;
    }

    if (qq.type === "multi" && Array.isArray(raw)) {
      for (const id of raw) {
        const ch = choiceById(qq, String(id));
        if (!ch) continue;
        for (const line of ch.scopeLines || []) scopeLines.push(line);
        extraLaborHours += Math.max(0, ch.laborHours || 0);
        extraMaterialCost += Math.max(0, ch.materialCost || 0);
        summary.push(ch.label);
      }
      continue;
    }

    if (qq.type === "number" || qq.type === "count") {
      if (qq.id === "extra_hours") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        extraLaborHours += Math.max(0, qq.laborHours || 0) * n;
        extraMaterialCost += Math.max(0, qq.materialCost || 0) * n;
        summary.push(`${qq.prompt}: ${n}`);
        for (const line of qq.scopeLines || []) {
          const filled = line.replace(/\{count\}/gi, String(n));
          scopeLines.push(
            n === 1
              ? filled
                  .replace(/\bboot\(s\)/gi, "boot")
                  .replace(/\brun\(s\)/gi, "run")
                  .replace(/\bgrille\(s\)/gi, "grille")
              : filled
                  .replace(/\bboot\(s\)/gi, "boots")
                  .replace(/\brun\(s\)/gi, "runs")
                  .replace(/\bgrille\(s\)/gi, "grilles"),
          );
        }
      }
      continue;
    }

    if (qq.type === "repeat" && Array.isArray(raw)) {
      const pullHr: Record<string, number> = {
        easy: 0.5,
        typical: 0.75,
        hard: 1.25,
        roof: 2,
      };
      for (const item of raw as DemoExtraItem[]) {
        if (!item || typeof item !== "object") continue;
        const kind = item.kind === "demo_ac" ? "air conditioner" : "heat pump";
        scopeLines.push(
          `Also recover refrigerant and recycle an additional outdoor ${kind}.`,
        );
        extraLaborHours += 0.75 + (pullHr[item.pull] || 0.75);
        summary.push(`Extra outdoor demo · ${kind}`);
      }
      continue;
    }

    if (qq.type === "gas_app_repeat" && Array.isArray(raw)) {
      const priced = priceGasAppDemos(raw as GasAppDemoItem[]);
      extraLaborHours += priced.laborHours;
      extraMaterialCost += priced.materialCost;
      for (const line of priced.scopeLines) scopeLines.push(line);
      if (priced.scopeLines.length) summary.push(priced.summary);
      continue;
    }

    if (qq.type === "linear_run") {
      const fam = qq.linearFamily;
      if (fam && linearRunComplete(raw, qq.required !== false, fam)) {
        const gauge = ampToGauge(
          Number((ctx?.circuit as { breakerAmps?: number } | null)?.breakerAmps) || 0,
          String(a.elec_amps || ctx?.circuit?.ampId || ""),
        );
        const priced = priceLinearRun(fam, raw, gauge);
        extraLaborHours += priced.laborHours;
        extraMaterialCost += priced.materialCost;
        // Footage / penetrations / difficulty stay on the quote — not the packet.
        summary.push(linearRunSummary(fam, raw, gauge));
        if (fam === "line_set" && lineSetCoverFeet(raw) > 0) {
          scopeLines.push(LINE_SET_COVER_SCOPE);
          benefitLines.push(LINE_SET_COVER_BENEFIT);
        }
        if (fam === "water" && priced.totalFeet > 0) {
          if (qq.id === "san_pipe") {
            scopeLines.push(
              `Run insulated water lines between the Sanden outdoor unit and the storage tank, ${Math.round(priced.totalFeet)} feet.`,
            );
          } else if (qq.id === "wh_wl_run") {
            scopeLines.push(
              `Run new water lines, ${Math.round(priced.totalFeet)} feet, and reconnect to the new water heater.`,
            );
          }
        }
        if (fam === "thermostat" && priced.totalFeet > 0) {
          scopeLines.push(
            `Install new control wire, ${Math.round(priced.totalFeet)} feet, landed at both ends.`,
          );
        }
      }
      continue;
    }

    if (qq.type === "text" && typeof raw === "string" && raw.trim()) {
      if (qq.id === "ejob_custom") {
        scopeLines.push(
          `Acme HVAC will complete the following electrical work to meet code: ${raw.trim()}`,
        );
        summary.push("Note added");
      } else if (qq.id === "ms_more_heads") {
        scopeLines.push(
          `Additional indoor heads: ${raw.trim()}. Each head gets its own refrigerant line from the distribution box.`,
        );
        summary.push("Note added");
      } else if (
        /^zone_r\d+_name$/.test(qq.id) ||
        /_room_name$/.test(qq.id)
      ) {
        // Label only — honored on the head / zone line, never as its own packet line.
      } else {
        scopeLines.push(raw.trim());
        summary.push("Note added");
      }
    }
  }

  if (!only) {
    const close = measureClose(familyId, ctx?.isHybrid, a);
    for (const line of close.scopeLines) scopeLines.push(line);
    extraLaborHours += close.laborHours;
    extraMaterialCost += close.materialCost;
  }

  const seen = new Set<string>();
  const uniqueLines = scopeLines.filter((l) => {
    const k = l.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    if (
      /client accepts hybrid|sound level at the current|room volume is large enough|no ventilation duct required|panel has room for the new breaker/i.test(
        k,
      )
    ) {
      return false;
    }
    seen.add(k);
    return true;
  });

  extraLaborHours = Math.round(extraLaborHours * 100) / 100;
  extraMaterialCost = Math.round(extraMaterialCost * 100) / 100;

  return {
    questionnaireId: quiz.id,
    complete: missingRequired.length === 0,
    missingRequired,
    scopeLines: uniqueLines,
    benefitLines,
    extraLaborHours,
    extraMaterialCost,
    extraSellEstimate: estimateScopeExtraSell(
      extraLaborHours,
      extraMaterialCost,
      rates,
    ),
    summary,
  };
}

export function setScopeAnswer(
  answers: ScopeAnswers,
  questionId: string,
  value: ScopeAnswerValue,
): ScopeAnswers {
  return { ...answers, [questionId]: value };
}

export const SCOPE_FAMILY_IDS = [
  "furnace",
  "wall_heater",
  "heat_pump",
  "air_handler",
  "water_heater",
  "ductless",
  "ac",
  "bath_fan",
  "ductwork",
  "zoning",
] as const;
