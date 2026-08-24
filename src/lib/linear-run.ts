/**
 * Shared linear-run takeoff: path + feet + NECA difficulty, per stretch.
 * Used by electrical, gas, water, line set, PVC vent, condensate, thermostat, and Type-B flue.
 */

import {
  overlayLinearPaths,
  overlayPenTypes,
} from "./linear-rate-store";

export type DifficultyId = "easy" | "difficult" | "very_hard";

export type LinearFamily =
  | "electrical"
  | "gas"
  | "water"
  | "line_set"
  | "condensate"
  | "pvc_vent"
  | "thermostat"
  | "bvent";

export type WireGauge = 14 | 12 | 10 | 8 | 6;

export type LinearPath = {
  id: string;
  label: string;
  short: string;
  materialPerFt: number;
  laborHrPerFt: number;
};

export type PenKind = "none" | "sheetrock" | "wood" | "stucco" | "brick" | "roof";
export type LinearPen = { kind: Exclude<PenKind, "none">; qty: number };

export type LinearStretch = {
  id: string;
  path: string;
  feet: number;
  difficulty: DifficultyId;
  pens?: LinearPen[];
  /** @deprecated use pens */
  pen?: PenKind;
  /** @deprecated use pens */
  penQty?: number;
};

export type LinearRunValue = {
  stretches: LinearStretch[];
  /** Cover is optional. Empty = no cover language on the packet. */
  coverStretches?: LinearStretch[];
  /** Holes for the whole A–B run (line set). */
  pens?: LinearPen[];
  termination?: string;
  roofKind?: string;
  roofAccess?: string;
  /** Sold coil for line set — 30 / 50 / 80 / 100. Labor bars are separate. */
  rollFeet?: number;
};

export const LINE_SET_ROLLS = [30, 50, 80, 100] as const;
export const LINE_SET_LABOR_FEET = [10, 15, 20, 25, 30, 40, 50] as const;

export function soldCoilFromFeet(ft: number): 0 | 30 | 50 | 80 | 100 {
  if (!(ft > 0)) return 0;
  if (ft <= 30) return 30;
  if (ft <= 50) return 50;
  if (ft <= 80) return 80;
  return 100;
}

/** Customer packet — fires when any cover bar is off 0. Same line on HP, AC, and mini-split. */
export const LINE_SET_COVER_SCOPE =
  "Install line-set cover on the exposed refrigerant lines from the outdoor unit to the wall penetration, secured and UV-protected.";

export const LINE_SET_COVER_BENEFIT =
  "Line-set cover protects the exposed refrigerant lines from weather and UV.";

export function lineSetCoverFeet(raw: unknown): number {
  const run = parseLinearRun(raw);
  return (run.coverStretches || []).reduce(
    (n, s) => n + (Number(s.feet) || 0),
    0,
  );
}

/** Easy / Medium / Hard on the ductless line-set page. Same ids as DIFFICULTIES. */
export const LINE_SET_LANES: Array<{
  id: DifficultyId;
  label: string;
  runHelp: string;
  coverHelp: string;
  accent: string;
}> = [
  {
    id: "easy",
    label: "Easy",
    runHelp: "1 story, small ladder",
    coverHelp: "No ladder",
    accent: "#059669",
  },
  {
    id: "difficult",
    label: "Medium",
    runHelp: "Above 1st, or easy with offsets",
    coverHelp: "Small ladder",
    accent: "#b8831a",
  },
  {
    id: "very_hard",
    label: "Hard",
    runHelp: "Tall ladder, extra person",
    coverHelp: "Tall ladder",
    accent: "#2563eb",
  },
];

export const VENT_OUTLETS: Partial<
  Record<
    LinearFamily,
    Array<{ id: string; label: string; blurb: string; img: string }>
  >
> = {
  bvent: [
    {
      id: "roof",
      label: "Through the roof",
      blurb: "New B-vent jack + flashing",
      img: "/vents/roof-bvent.svg",
    },
    {
      id: "wall",
      label: "Through the wall",
      blurb: "Sidewall B-vent",
      img: "/vents/wall-side.svg",
    },
    {
      id: "existing",
      label: "Existing termination",
      blurb: "Reuse jack / cap",
      img: "/vents/existing.svg",
    },
  ],
  pvc_vent: [
    {
      id: "roof",
      label: "Through the roof",
      blurb: "Concentric or two-pipe",
      img: "/vents/roof-pvc.svg",
    },
    {
      id: "wall",
      label: "Through the sidewall",
      blurb: "Intake + exhaust caps",
      img: "/vents/wall-side.svg",
    },
    {
      id: "existing",
      label: "Existing termination",
      blurb: "Reuse PVC term",
      img: "/vents/existing.svg",
    },
  ],
};

export const ROOF_KINDS: Array<{
  id: string;
  label: string;
  labor: number;
  material: number;
  scope: string;
}> = [
  {
    id: "existing",
    label: "Use existing flashing",
    labor: 0.25,
    material: 0,
    scope: "Reuse existing roof flashing for the new vent.",
  },
  {
    id: "asphalt",
    label: "Asphalt shingles",
    labor: 1,
    material: 48,
    scope: "Cut in new roof flashing through asphalt shingles.",
  },
  {
    id: "flat",
    label: "Flat roof",
    labor: 1.25,
    material: 68,
    scope: "Cut in new roof flashing on the flat roof.",
  },
  {
    id: "metal",
    label: "Metal roofing",
    labor: 1.5,
    material: 88,
    scope: "Cut in new roof flashing on metal roofing.",
  },
  {
    id: "tile_others",
    label: "Tile — by others",
    labor: 0,
    material: 0,
    scope: "Roof flashing through clay / concrete / barrel tile by others.",
  },
];

export const ROOF_ACCESS: Array<{
  id: string;
  label: string;
  labor: number;
}> = [
  { id: "1_safe", label: "1 person · safe", labor: 0 },
  { id: "1_med", label: "1 person · medium", labor: 0.25 },
  { id: "1_hard", label: "1 person · hard", labor: 0.5 },
  { id: "2_safe", label: "2 people · safe", labor: 1 },
  { id: "2_gear", label: "2 people · gear", labor: 1.5 },
  { id: "2_hard", label: "2 people · very hard", labor: 2 },
];

export const PEN_TYPES: Array<{
  id: PenKind;
  label: string;
  labor: number;
  material: number;
}> = [
  { id: "none", label: "No new holes", labor: 0, material: 0 },
  { id: "sheetrock", label: "Sheetrock / plaster", labor: 0.15, material: 4 },
  { id: "wood", label: "Wood / joist", labor: 0.2, material: 6 },
  { id: "stucco", label: "Stucco / exterior", labor: 0.4, material: 12 },
  { id: "brick", label: "Brick / tile", labor: 0.55, material: 14 },
  { id: "roof", label: "Roof", labor: 0.5, material: 8 },
];

export function stretchPens(s: Pick<LinearStretch, "pens" | "pen" | "penQty">): LinearPen[] {
  if (s.pens && s.pens.length) {
    return s.pens
      .filter((p) => p.kind && (p.qty || 0) > 0)
      .map((p) => ({
        kind: p.kind,
        qty: Math.max(1, Math.min(6, Number(p.qty) || 1)),
      }));
  }
  if (s.pen && s.pen !== "none") {
    return [
      {
        kind: s.pen,
        qty: Math.max(1, Math.min(6, Number(s.penQty) || 1)),
      },
    ];
  }
  return [];
}

export function penLabel(kind: string): string {
  return resolvedPenTypes().find((p) => p.id === kind)?.label || kind;
}

export const RUN_TERMINATIONS: Partial<
  Record<LinearFamily, Array<{ id: string; label: string }>>
> = {
  condensate: [
    { id: "floor_drain", label: "Floor drain" },
    { id: "laundry", label: "Laundry standpipe" },
    { id: "exterior", label: "Exterior / splash" },
    { id: "crawl", label: "Crawl / garage" },
    { id: "receptor", label: "Receptor same room" },
    { id: "by_others", label: "By others" },
  ],
  pvc_vent: [
    { id: "wall", label: "Through wall" },
    { id: "roof", label: "Through roof" },
    { id: "existing", label: "Existing termination" },
  ],
  bvent: [
    { id: "roof", label: "Through roof / cap" },
    { id: "existing", label: "Existing B-vent termination" },
    { id: "wall", label: "Through wall" },
  ],
  gas: [
    { id: "meter", label: "At meter / stub" },
    { id: "existing", label: "Existing tie-in" },
    { id: "other", label: "Other / see notes" },
  ],
  water: [
    { id: "shutoff", label: "Existing shutoff" },
    { id: "copper", label: "Tie into copper" },
    { id: "galv", label: "Tie into galvanized" },
    { id: "other", label: "Other / see notes" },
  ],
};

export const DIFFICULTIES: Array<{
  id: DifficultyId;
  label: string;
  multiplier: number;
  help: string;
}> = [
  {
    id: "easy",
    label: "Easy",
    multiplier: 1,
    help: "Standing or 6-ft ladder. Open path. Under the house if you can walk or sit up.",
  },
  {
    id: "difficult",
    label: "Difficult",
    multiplier: 1.25,
    help: "10-ft ladder. Up the wall. Moderate crawl, joists, or finished rooms.",
  },
  {
    id: "very_hard",
    label: "Very hard",
    multiplier: 1.5,
    help: "Tall ladder or lift. Belly crawl. Packed attic. Outdoor height. Tight finished space.",
  },
];

const ELEC_BY_GAUGE: Record<
  WireGauge,
  Record<string, { material: number; labor: number; label: string; short: string }>
> = {
  14: {
    romex: { material: 1.05, labor: 0.02, label: "Romex", short: "Romex" },
    bx: { material: 1.5, labor: 0.03, label: "BX / MC", short: "BX" },
    outdoor_armored: {
      material: 2.1,
      labor: 0.04,
      label: "Outdoor armored",
      short: "Outdoor",
    },
    conduit: { material: 2.55, labor: 0.06, label: "Conduit + 3 wires", short: "Conduit" },
  },
  12: {
    romex: { material: 1.4, labor: 0.022, label: "Romex", short: "Romex" },
    bx: { material: 1.5, labor: 0.033, label: "BX / MC", short: "BX" },
    outdoor_armored: {
      material: 2.4,
      labor: 0.045,
      label: "Outdoor armored",
      short: "Outdoor",
    },
    conduit: { material: 3.3, labor: 0.065, label: "Conduit + 3 wires", short: "Conduit" },
  },
  10: {
    romex: { material: 3.5, labor: 0.025, label: "Romex", short: "Romex" },
    bx: { material: 3.8, labor: 0.035, label: "BX / MC", short: "BX" },
    outdoor_armored: {
      material: 4.4,
      labor: 0.048,
      label: "Outdoor armored",
      short: "Outdoor",
    },
    conduit: { material: 3.85, labor: 0.07, label: "Conduit + 3 wires", short: "Conduit" },
  },
  8: {
    romex: { material: 3.6, labor: 0.028, label: "Romex", short: "Romex" },
    bx: { material: 4.0, labor: 0.038, label: "BX / MC", short: "BX" },
    outdoor_armored: {
      material: 4.8,
      labor: 0.05,
      label: "Outdoor armored",
      short: "Outdoor",
    },
    conduit: { material: 4.25, labor: 0.075, label: "Conduit + 3 wires", short: "Conduit" },
  },
  6: {
    romex: { material: 4.15, labor: 0.03, label: "Romex", short: "Romex" },
    bx: { material: 4.75, labor: 0.042, label: "BX / MC", short: "BX" },
    outdoor_armored: {
      material: 5.4,
      labor: 0.055,
      label: "Outdoor armored",
      short: "Outdoor",
    },
    conduit: { material: 6.4, labor: 0.08, label: "Conduit + 3 wires", short: "Conduit" },
  },
};

const GAS_PATHS: LinearPath[] = [
  { id: "hard_34", label: '¾" galvanized', short: '¾" galv', materialPerFt: 4.04, laborHrPerFt: 0.05 },
  { id: "flex_34", label: '¾" CSST flex', short: '¾" flex', materialPerFt: 2.0, laborHrPerFt: 0.025 },
  { id: "hard_1", label: '1" galvanized', short: '1" galv', materialPerFt: 4.49, laborHrPerFt: 0.055 },
  { id: "flex_1", label: '1" CSST flex', short: '1" flex', materialPerFt: 2.1, laborHrPerFt: 0.028 },
];

const COND_PATHS: LinearPath[] = [
  { id: "pvc_34", label: '¾" PVC drain', short: "¾\" PVC", materialPerFt: 0.75, laborHrPerFt: 0.03 },
];

const VENT_PATHS: LinearPath[] = [
  {
    id: "pvc_2pipe",
    label: "2-pipe PVC vent",
    short: "2-pipe PVC",
    materialPerFt: 1.5,
    laborHrPerFt: 0.05,
  },
  {
    id: "pvc_1pipe",
    label: "Single PVC vent",
    short: "PVC vent",
    materialPerFt: 0.75,
    laborHrPerFt: 0.035,
  },
];

const TSTAT_PATHS: LinearPath[] = [
  { id: "tstat_185", label: "18/5 thermostat wire", short: "18/5", materialPerFt: 0.35, laborHrPerFt: 0.025 },
  { id: "tstat_188", label: "18/8 thermostat wire", short: "18/8", materialPerFt: 0.45, laborHrPerFt: 0.028 },
];

const BVENT_PATHS: LinearPath[] = [
  { id: "oval_bvent", label: "Oval Type-B flue", short: "B-vent", materialPerFt: 9.0, laborHrPerFt: 0.045 },
];

const WATER_PATHS: LinearPath[] = [
  { id: "copper_34", label: '¾" copper', short: '¾" copper', materialPerFt: 16.38, laborHrPerFt: 0.04 },
];

const LINESET_PATHS: LinearPath[] = [
  { id: "pair", label: "Insulated pair", short: "Pair", materialPerFt: 8.5, laborHrPerFt: 0.045 },
  { id: "linehide", label: "Line-hide / cover", short: "Line-hide", materialPerFt: 11.2, laborHrPerFt: 0.05 },
  { id: "attic", label: "Through attic / chase", short: "Attic", materialPerFt: 7.4, laborHrPerFt: 0.055 },
];

export function ampToGauge(breakerAmps?: number | null, ampId?: string | null): WireGauge {
  const n = Number(breakerAmps);
  if (Number.isFinite(n) && n > 0) {
    if (n <= 15) return 14;
    if (n <= 20) return 12;
    if (n <= 30) return 10;
    if (n <= 40) return 8;
    return 6;
  }
  if (ampId === "a15_20") return 12;
  if (ampId === "a25_30") return 10;
  if (ampId === "a35_40") return 8;
  if (ampId === "a45_50") return 6;
  return 12;
}

export function factoryPathsForFamily(
  family: LinearFamily,
  gauge: WireGauge = 12,
): LinearPath[] {
  if (family === "electrical") {
    const row = ELEC_BY_GAUGE[gauge];
    return (["romex", "bx", "outdoor_armored", "conduit"] as const).map((id) => ({
      id,
      label: row[id].label,
      short: row[id].short,
      materialPerFt: row[id].material,
      laborHrPerFt: row[id].labor,
    }));
  }
  if (family === "gas") return GAS_PATHS;
  if (family === "water") return WATER_PATHS;
  if (family === "line_set") return LINESET_PATHS;
  if (family === "condensate") return COND_PATHS;
  if (family === "pvc_vent") return VENT_PATHS;
  if (family === "thermostat") return TSTAT_PATHS;
  return BVENT_PATHS;
}

export function pathsForFamily(
  family: LinearFamily,
  gauge: WireGauge = 12,
): LinearPath[] {
  return overlayLinearPaths(
    family,
    factoryPathsForFamily(family, gauge),
    family === "electrical" ? gauge : undefined,
  );
}

export function resolvedPenTypes() {
  return overlayPenTypes(PEN_TYPES);
}

export function familyTitle(family: LinearFamily, gauge?: WireGauge): string {
  if (family === "electrical") {
    return gauge ? `Circuit run — ${gauge} gauge` : "Circuit run";
  }
  if (family === "gas") return "Gas line run";
  if (family === "water") return "Water line run";
  if (family === "line_set") return "Line set";
  if (family === "condensate") return "Condensate drain";
  if (family === "pvc_vent") return "PVC vent";
  if (family === "thermostat") return "Thermostat wire";
  return "Type-B flue";
}

export function emptyStretch(path = ""): LinearStretch {
  return {
    id: `s_${Math.random().toString(36).slice(2, 8)}`,
    path,
    feet: 0,
    difficulty: "easy",
    pen: "none",
    penQty: 1,
    pens: [],
  };
}

export function isLinearRunValue(v: unknown): v is LinearRunValue {
  return Boolean(v && typeof v === "object" && Array.isArray((v as LinearRunValue).stretches));
}

export function parseLinearRun(raw: unknown): LinearRunValue {
  if (isLinearRunValue(raw)) {
    const coverRaw = (raw as LinearRunValue).coverStretches;
    return {
      termination: String((raw as LinearRunValue).termination || ""),
      roofKind: String((raw as LinearRunValue).roofKind || ""),
      roofAccess: String((raw as LinearRunValue).roofAccess || ""),
      rollFeet: Math.max(0, Number((raw as LinearRunValue).rollFeet) || 0),
      pens: Array.isArray((raw as LinearRunValue).pens)
        ? (raw as LinearRunValue).pens
        : [],
      coverStretches: Array.isArray(coverRaw)
        ? coverRaw.map((s) => ({
            id: String(s.id || emptyStretch().id),
            path: "linehide",
            feet: Math.max(0, Number(s.feet) || 0),
            difficulty:
              s.difficulty === "difficult" || s.difficulty === "very_hard"
                ? s.difficulty
                : "easy",
            pens: [],
          }))
        : [],
      stretches: raw.stretches.map((s) => ({
        id: String(s.id || emptyStretch().id),
        path: String(s.path || ""),
        feet: Math.max(0, Number(s.feet) || 0),
        difficulty:
          s.difficulty === "difficult" || s.difficulty === "very_hard"
            ? s.difficulty
            : "easy",
        pen:
          s.pen === "wood" ||
          s.pen === "stucco" ||
          s.pen === "brick" ||
          s.pen === "sheetrock" ||
          s.pen === "roof"
            ? s.pen
            : "none",
        penQty: Math.max(1, Math.min(6, Number(s.penQty) || 1)),
        pens: stretchPens(s),
      })),
    };
  }
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      return parseLinearRun(JSON.parse(raw));
    } catch {
      return { stretches: [] };
    }
  }
  return { stretches: [] };
}

export function pruneLinearRun(raw: unknown): LinearRunValue {
  const run = parseLinearRun(raw);
  return {
    ...run,
    stretches: run.stretches.filter((s) => s.path && Number(s.feet) > 0),
    coverStretches: (run.coverStretches || []).filter(
      (s) => Number(s.feet) > 0,
    ),
  };
}

export function linearRunComplete(
  raw: unknown,
  required = true,
  family?: LinearFamily,
): boolean {
  const run = pruneLinearRun(raw);
  const stretches = run.stretches;
  if (!required && stretches.length === 0) return true;
  if (!stretches.length) return false;
  const stretchesOk = stretches.every(
    (s) => s.path && Number.isFinite(s.feet) && s.feet > 0 && s.difficulty,
  );
  if (!stretchesOk) return false;
  if (family === "line_set") {
    const roll = Number((raw as LinearRunValue)?.rollFeet) || 0;
    if (![30, 50, 80, 100].includes(roll)) return false;
    const laborFt = stretches
      .filter((s) => s.path !== "linehide")
      .reduce((n, s) => n + (Number(s.feet) || 0), 0);
    if (laborFt <= 0) return false;
  }
  if (family && VENT_OUTLETS[family]) {
    if (!run.termination) return false;
    if (run.termination === "roof" && (!run.roofKind || !run.roofAccess)) {
      return false;
    }
  }
  return true;
}

export function difficultyOf(id: string) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
}

export function priceLinearRun(
  family: LinearFamily,
  raw: unknown,
  gauge: WireGauge = 12,
): { laborHours: number; materialCost: number; totalFeet: number } {
  const paths = pathsForFamily(family, gauge);
  const run = parseLinearRun(raw);
  let laborHours = 0;
  let materialCost = 0;
  let totalFeet = 0;
  let usedFlex34 = false;
  let usedFlex1 = false;
  for (const s of run.stretches) {
    if (!s.path || !(s.feet > 0)) continue;
    const path =
      paths.find((p) => p.id === s.path) ||
      (family === "water" ? paths[0] : undefined);
    if (!path) continue;
    const mult = difficultyOf(s.difficulty).multiplier;
    laborHours += path.laborHrPerFt * s.feet * mult;
    if (family !== "line_set") materialCost += path.materialPerFt * s.feet;
    totalFeet += s.feet;
    if (s.path === "flex_34") usedFlex34 = true;
    if (s.path === "flex_1") usedFlex1 = true;
    for (const row of stretchPens(s)) {
      const pen = resolvedPenTypes().find((p) => p.id === row.kind);
      if (pen) {
        laborHours += pen.labor * row.qty;
        materialCost += pen.material * row.qty;
      }
    }
  }
  if (family === "line_set") {
    const hide = paths.find((p) => p.id === "linehide") || {
      materialPerFt: 11.2,
      laborHrPerFt: 0.05,
    };
    for (const s of run.coverStretches || []) {
      if (!(s.feet > 0)) continue;
      const mult = difficultyOf(s.difficulty).multiplier;
      laborHours += hide.laborHrPerFt * s.feet * mult;
      materialCost += hide.materialPerFt * s.feet;
      totalFeet += s.feet;
    }
    const runPens = Array.isArray(run.pens) ? run.pens : [];
    for (const row of runPens) {
      const pen = resolvedPenTypes().find((p) => p.id === row.kind);
      if (pen) {
        laborHours += pen.labor * (row.qty || 1);
        materialCost += pen.material * (row.qty || 1);
      }
    }
  }
  if (usedFlex34) materialCost += 45;
  if (usedFlex1) materialCost += 65;
  if (family === "line_set" && run.rollFeet) {
    const path =
      paths.find((p) => run.stretches.some((s) => s.path === p.id)) || paths[0];
    if (path) materialCost += path.materialPerFt * run.rollFeet;
  }
  if (run.termination === "roof") {
    const rk = ROOF_KINDS.find((k) => k.id === run.roofKind);
    const ra = ROOF_ACCESS.find((k) => k.id === run.roofAccess);
    if (rk) {
      laborHours += rk.labor;
      materialCost += rk.material;
    }
    if (ra) laborHours += ra.labor;
  }
  return {
    laborHours: Math.round(laborHours * 100) / 100,
    materialCost: Math.round(materialCost * 100) / 100,
    totalFeet: Math.round(totalFeet * 10) / 10,
  };
}

export function linearRunSummary(
  family: LinearFamily,
  raw: unknown,
  gauge?: WireGauge,
): string {
  const paths = pathsForFamily(family, gauge || 12);
  const run = parseLinearRun(raw);
  const bits = run.stretches
    .filter((s) => s.path && s.feet > 0)
    .map((s) => {
      const p = paths.find((x) => x.id === s.path);
      const d = difficultyOf(s.difficulty);
      const pens = stretchPens(s);
      const penBit = pens.length
        ? ` · ${pens.map((p) => `${p.qty}× ${p.kind}`).join(" + ")}`
        : "";
      return `${p?.short || s.path} ${s.feet} ft · ${d.label}${penBit}`;
    });
  return bits.join(" + ") || "—";
}

export function linearRunScopeLines(
  family: LinearFamily,
  raw: unknown,
  gauge?: WireGauge,
): string[] {
  const paths = pathsForFamily(family, gauge || 12);
  const run = parseLinearRun(raw);
  const parts = run.stretches
    .filter((s) => s.path && s.feet > 0)
    .map((s) => {
      const p = paths.find((x) => x.id === s.path);
      const d = difficultyOf(s.difficulty);
      const pens = stretchPens(s);
      const pen =
        pens.length
          ? `, ${pens
              .map(
                (p) =>
                  `${p.qty} ${penLabel(p.kind).toLowerCase()} penetration${p.qty > 1 ? "s" : ""}`,
              )
              .join(" and ")}`
          : "";
      return `${s.feet} ft of ${p?.label || s.path} (${d.label.toLowerCase()} access${pen})`;
    });
  if (!parts.length) return [];
  const termOpts = RUN_TERMINATIONS[family] || [];
  const ventOut = (VENT_OUTLETS[family] || []).find((t) => t.id === run.termination);
  const term = ventOut || termOpts.find((t) => t.id === run.termination);
  const termBit = term
    ? ` Terminate ${ventOut ? ventOut.label.toLowerCase() : `at ${term.label.toLowerCase()}`}.`
    : "";
  const extra: string[] = [];
  if (run.termination === "roof") {
    const rk = ROOF_KINDS.find((k) => k.id === run.roofKind);
    const ra = ROOF_ACCESS.find((k) => k.id === run.roofAccess);
    if (rk) extra.push(rk.scope);
    if (ra && ra.labor > 0) extra.push(`Roof access: ${ra.label}.`);
  }
  if (family === "electrical") {
    // 15/20A (12 or 14 ga) — never print gauge to the customer. 10 ga+ is real outdoor gear.
    const g =
      gauge && gauge <= 10 ? `${gauge}-gauge ` : "";
    return [`Run ${g}circuit wiring: ${parts.join("; ")}.`];
  }
  if (family === "gas") {
    return [`Install gas piping: ${parts.join("; ")}. Install sediment trap and shutoff as required.`];
  }
  if (family === "water") {
    return [`Install water piping: ${parts.join("; ")}.${termBit}`];
  }
  if (family === "line_set") {
    const sold = run.rollFeet ? `${run.rollFeet} ft line set, ` : "";
    const access = run.stretches
      .filter((s) => s.path !== "linehide" && s.feet > 0)
      .map((s) => {
        const lane = LINE_SET_LANES.find((l) => l.id === s.difficulty);
        return `${s.feet} ft ${lane?.label.toLowerCase() || "easy"}`;
      });
    const holeBits = (run.pens || [])
      .filter((p) => p.kind && p.qty > 0)
      .map(
        (p) =>
          `${p.qty} ${penLabel(p.kind).toLowerCase()} hole${p.qty > 1 ? "s" : ""}`,
      );
    const line =
      `Run a ${sold}refrigerant line to this indoor` +
      (access.length ? ` — ${access.join(", ")}` : "") +
      (holeBits.length ? `, ${holeBits.join(" and ")}` : "") +
      ".";
    const lines = [line];
    if (lineSetCoverFeet(run) > 0) {
      lines.push(LINE_SET_COVER_SCOPE);
    }
    return lines;
  }
  if (family === "condensate") {
    return [`Install condensate / pan drain piping: ${parts.join("; ")}.${termBit}`];
  }
  if (family === "pvc_vent") {
    return [`Install PVC venting: ${parts.join("; ")}.${termBit}`, ...extra];
  }
  if (family === "thermostat") {
    return [`Install new thermostat wiring: ${parts.join("; ")}.`];
  }
  return [`Install Type-B flue: ${parts.join("; ")}.${termBit}`, ...extra];
}
