/**
 * Optional kit picker — one shared list after the unit + location.
 * Unpicked items never enter the site-question path.
 * Sister measures (thermostat, filter) hide the matching card.
 */
import type { Product } from "./proposal-types";
import { resolveDisplayDimensions } from "./equipment-dimensions";
import type { MeasureFamilyId, MeasureInstance, WizardAnswers } from "./quote-wizard";
import type { ScopeAnswers } from "./scope-wizard";
import { overlayAccessoryDef } from "./accessory-kit-store";
import { demoIsSet, familyNeedsDemoStep } from "./demo-any";

export type AccessoryDef = {
  id: string;
  label: string;
  blurb: string;
  img: string;
  /** Decision lives on the card — hide these questions always */
  ownedQuestionIds: string[];
  /** Only asked if this accessory is on */
  followUpQuestionIds: string[];
  pickAnswers?: ScopeAnswers;
  skipAnswers: ScopeAnswers;
  /** Can be offered on the packet instead of included in the sold job. */
  canOffer?: boolean;
  laborHours?: number;
  materialCost?: number;
  offerScopeLine?: string;
  /** Simple = one packet line, no benefits. Rich = pad-style benefits. */
  packetTone?: "simple" | "rich";
  offerBenefitLines?: string[];
  /** One client-facing benefit paragraph for small extras. */
  packetBenefit?: string;
  /** Never show Offer — stand, bonding, etc. */
  includeOnly?: boolean;
  includeOnlyNote?: string;
  /** Mutually exclusive kits (e.g. moisture vs dual sensor). */
  exclusiveGroup?: string;
  /** Not built out yet — lighter card. */
  placeholder?: boolean;
};

function isTankStyle(style: string | null | undefined) {
  return (
    style === "gas-tank" ||
    style === "he-gas" ||
    style === "electric-tank" ||
    style === "hybrid"
  );
}

export const PAD_FOLLOW_UP_IDS = [
  "pad_size",
  "pad_grade",
  "pad_haul_in",
  "pad_rebar",
];

export const PAD_FLOW_TAIL_IDS = [
  "pad_base",
  "pad_preform_grade",
  "pad_offer_custom",
  ...PAD_FOLLOW_UP_IDS,
];

export const DRAIN_PAN_FOLLOW_UP_IDS = [
  "wh_pan_drain",
  "wh_pan_run",
];

export const RECIRC_FOLLOW_UP_IDS = [
  "wh_recirc_kind",
  "wh_recirc_ft",
  "wh_recirc_access",
  "wh_recirc_power",
];

export const THERMOSTAT_QUESTION_IDS = [
  "thermostat_hp",
  "thermostat_wire",
  "wall_stat",
  "wall_stat_wire",
  "wall_tstat_run",
];

export function jobHasFamily(
  answers: WizardAnswers | undefined,
  familyId: MeasureFamilyId,
): boolean {
  return (answers?.measureInstances || []).some(
    (m) => m.familyId === familyId && (m.productId || m.familyId === "custom"),
  );
}

export function instanceIsAttic(inst: {
  installLocationPreset?: string | null;
  installLocationLabel?: string | null;
}): boolean {
  const blob = `${inst.installLocationPreset || ""} ${inst.installLocationLabel || ""}`.toLowerCase();
  return /\battic\b/.test(blob);
}

export const ATTIC_HATCH_FOLLOW_UP_IDS = [
  "attic_hatch_work",
  "attic_hatch_diff",
  "attic_hatch_finish",
];

export const ATTIC_LADDER_FOLLOW_UP_IDS = [
  "attic_ladder_frame",
  "attic_ladder_diff",
];

export const STRAP_FOLLOW_UP_IDS = ["strap_kind"];

const STRAP_SCOPE_NEW =
  "Install new proper earthquake strapping system to meet current code requirements as needed.";

const ATTIC_HATCH_KIT: AccessoryDef = {
  id: "attic_hatch",
  label: "Attic hatch",
  blurb: "New access opening",
  img: "/accessories/attic-hatch.svg",
  ownedQuestionIds: [],
  followUpQuestionIds: [...ATTIC_HATCH_FOLLOW_UP_IDS],
  skipAnswers: {
    attic_hatch_active: "no",
    ah_access: "in_place",
  },
  canOffer: true,
  laborHours: 4,
  materialCost: 180,
  packetTone: "simple",
  offerScopeLine:
    "Cut or enlarge attic access to meet code and this equipment.",
  packetBenefit:
    "A proper attic hatch is meant so this unit can go in and be serviced to code. Site framing still governs the opening.",
};

const ATTIC_LADDER_KIT: AccessoryDef = {
  id: "attic_ladder",
  label: "Pull-down ladder",
  blurb: "Same opening — upgrade",
  img: "/accessories/attic-ladder.svg",
  ownedQuestionIds: [],
  followUpQuestionIds: [...ATTIC_LADDER_FOLLOW_UP_IDS],
  skipAnswers: { attic_ladder_active: "no" },
  canOffer: true,
  laborHours: 3.5,
  materialCost: 189,
  packetTone: "simple",
  offerScopeLine:
    "Install a pull-down attic ladder in the access opening, framed and trimmed.",
  packetBenefit:
    "A pull-down ladder is meant so the homeowner can use the attic without a loose ladder. Framing and ceiling height still govern the install.",
};

const STRAP_KIT: AccessoryDef = {
  id: "earthquake_strap",
  label: "Earthquake strap",
  blurb: "New straps — skip if existing is still good",
  img: "/accessories/earthquake-strap.svg",
  ownedQuestionIds: ["strap_kind"],
  followUpQuestionIds: [...STRAP_FOLLOW_UP_IDS],
  pickAnswers: { strap_kind: "new", strap_active: "yes" },
  skipAnswers: { strap_kind: "existing", strap_active: "no" },
  canOffer: true,
  laborHours: 0.4,
  materialCost: 52,
  packetTone: "simple",
  offerScopeLine: STRAP_SCOPE_NEW,
  packetBenefit:
    "New earthquake strapping is meant to keep this equipment from walking or tipping in a quake, to current code as needed. Existing straps that are still good can stay.",
};

const WH_TANK_KITS: AccessoryDef[] = [
  {
    id: "drain_pan",
    label: "Drain pan",
    blurb: "Under the tank",
    img: "/accessories/drain-pan.svg",
    ownedQuestionIds: ["wh_drain_pan"],
    followUpQuestionIds: [...DRAIN_PAN_FOLLOW_UP_IDS],
    pickAnswers: { wh_drain_pan: "add", wh_pan_active: "yes" },
    skipAnswers: { wh_drain_pan: "not_needed", wh_pan_active: "no" },
    canOffer: true,
    laborHours: 0.25,
    packetTone: "simple",
    offerScopeLine:
      "Install new drain pan properly terminated to the exterior.",
    packetBenefit:
      "A drain pan under the tank is meant to intercept water that collects at the heater and send it to a drain. It is a safeguard, not a guarantee against every leak or water damage.",
  },
  {
    id: "stand",
    label: "Stand",
    blurb: "Sized to this tank",
    img: "/accessories/stand.svg",
    ownedQuestionIds: ["wh_stand"],
    followUpQuestionIds: [],
    skipAnswers: { wh_stand: "not_needed" },
    includeOnly: true,
    includeOnlyNote: "Stand changes water connections — include only.",
  },
  {
    id: "expansion",
    label: "Expansion tank",
    blurb: "Closed system",
    img: "/accessories/expansion.svg",
    ownedQuestionIds: ["wh_expansion"],
    followUpQuestionIds: [],
    pickAnswers: { wh_expansion: "add" },
    skipAnswers: { wh_expansion: "not_needed" },
    canOffer: true,
    laborHours: 0.35,
    packetTone: "simple",
    offerScopeLine: "Install expansion tank on the cold water line as required for a closed system.",
    packetBenefit:
      "An expansion tank is meant to absorb pressure swing on a closed water system when the heater fires. It is a safeguard, not a promise that fixtures or the tank will never see stress.",
  },
  {
    id: "prefilter",
    label: "Pre-filter",
    blurb: "Sediment on the cold",
    img: "/accessories/prefilter.svg",
    ownedQuestionIds: ["wh_prefilter"],
    followUpQuestionIds: [],
    pickAnswers: { wh_prefilter: "add" },
    skipAnswers: { wh_prefilter: "not_needed" },
    canOffer: true,
    laborHours: 0.35,
    packetTone: "simple",
    offerScopeLine: "Install sediment pre-filter on the incoming water line.",
    packetBenefit:
      "A sediment pre-filter on the incoming cold line is meant to intercept grit before it reaches the new heater. It is a help, not a guarantee of longer tank or valve life.",
  },
  {
    id: "bonding",
    label: "Bonding / dielectric",
    blurb: "Jumper if the job needs it",
    img: "/accessories/bonding.svg",
    ownedQuestionIds: ["wh_bonding"],
    followUpQuestionIds: [],
    pickAnswers: { wh_bonding: "add" },
    skipAnswers: { wh_bonding: "not_needed" },
    includeOnly: true,
    includeOnlyNote: "Bonding is a code item — include only.",
  },
];

const WH_RECIRC_KIT: AccessoryDef = {
  id: "recirc",
  label: "Recirc",
  blurb: "Reattach existing loop",
  img: "/accessories/recirc.svg",
  ownedQuestionIds: ["wh_recirc"],
  followUpQuestionIds: [...RECIRC_FOLLOW_UP_IDS],
  pickAnswers: { wh_recirc: "reattach" },
  skipAnswers: { wh_recirc: "none" },
  canOffer: true,
  offerScopeLine: "Reattach existing recirculation loop to the new water heater.",
  packetTone: "simple",
  packetBenefit:
    "We reconnect your existing recirculation loop so the new heater can work with the circulation you already have. Wait time still depends on the loop and how the home is used.",
};

const TL_KITS: AccessoryDef[] = [
  {
    id: "tl_recirc",
    label: "Recirc",
    blurb: "Navien / tankless ready-link",
    img: "/accessories/recirc.svg",
    ownedQuestionIds: ["wh_recirc"],
    followUpQuestionIds: [...RECIRC_FOLLOW_UP_IDS],
    pickAnswers: { wh_recirc: "reattach" },
    skipAnswers: { wh_recirc: "none" },
    canOffer: true,
    laborHours: 1.5,
    materialCost: 420,
    packetTone: "simple",
    offerScopeLine:
      "Install tankless recirculation for a ready-hot-water loop.",
    packetBenefit:
      "A recirc loop is meant to shorten the wait for hot water at the tap. It is a comfort upgrade — wait and water use still depend on the home and how the loop is set.",
  },
  {
    id: "comfort_valve",
    label: "Comfort valve",
    blurb: "Navien A-series ready loop",
    img: "/accessories/recirc.svg",
    ownedQuestionIds: ["wh_comfort_valve"],
    followUpQuestionIds: [],
    pickAnswers: { wh_comfort_valve: "add" },
    skipAnswers: { wh_comfort_valve: "not_needed" },
    canOffer: true,
    laborHours: 0.5,
    packetTone: "simple",
    offerScopeLine:
      "Install Navien comfort valve to maintain a ready hot-water loop.",
    packetBenefit:
      "The comfort valve is meant to hold a ready loop so hot water is closer at the fixtures you use most. It is a comfort aid, not a guarantee of instant hot water at every tap.",
  },
];

const THERMOSTAT_KIT: AccessoryDef = {
  id: "thermostat",
  label: "Thermostat",
  blurb: "New or reuse — asked next",
  img: "/product-art/thermostat.svg",
  ownedQuestionIds: [],
  followUpQuestionIds: [
    "thermostat_hp",
    "thermostat_wire",
    "wall_stat",
    "wall_stat_wire",
    "wall_tstat_run",
  ],
  skipAnswers: {
    thermostat_hp: "reuse",
    wall_stat: "existing",
    wall_stat_wire: "verified",
  },
};

const FILTER_KIT: AccessoryDef = {
  id: "filter",
  label: "Media filter",
  blurb: "Skip if already a measure",
  img: "/product-art/filter.svg",
  ownedQuestionIds: ["kit_media_filter"],
  followUpQuestionIds: [],
  pickAnswers: { kit_media_filter: "add" },
  skipAnswers: { kit_media_filter: "not_needed" },
  canOffer: true,
  laborHours: 0.75,
  materialCost: 280,
  packetTone: "simple",
  offerScopeLine: "Install media air filter upgrade.",
  packetBenefit:
    "A media filter is meant to trap more dust than a throwaway filter and help the coil stay cleaner. Indoor air and coil life still depend on the home, use, and filter changes.",
};

const PAD_KIT: AccessoryDef = {
  id: "pad",
  label: "Concrete pad",
  blurb: "Offer it on the packet — bolts down, doesn’t move",
  img: "/accessories/pad.svg",
  ownedQuestionIds: ["pad_kind"],
  followUpQuestionIds: [...PAD_FOLLOW_UP_IDS],
  pickAnswers: { pad_kind: "new", pad_base: "custom", pad_active: "yes" },
  skipAnswers: { pad_active: "no" },
  canOffer: true,
  laborHours: 0,
  materialCost: 0,
  packetTone: "simple",
  offerScopeLine:
    "Form and pour a custom concrete pad under the outdoor unit, sized and finished for this equipment, and secure the unit to the pad per building code requirements.",
  offerBenefitLines: [
    "A poured concrete pad is the most secure sit — we bolt the outdoor unit down so it doesn’t walk or tilt.",
    "Preformed pads are what the industry uses to keep the price down. They sit on grade and they can shift.",
    "Concrete is the pad we recommend whenever the path and budget allow it.",
  ],
};

const FUTURE_HEADS_KIT: AccessoryDef = {
  id: "future_heads",
  label: "Prep for future head(s)",
  blurb: "Larger outdoor now so a head can be added later",
  img: "/product-photos/minisplit.jpg",
  ownedQuestionIds: ["ms_future_heads"],
  followUpQuestionIds: [],
  pickAnswers: { ms_future_heads: "yes" },
  skipAnswers: { ms_future_heads: "no" },
  canOffer: true,
  packetTone: "simple",
  offerScopeLine:
    "Size the outdoor unit for a future indoor head so a later zone can be added without replacing the condenser.",
  packetBenefit:
    "The outdoor is sized with spare capacity so a future indoor head can be added later. Two heads is the minimum on a multi-zone — a third, fourth, or sixth head can be the option.",
};

const SOUND_WALL_KIT: AccessoryDef = {
  id: "sound_wall",
  label: "Sound wall",
  blurb: "Hold — design & price later",
  img: "/accessories/sound-wall.svg",
  ownedQuestionIds: ["sound_wall"],
  followUpQuestionIds: [],
  pickAnswers: { sound_wall: "hold" },
  skipAnswers: { sound_wall: "none" },
  canOffer: true,
  placeholder: true,
  offerScopeLine:
    "Outdoor sound wall at the condensing unit — design and price to follow.",
  packetTone: "simple",
};

const DISGUISE_WALL_KIT: AccessoryDef = {
  id: "disguise_wall",
  label: "Disguise wall",
  blurb: "Hold — screen / hide the unit",
  img: "/accessories/disguise-wall.svg",
  ownedQuestionIds: ["disguise_wall"],
  followUpQuestionIds: [],
  pickAnswers: { disguise_wall: "hold" },
  skipAnswers: { disguise_wall: "none" },
  canOffer: true,
  placeholder: true,
  offerScopeLine:
    "Privacy / disguise wall at the outdoor unit — design and price to follow.",
  packetTone: "simple",
};

const DV_EXT_WILLIAMS: AccessoryDef = {
  id: "dv_extension",
  label: "DV extension kit",
  blurb: "Williams · up to 24\"",
  img: "/accessories/dv-extension.svg",
  ownedQuestionIds: ["wall_dv_ext"],
  followUpQuestionIds: [],
  pickAnswers: { wall_dv_ext: "yes" },
  skipAnswers: { wall_dv_ext: "no" },
};

const DV_EXT_RINNAI: AccessoryDef = {
  id: "rin_extension",
  label: "Vent extension",
  blurb: "Rinnai kit · rarely needed",
  img: "/accessories/dv-extension.svg",
  ownedQuestionIds: ["wall_rin_ext"],
  followUpQuestionIds: [],
  pickAnswers: { wall_rin_ext: "yes" },
  skipAnswers: { wall_rin_ext: "no" },
};

const BATH_FAN_MODULES: AccessoryDef[] = [
  {
    id: "fan_moisture",
    label: "Moisture sensor",
    blurb: "Turns the fan on when humidity rises",
    img: "/accessories/fan-moisture.svg",
    exclusiveGroup: "fan_sensor",
    ownedQuestionIds: [],
    followUpQuestionIds: [],
    skipAnswers: {},
    canOffer: true,
    laborHours: 0.25,
    materialCost: 78,
    packetTone: "simple",
    offerScopeLine:
      "Install a Panasonic condensation / moisture sensor module in the WhisperGreen Select.",
    packetBenefit:
      "The moisture sensor turns the fan on when humidity rises so the bath dries without leaving it running.",
  },
  {
    id: "fan_motion",
    label: "Motion sensor",
    blurb: "Turns on when someone walks in",
    img: "/accessories/fan-motion.svg",
    exclusiveGroup: "fan_sensor",
    ownedQuestionIds: [],
    followUpQuestionIds: [],
    skipAnswers: {},
    canOffer: true,
    laborHours: 0.25,
    materialCost: 78,
    packetTone: "simple",
    offerScopeLine:
      "Install a Panasonic motion sensor module in the WhisperGreen Select.",
    packetBenefit:
      "The motion sensor starts the fan when someone enters and times off after they leave.",
  },
  {
    id: "fan_dual_sensor",
    label: "Moisture + motion",
    blurb: "One module — humidity or occupancy",
    img: "/accessories/fan-dual.svg",
    exclusiveGroup: "fan_sensor",
    ownedQuestionIds: [],
    followUpQuestionIds: [],
    skipAnswers: {},
    canOffer: true,
    laborHours: 0.3,
    materialCost: 145,
    packetTone: "simple",
    offerScopeLine:
      "Install a Panasonic dual moisture and motion sensor module in the WhisperGreen Select.",
    packetBenefit:
      "One module covers humidity and occupancy so the fan runs when the room needs it.",
  },
  {
    id: "fan_multispeed",
    label: "Multi-speed + delay",
    blurb: "Low continuous, boosts on demand",
    img: "/accessories/fan-speed.svg",
    ownedQuestionIds: [],
    followUpQuestionIds: [],
    skipAnswers: {},
    canOffer: true,
    laborHours: 0.15,
    materialCost: 62,
    packetTone: "simple",
    offerScopeLine:
      "Install a Panasonic multi-speed with time-delay module in the WhisperGreen Select.",
    packetBenefit:
      "A low continuous speed keeps air moving, then the fan boosts and times back down.",
  },
  {
    id: "fan_wifi",
    label: "Wi-Fi module",
    blurb: "App / smart-home control",
    img: "/accessories/fan-wifi.svg",
    ownedQuestionIds: [],
    followUpQuestionIds: [],
    skipAnswers: {},
    canOffer: true,
    laborHours: 0.2,
    materialCost: 88,
    packetTone: "simple",
    offerScopeLine:
      "Install a Panasonic Wi-Fi control module in the WhisperGreen Select.",
    packetBenefit:
      "Wi-Fi lets the homeowner see and control the fan from the phone.",
  },
];

export function bathFanTakesModules(inst: {
  familyId?: string;
  productId?: string | null;
}): boolean {
  if (inst.familyId !== "bath_fan") return false;
  const id = (inst.productId || "").toLowerCase();
  return /vks3/.test(id);
}

export const ACCESSORY_CATALOG: { group: string; def: AccessoryDef }[] = [
  ...WH_TANK_KITS.map((def) => ({ group: "Water heater · tank", def })),
  { group: "Water heater · tank", def: WH_RECIRC_KIT },
  ...TL_KITS.map((def) => ({ group: "Water heater · tankless", def })),
  { group: "Attic access", def: ATTIC_HATCH_KIT },
  { group: "Attic access", def: ATTIC_LADDER_KIT },
  { group: "Seismic", def: STRAP_KIT },
  { group: "Outdoor pad", def: PAD_KIT },
  { group: "Ductless extras", def: FUTURE_HEADS_KIT },
  { group: "Outdoor screens", def: SOUND_WALL_KIT },
  { group: "Outdoor screens", def: DISGUISE_WALL_KIT },
  { group: "Wall heater", def: DV_EXT_WILLIAMS },
  { group: "Wall heater", def: DV_EXT_RINNAI },
  { group: "System extras", def: THERMOSTAT_KIT },
  { group: "System extras", def: FILTER_KIT },
  ...BATH_FAN_MODULES.map((def) => ({ group: "Bath fan · Select modules", def })),
];

export function resolvedAccessoryCatalog() {
  return ACCESSORY_CATALOG.map(({ group, def }) => ({
    group,
    def: overlayAccessoryDef(def),
  }));
}

const KIT_NOUN: Record<string, string> = {
  water_heater: "water heater",
  wall_heater: "wall heater",
  heat_pump: "heat pump",
  air_handler: "air handler",
  furnace: "furnace",
  bath_fan: "bath fan",
};

export function kitAccessoryHeadline(inst: {
  familyId?: string;
  label?: string;
}): string {
  if (inst.familyId === "ductless") {
    return "Outdoor extras — pad and future heads";
  }
  if (inst.familyId === "water_heater") {
    const style = (inst as MeasureInstance).waterHeaterStyle;
    const noun =
      style === "hybrid"
        ? "heat pump water heater"
        : style === "sanden-split"
          ? "Sanden water heater"
          : style === "tankless"
            ? "tankless water heater"
            : style === "he-gas"
              ? "high-efficiency gas water heater"
              : style === "electric-tank"
                ? "electric tank water heater"
                : style === "gas-tank"
                  ? "gas tank water heater"
                  : "water heater";
    return `Add accessories to this ${noun}`;
  }
  const mapped = KIT_NOUN[inst.familyId || ""];
  if (mapped) return `Add accessories to this ${mapped}`;
  const raw = (inst.label || "unit").trim().toLowerCase();
  return `Add accessories to this ${raw}`;
}

export function accessoriesForInstance(
  inst: MeasureInstance,
  answers?: WizardAnswers,
): AccessoryDef[] {
  const out: AccessoryDef[] = [];
  const hasStat = jobHasFamily(answers, "thermostat");
  const hasFilter = jobHasFamily(answers, "air_cleaner");

  if (
    instanceIsAttic(inst) &&
    (inst.familyId === "air_handler" ||
      inst.familyId === "furnace" ||
      inst.familyId === "water_heater")
  ) {
    out.unshift(ATTIC_HATCH_KIT, ATTIC_LADDER_KIT);
  }

  if (inst.familyId === "water_heater" && isTankStyle(inst.waterHeaterStyle)) {
    out.push(STRAP_KIT);
    out.push(...WH_TANK_KITS);
    if (inst.waterHeaterStyle === "gas-tank") out.push(WH_RECIRC_KIT);
  }
  if (inst.familyId === "water_heater" && inst.waterHeaterStyle === "tankless") {
    out.push(...TL_KITS);
  }

  if (
    inst.familyId === "heat_pump" ||
    inst.familyId === "ac" ||
    inst.familyId === "ductless"
  ) {
    const hosts = (answers?.measureInstances || []).filter(
      (i) =>
        i.familyId === "heat_pump" ||
        i.familyId === "ac" ||
        i.familyId === "ductless",
    );
    if (!hosts.length || hosts[0].id === inst.id) out.push(PAD_KIT);
    if (inst.familyId === "ductless") out.push(FUTURE_HEADS_KIT);
  }

  if (inst.familyId === "wall_heater") {
    if (inst.wallVentStyle === "direct_vent") out.push(DV_EXT_WILLIAMS);
    if (inst.wallVentStyle === "rinnai") out.push(DV_EXT_RINNAI);
  }

  if (
    (inst.familyId === "heat_pump" ||
      inst.familyId === "furnace" ||
      inst.familyId === "air_handler") &&
    !hasStat
  ) {
    out.push(THERMOSTAT_KIT);
  }

  if (
    (inst.familyId === "furnace" || inst.familyId === "air_handler") &&
    !hasFilter &&
    inst.furnaceEffStyle !== "navien_npf" &&
    inst.hpInstallPath !== "mini-split" &&
    inst.hpInstallPath !== "mini" &&
    inst.hpInstallPath !== "interconnect"
  ) {
    out.push(FILTER_KIT);
  }

  if (bathFanTakesModules(inst)) {
    out.push(...BATH_FAN_MODULES);
  }

  return out.map(overlayAccessoryDef);
}

export function accessoryOwnedQuestionIds(defs: AccessoryDef[]): Set<string> {
  const s = new Set<string>();
  for (const d of defs) for (const id of d.ownedQuestionIds) s.add(id);
  return s;
}

export function accessoryHiddenFollowUps(
  defs: AccessoryDef[],
  picks: string[] | undefined,
  offers?: string[],
): Set<string> {
  const active = new Set([...(picks || []), ...(offers || [])]);
  const s = new Set<string>();
  for (const d of defs) {
    if (active.has(d.id)) continue;
    for (const id of d.followUpQuestionIds) s.add(id);
  }
  return s;
}

/** Follow-ups for picked or offered accessories — ask after the core unit. */
export function accessoryTailQuestionIds(
  defs: AccessoryDef[],
  picks: string[] | undefined,
  offers?: string[],
): Set<string> {
  const active = new Set([...(picks || []), ...(offers || [])]);
  const s = new Set<string>();
  for (const d of defs) {
    if (!active.has(d.id)) continue;
    for (const id of d.followUpQuestionIds) s.add(id);
  }
  return s;
}

/** If this question is pricing an Option, return that accessory's label. */
export function offeredFollowUpLabel(
  inst: MeasureInstance,
  questionId: string,
  answers?: WizardAnswers,
): string | null {
  const ctx = accessoryContextForQuestion(inst, questionId, answers);
  return ctx?.offered ? ctx.label : null;
}

/**
 * Parent accessory for a site question — used so the live card
 * always names the extra (pad / drain pan / recirc), never just the unit.
 */
export function accessoryContextForQuestion(
  inst: MeasureInstance,
  questionId: string,
  answers?: WizardAnswers,
): { label: string; offered: boolean } | null {
  const defs = accessoriesForInstance(inst, answers);
  const offered = new Set(inst.accessoryOffers || []);
  const picked = new Set(inst.accessoryPicks || []);
  for (const d of defs) {
    const on = offered.has(d.id) || picked.has(d.id);
    if (!on) continue;
    if (d.followUpQuestionIds.includes(questionId)) {
      return { label: d.label, offered: offered.has(d.id) };
    }
  }
  // Preformed pad Qs are the job, not the concrete-option kit.
  if (questionId === "pad_base" || questionId === "pad_preform_grade") {
    return null;
  }
  // Stored leftovers (old pad_access, etc.) still belong to the kit.
  if (/^pad_/.test(questionId) && questionId !== "pad_active") {
    const pad = defs.find((d) => d.id === "pad");
    if (pad && (offered.has("pad") || picked.has("pad"))) {
      return { label: pad.label, offered: offered.has("pad") };
    }
  }
  if (/^wh_pan_/.test(questionId)) {
    const pan = defs.find((d) => d.id === "drain_pan");
    if (pan && (offered.has(pan.id) || picked.has(pan.id))) {
      return { label: pan.label, offered: offered.has(pan.id) };
    }
  }
  if (/^wh_recirc_/.test(questionId)) {
    const rec = defs.find((d) => d.id === "recirc");
    if (rec && (offered.has("recirc") || picked.has("recirc"))) {
      return { label: rec.label, offered: offered.has("recirc") };
    }
  }
  if (/^attic_hatch_/.test(questionId)) {
    const hatch = defs.find((d) => d.id === "attic_hatch");
    if (hatch && (offered.has("attic_hatch") || picked.has("attic_hatch"))) {
      return { label: hatch.label, offered: offered.has("attic_hatch") };
    }
  }
  if (/^attic_ladder_/.test(questionId)) {
    const lad = defs.find((d) => d.id === "attic_ladder");
    if (lad && (offered.has("attic_ladder") || picked.has("attic_ladder"))) {
      return { label: lad.label, offered: offered.has("attic_ladder") };
    }
  }
  if (/^strap_/.test(questionId)) {
    const strap = defs.find((d) => d.id === "earthquake_strap");
    if (
      strap &&
      (offered.has("earthquake_strap") || picked.has("earthquake_strap"))
    ) {
      return { label: strap.label, offered: offered.has("earthquake_strap") };
    }
  }
  return null;
}

export function standOptionForProduct(
  product?: Product | null,
): "s24" | "s30" | "s34" {
  const d = resolveDisplayDimensions(product || null);
  const span = Math.max(d?.widthIn || 0, d?.depthIn || 0);
  if (span <= 24) return "s24";
  if (span <= 30) return "s30";
  return "s34";
}

export function standChipLabel(optionId: string | undefined): string {
  if (optionId === "s24") return 'Stand · 24"';
  if (optionId === "s30") return 'Stand · 30"';
  if (optionId === "s34") return 'Stand · 34"';
  return "Stand";
}

export function applyAccessoryScope(
  inst: MeasureInstance,
  picks: string[],
  answers?: WizardAnswers,
  product?: Product | null,
): ScopeAnswers {
  const defs = accessoriesForInstance(inst, answers);
  const next: ScopeAnswers = { ...(inst.scopeAnswers || {}) };
  if (!instanceIsAttic(inst)) {
    next.attic_hatch_active = "no";
    next.attic_ladder_active = "no";
  }
  const offered = new Set(inst.accessoryOffers || []);
  const sold = picks.filter((id) => !offered.has(id));
  const soldSet = new Set(sold);
  for (const d of defs) {
    const active = soldSet.has(d.id) || offered.has(d.id);
    if (d.followUpQuestionIds.includes("wh_recirc_kind")) {
      next.wh_recirc_active = active ? "yes" : "no";
    }
    if (d.followUpQuestionIds.includes("wh_pan_drain")) {
      next.wh_pan_active = active ? "yes" : "no";
    }
    if (d.id === "pad") {
      const included = soldSet.has("pad");
      const isOffer = offered.has("pad");
      if (included) {
        next.pad_active = "yes";
        next.pad_path = "custom";
        next.pad_base = "custom";
        if (next.pad_kind === "not_needed") delete next.pad_kind;
        if (!next.pad_size) next.pad_size = "standard";
      } else if (isOffer) {
        // Option sits on top of the plastic pad — do not skip pad_base.
        next.pad_active = "offer";
        next.pad_path = "option";
        if (next.pad_base === "custom") delete next.pad_base;
      } else {
        next.pad_active = "no";
        next.pad_path = "none";
        if (next.pad_base === "custom") delete next.pad_base;
        delete next.pad_kind;
      }
    }
    if (d.id === "future_heads") {
      next.ms_future_heads = soldSet.has("future_heads") || offered.has("future_heads")
        ? "yes"
        : "no";
    }
    if (d.id === "attic_hatch") {
      next.attic_hatch_active = active ? "yes" : "no";
    }
    if (d.id === "attic_ladder") {
      next.attic_ladder_active = active ? "yes" : "no";
    }
    if (d.id === "earthquake_strap") {
      next.strap_active = active ? "yes" : "no";
      if (active) {
        if (!next.strap_kind || next.strap_kind === "existing") next.strap_kind = "new";
      } else if (!next.strap_kind) {
        next.strap_kind = "existing";
      }
    }
    if (soldSet.has(d.id)) {
      if (d.id === "stand") {
        next.wh_stand = standOptionForProduct(product);
      } else if (d.pickAnswers) {
        Object.assign(next, d.pickAnswers);
      }
      for (const id of d.followUpQuestionIds) {
        if (next[id] === "not_needed" || next[id] === "no") delete next[id];
      }
    } else if (offered.has(d.id)) {
      for (const id of d.followUpQuestionIds) {
        if (next[id] === "not_needed" || next[id] === "no" || next[id] === "none") {
          delete next[id];
        }
      }
    } else {
      Object.assign(next, d.skipAnswers);
      if (d.id === "pad" && inst.familyId === "ductless") {
        delete next.pad_kind;
      }
    }
  }
  return next;
}

export function applyAccessoryPicks(
  inst: MeasureInstance,
  picks: string[],
  answers?: WizardAnswers,
  product?: Product | null,
): Partial<MeasureInstance> {
  const offered = new Set(inst.accessoryOffers || []);
  const sold = picks.filter((id) => !offered.has(id));
  const scopeAnswers = applyAccessoryScope(inst, picks, answers, product);
  const needDemo =
    familyNeedsDemoStep(inst.familyId) &&
    !demoIsSet({ ...inst, scopeAnswers });
  return {
    accessoryPicks: sold,
    accessoryOffers: [...offered].filter((id) => !sold.includes(id)),
    accessoriesConfirmed: true,
    advisorReopen: needDemo ? "demo" : "site",
    scopeAnswers,
  };
}

/** Hide thermostat site Qs when a thermostat measure is already on the job. */
export function offeredFollowUpQuestionIds(
  inst: MeasureInstance,
  answers?: WizardAnswers,
): Set<string> {
  const offered = new Set(inst.accessoryOffers || []);
  const s = new Set<string>();
  if (!offered.size) return s;
  for (const d of accessoriesForInstance(inst, answers)) {
    if (!offered.has(d.id)) continue;
    for (const id of d.followUpQuestionIds) s.add(id);
  }
  return s;
}

/** Owned + follow-up ids for offered extras — keep them off the included work scope. */
export function offeredOptionQuestionIds(
  inst: MeasureInstance,
  answers?: WizardAnswers,
): Set<string> {
  const offered = new Set(inst.accessoryOffers || []);
  const s = new Set<string>();
  if (!offered.size) return s;
  for (const d of accessoriesForInstance(inst, answers)) {
    if (!offered.has(d.id)) continue;
    for (const id of d.ownedQuestionIds) s.add(id);
    for (const id of d.followUpQuestionIds) s.add(id);
  }
  return s;
}

export function padModeFromInstance(
  inst: MeasureInstance,
): "off" | "included" | "optional" {
  if ((inst.accessoryOffers || []).includes("pad")) return "optional";
  if ((inst.accessoryPicks || []).includes("pad")) return "included";
  return "off";
}

export function hideBecauseSisterMeasure(
  questionId: string,
  answers: WizardAnswers | undefined,
): boolean {
  if (THERMOSTAT_QUESTION_IDS.includes(questionId) && jobHasFamily(answers, "thermostat")) {
    return true;
  }
  return false;
}
