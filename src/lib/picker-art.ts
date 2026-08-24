import { useOwnerSettings } from "./owner-settings";

export type PickerArt = { img: string; short: string };

const SHARED: Record<string, PickerArt> = {
  reconnect: { img: "/picker-art/reconnect.svg", short: "Reconnect" },
  existing: { img: "/picker-art/at-unit.svg", short: "Already here" },
  reuse: { img: "/picker-art/reconnect.svg", short: "Reuse" },
  ca_ok: { img: "/picker-art/reconnect.svg", short: "CA verified" },
  verified: { img: "/picker-art/reconnect.svg", short: "Verified" },
  alter: { img: "/picker-art/alter.svg", short: "Alter" },
  extend: { img: "/picker-art/alter.svg", short: "Alter" },
  new: { img: "/picker-art/new.svg", short: "New" },
  new_path: { img: "/picker-art/new.svg", short: "New" },
  by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  others: { img: "/picker-art/by-others.svg", short: "By others" },
  not_applicable: { img: "/picker-art/by-others.svg", short: "N/A" },
  not_needed: { img: "/picker-art/by-others.svg", short: "N/A" },
  gravity: { img: "/picker-art/gravity.svg", short: "Gravity" },
  pump: { img: "/picker-art/pump.svg", short: "Pump" },
  attic: { img: "/picker-art/attic.svg", short: "Attic" },
  in_place: { img: "/picker-art/at-unit.svg", short: "Already here" },
  demo_hp: { img: "/picker-art/demo.svg", short: "Pull it" },
  demo_ac: { img: "/picker-art/demo.svg", short: "Pull it" },
  demo: { img: "/picker-art/demo.svg", short: "Pull it" },
  yes_demo: { img: "/picker-art/demo.svg", short: "Pull it" },
  enlarge: { img: "/picker-art/hatch.svg", short: "Enlarge" },
  cut_new: { img: "/picker-art/cut-new.svg", short: "Cut new" },
  cut_in: { img: "/picker-art/cut-new.svg", short: "Cut new" },
  existing_pad: { img: "/picker-art/pad-old.svg", short: "Existing pad" },
  wood: { img: "/picker-art/wood.svg", short: "Wood" },
  stucco: { img: "/picker-art/stucco.svg", short: "Stucco" },
  brick: { img: "/picker-art/brick.svg", short: "Brick" },
  sheetrock: { img: "/picker-art/sheetrock.svg", short: "Sheetrock" },
  drywall: { img: "/picker-art/sheetrock.svg", short: "Sheetrock" },
  plaster: { img: "/picker-art/plaster.svg", short: "Plaster" },
  tile: { img: "/picker-art/tile.svg", short: "Tile" },
  tile_ceiling: { img: "/picker-art/tile.svg", short: "Tile" },
  tile_wall: { img: "/picker-art/tile.svg", short: "Tile" },
  dryer: { img: "/picker-art/dryer.svg", short: "Dryer" },
  range: { img: "/picker-art/range.svg", short: "Range" },
  charger: { img: "/picker-art/ev.svg", short: "Charger" },
  ev: { img: "/picker-art/ev.svg", short: "Charger" },
  easy: { img: "/picker-art/easy.svg", short: "Easy" },
  typical: { img: "/picker-art/typical.svg", short: "Typical" },
  med: { img: "/picker-art/typical.svg", short: "A little tight" },
  medium: { img: "/picker-art/typical.svg", short: "Medium" },
  hard: { img: "/picker-art/hard.svg", short: "Hard" },
  very: { img: "/picker-art/very.svg", short: "Very hard" },
  vhard: { img: "/picker-art/very.svg", short: "Very hard" },
  tight: { img: "/picker-art/hard.svg", short: "Tight" },
  a_easy: { img: "/picker-art/crew-1-open.svg", short: "1 · open" },
  b_1long: { img: "/picker-art/crew-1-carry.svg", short: "1 · long carry" },
  b_1tech: { img: "/picker-art/crew-1-carry.svg", short: "1 tech" },
  c_2easy: { img: "/picker-art/crew-2-stairs.svg", short: "2 · stairs" },
  d_2hard: { img: "/picker-art/crew-2-hoist.svg", short: "2 · hoist" },
  d_2tight: { img: "/picker-art/hard.svg", short: "2 · tight" },
  e_2hard: { img: "/picker-art/crew-2-hoist.svg", short: "2 · hard" },
  d_2attic: { img: "/picker-art/attic.svg", short: "2 · attic" },
  g_3attic: { img: "/picker-art/attic.svg", short: "3 · attic" },
  d_2base: { img: "/picker-art/hatch.svg", short: "2 · basement" },
  g_3base: { img: "/picker-art/hatch.svg", short: "3 · basement" },
  roof: { img: "/picker-art/roof.svg", short: "Roof" },
  two_tech: { img: "/picker-art/crew-2-stairs.svg", short: "2 techs" },
  preform: { img: "/picker-art/pad-new.svg", short: "Preformed pad" },
  gravity_ok: { img: "/picker-art/gravity.svg", short: "Gravity" },
  drain_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  reuse_ok: { img: "/picker-art/reconnect.svg", short: "Reuse" },
  new_vent: { img: "/picker-art/flue.svg", short: "New vent" },
  vent_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  replace_existing: { img: "/picker-art/replace.svg", short: "Replace" },
  cut_in_new: { img: "/picker-art/cut-new.svg", short: "Cut in" },
  cut_in_access: { img: "/picker-art/cut-new.svg", short: "Cut access" },
  cut_in_access_door_trim: { img: "/picker-art/hatch.svg", short: "Door + trim" },
  owner_access: { img: "/picker-art/by-others.svg", short: "Owner" },
  owner_access_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  "1_good": { img: "/picker-art/easy.svg", short: "1 · good" },
  "1_hard": { img: "/picker-art/hard.svg", short: "1 · hard" },
  "2_good": { img: "/picker-art/crew-2-stairs.svg", short: "2 · good" },
  "2_hard": { img: "/picker-art/crew-2-hoist.svg", short: "2 · hard" },
  walk: { img: "/picker-art/easy.svg", short: "Walk up" },
  no_ladder: { img: "/picker-art/easy.svg", short: "No ladder" },
  v110: { img: "/elec/c120.svg", short: "120V" },
  v220: { img: "/elec/c240.svg", short: "240V" },
  interior: { img: "/picker-art/sheetrock.svg", short: "Inside" },
  exterior: { img: "/picker-art/stucco.svg", short: "Outside" },
  closet: { img: "/picker-art/hatch.svg", short: "Closet" },
  surface: { img: "/picker-art/at-unit.svg", short: "Surface" },
  flush_sheetrock: { img: "/picker-art/sheetrock.svg", short: "Flush sheetrock" },
  flush_stucco: { img: "/picker-art/stucco.svg", short: "Flush stucco" },
  haul: { img: "/picker-art/demo.svg", short: "Haul in" },
  mesh: { img: "/picker-art/pad-new.svg", short: "Mesh" },
  rebar: { img: "/picker-art/pad-new.svg", short: "Rebar" },
  firestop: { img: "/picker-art/flue.svg", short: "Firestop" },
  wireless: { img: "/picker-art/24v.svg", short: "Wireless" },
  install: { img: "/picker-art/new.svg", short: "Install" },
  finish_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  finish_basic: { img: "/picker-art/sheetrock.svg", short: "We finish" },
  joist: { img: "/picker-art/hatch.svg", short: "Cut joists" },
  spare: { img: "/picker-art/new.svg", short: "Spare" },
  cover: { img: "/picker-art/soffit.svg", short: "Cover" },
  enough: { img: "/picker-art/reconnect.svg", short: "Enough" },
};

const BY_QUESTION: Record<string, Record<string, PickerArt>> = {
  wall_shield: {
    not_needed: { img: "/picker-art/by-others.svg", short: "Not needed" },
    in_place: { img: "/picker-art/at-unit.svg", short: "Already here" },
    with_new: { img: "/picker-art/flue.svg", short: "With new flue" },
    without_new: { img: "/picker-art/attic.svg", short: "No new flue" },
  },
  wall_flue: {
    reconnect: { img: "/picker-art/reconnect.svg", short: "Reconnect" },
    alter: { img: "/picker-art/alter.svg", short: "Alter" },
    new: { img: "/picker-art/flue.svg", short: "Replace" },
  },
  pad_kind: {
    existing: { img: "/picker-art/pad-old.svg", short: "Existing pad" },
    preform: { img: "/picker-art/pad-new.svg", short: "Preformed pad" },
    new: { img: "/picker-art/pad-new.svg", short: "Pour new" },
  },
  pad_base: {
    preform: { img: "/picker-art/pad-new.svg", short: "Preformed pad" },
    existing: { img: "/picker-art/pad-old.svg", short: "Pad already there" },
  },
  pad_preform_grade: {
    flat: { img: "/pad/flat.svg", short: "Level" },
    slope: { img: "/pad/slope.svg", short: "Slight slope" },
    steep: { img: "/pad/steep.svg", short: "Steep" },
  },
  condensate: {
    gravity_ok: { img: "/picker-art/gravity.svg", short: "Gravity" },
    pump: { img: "/picker-art/pump.svg", short: "Pump" },
    drain_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  },
  ah_condensate: {
    gravity_ok: { img: "/picker-art/gravity.svg", short: "Gravity" },
    pump: { img: "/picker-art/pump.svg", short: "Pump" },
    drain_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  },
  vent_flue: {
    reuse_ok: { img: "/picker-art/reconnect.svg", short: "Reuse" },
    new_vent: { img: "/picker-art/flue.svg", short: "New vent" },
    vent_by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  },
  pad_grade: {
    flat: { img: "/pad/flat.svg", short: "Level" },
    slope: { img: "/pad/slope.svg", short: "Slight slope" },
    hill: { img: "/pad/steep.svg", short: "Steep" },
    piers: { img: "/pad/piers.svg", short: "Hillside" },
  },
  fan_elec: {
    attic: { img: "/picker-art/attic.svg", short: "Nearby wire" },
    in_place: { img: "/picker-art/at-unit.svg", short: "Already here" },
    new: { img: "/picker-art/new.svg", short: "From panel" },
    by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  },
  ejob_source: {
    attic: { img: "/picker-art/attic.svg", short: "Nearby wire" },
    in_place: { img: "/picker-art/at-unit.svg", short: "Already here" },
    new: { img: "/picker-art/new.svg", short: "From panel" },
    by_others: { img: "/picker-art/by-others.svg", short: "By others" },
  },
  ejob_240_load: {
    dryer: { img: "/picker-art/dryer.svg", short: "Dryer" },
    range: { img: "/picker-art/range.svg", short: "Range" },
    charger: { img: "/picker-art/ev.svg", short: "Charger" },
    other: { img: "/elec/c240.svg", short: "Other" },
  },
  job_path: {
    replace: { img: "/picker-art/replace.svg", short: "Replace" },
    new_location: { img: "/picker-art/new.svg", short: "New" },
    contractor: { img: "/picker-art/contractor.svg", short: "Contractor" },
  },
  ctrl_wire: {
    enough: { img: "/picker-art/reconnect.svg", short: "Enough in place" },
    spare: { img: "/picker-art/at-unit.svg", short: "Spare wires" },
    cover: { img: "/picker-art/soffit.svg", short: "In the cover" },
    exposed: { img: "/picker-art/stucco.svg", short: "Exposed" },
    conduit: { img: "/picker-art/new.svg", short: "Conduit" },
    inside: { img: "/picker-art/sheetrock.svg", short: "Inside chase" },
  },
  duct_material: {
    flex: { img: "/picker-art/duct-wire-flex.svg", short: "Wire flex" },
    luma: { img: "/picker-art/duct-aluma-flex.svg", short: "Aluma flex" },
    kd: { img: "/picker-art/duct-kd.svg", short: "KD + jacket" },
  },
  duct_material_opts: {
    flex: { img: "/picker-art/duct-wire-flex.svg", short: "Wire flex" },
    luma: { img: "/picker-art/duct-aluma-flex.svg", short: "Aluma flex" },
    kd: { img: "/picker-art/duct-kd.svg", short: "KD + jacket" },
  },
  duct_where: {
    attic: { img: "/picker-art/attic.svg", short: "Attic" },
    crawl: { img: "/picker-art/hatch.svg", short: "Crawl" },
    garage: { img: "/picker-art/wood.svg", short: "Garage" },
    inside: { img: "/picker-art/sheetrock.svg", short: "Inside" },
    soffit: { img: "/picker-art/soffit.svg", short: "Soffit" },
    roof_curb: { img: "/picker-art/roof-curb.svg", short: "Roof curb" },
  },
};

const HEAD_STYLE_ART: Record<string, PickerArt> = {
  high_wall: {
    img: "/product-photos/car-ms-perf-wall-45maha.png",
    short: "High wall",
  },
  one_way: {
    img: "/product-photos/car-ms-cassette-45mcca.png",
    short: "1-way cassette",
  },
  low_wall: {
    img: "/product-photos/car-ms-floor-45mbfa.png",
    short: "Low wall",
  },
  four_way: {
    img: "/product-photos/mit-ms-cassette.png",
    short: "4-way cassette",
  },
  slim_duct: {
    img: "/product-photos/car-ms-ducted-45mbda.png",
    short: "Slim ducted",
  },
};

export function pickerArtFor(
  questionId: string,
  optionId: string,
  explicitArt?: string,
): PickerArt | null {
  const fromQ = BY_QUESTION[questionId]?.[optionId];
  if (fromQ) return fromQ;
  if (/^ms_h\d+_style$/.test(questionId) && HEAD_STYLE_ART[optionId]) {
    return HEAD_STYLE_ART[optionId];
  }
  const shared = SHARED[optionId];
  if (shared) return shared;
  if (explicitArt) {
    return {
      img: explicitArt,
      short: optionId.replace(/_/g, " "),
    };
  }
  return null;
}

export function shortChoiceLabel(
  questionId: string,
  optionId: string,
  fullLabel: string,
): string {
  const art = pickerArtFor(questionId, optionId);
  if (art?.short) return art.short;
  return fullLabel.split(/[·—]/)[0]?.trim() || fullLabel;
}

export function questionHasPickerArt(
  questionId: string,
  options: { id: string; art?: string }[],
): boolean {
  const hits = options.filter((o) => pickerArtFor(questionId, o.id, o.art));
  return hits.length >= 2;
}

export function useVisualPickers(): boolean {
  return useOwnerSettings((s) => s.visualPickers !== false);
}

export const JOB_PATH_ART: Record<string, string> = {
  replace: "/picker-art/replace.svg",
  new_location: "/picker-art/new.svg",
  contractor: "/picker-art/contractor.svg",
};

export const DEMO_ART: Record<string, string> = {
  yes: "/picker-art/demo.svg",
  yes_patch: "/picker-art/sheetrock.svg",
  both: "/picker-art/demo.svg",
  by_others: "/picker-art/by-others.svg",
  no: "/picker-art/leave.svg",
};

let pickerArtPreloaded = false;

/** Warm picker SVGs so site questions paint instantly on phone. */
export function warmPickerArt(
  questionId: string,
  options: { id: string; art?: string }[],
): void {
  if (typeof window === "undefined") return;
  for (const o of options || []) {
    const art = pickerArtFor(questionId, o.id, o.art);
    if (!art?.img) continue;
    const im = new Image();
    im.decoding = "async";
    im.src = art.img;
  }
}

export function preloadPickerArt(): void {
  if (typeof window === "undefined" || pickerArtPreloaded) return;
  pickerArtPreloaded = true;
  const urls = new Set<string>();
  for (const a of Object.values(SHARED)) urls.add(a.img);
  for (const by of Object.values(BY_QUESTION)) {
    for (const a of Object.values(by)) urls.add(a.img);
  }
  for (const a of Object.values(HEAD_STYLE_ART)) urls.add(a.img);
  for (const u of Object.values(JOB_PATH_ART)) urls.add(u);
  for (const u of Object.values(DEMO_ART)) urls.add(u);
  for (const logo of [
    "/brands/carrier.svg",
    "/brands/mitsubishi.svg",
    "/brands/bosch.svg",
    "/brands/goodman.svg",
    "/brands/navien.svg",
    "/brands/rheem.svg",
    "/brands/williams.svg",
  ]) {
    urls.add(logo);
  }
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

