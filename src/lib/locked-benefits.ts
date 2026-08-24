/**
 * Locked benefits on real equipment.
 * 1) Properly sized
 * 2–3) This series — ratings + what it does (from the manufacturer)
 * 4) Manufacturer warranty (years — no registration language; CA does not require it)
 * 5) Acme 3-year labor
 */
import type { Product } from "./proposal-types";

export const ACME_LABOR_BENEFIT =
  "Acme HVAC 3-year labor warranty on the equipment we install.";

const DENY_SKU =
  /^(SVC-|ZONE-|HUM-|HRV-|LAD-|PLAT-|EV-|FLUE-|HOOD-|VENT-|FAN-|EQV-|AA-|ERV-)/i;

type Rated = Pick<
  Product,
  | "name"
  | "sku"
  | "category"
  | "tierLabel"
  | "equipmentKind"
  | "familyId"
  | "seer2"
  | "eer2"
  | "hspf2"
  | "soundDb"
  | "energyStar"
>;

export function isLockableEquipment(
  p: Pick<Product, "equipmentKind" | "name" | "sku" | "category" | "familyId">,
): boolean {
  const sku = (p.sku || "").toUpperCase();
  if (DENY_SKU.test(sku)) return false;
  const blob =
    `${p.name} ${p.sku} ${p.category} ${p.familyId || ""}`.toLowerCase();
  if (
    /permit|hers|load calc|manual j|duct seal|startup|guide|education|vs gas|comfort club|membership/i.test(
      blob,
    )
  )
    return false;

  const k = p.equipmentKind;
  if (
    k === "ac" ||
    k === "heat_pump" ||
    k === "furnace" ||
    k === "air_handler" ||
    k === "ductless"
  )
    return true;

  if (
    /^(CAR-|MIT-|BOS-|FUR-|WTR-|AOS-|WALL-|CTRL-|NAV-|STAT-|SAN-|GDM-)/i.test(sku)
  )
    return true;

  return /water.?heater|tankless|voltex|hpwh|wall.?heat|wall.?furn|forsaire|monterey|energysaver|thermostat|air condition|heat pump|furnace|air handler|mini-?split|ductless/i.test(
    blob,
  );
}

function blobOf(p: Rated): string {
  return `${p.name} ${p.sku || ""} ${p.category || ""} ${p.tierLabel || ""} ${p.equipmentKind || ""}`.toLowerCase();
}

function fmtRating(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function ratingBits(
  p: Rated,
  fallback: { seer2?: number; hspf2?: number; eer2?: number; sound?: number },
): { seer?: string; hspf?: string; eer?: string; sound?: string } {
  const seer = p.seer2 && p.seer2 > 0 ? p.seer2 : fallback.seer2;
  const hspf = p.hspf2 && p.hspf2 > 0 ? p.hspf2 : fallback.hspf2;
  const eer = p.eer2 && p.eer2 > 0 ? p.eer2 : fallback.eer2;
  const sound = p.soundDb && p.soundDb > 0 ? p.soundDb : fallback.sound;
  return {
    seer: seer ? `${fmtRating(seer)} SEER2` : undefined,
    hspf: hspf ? `${fmtRating(hspf)} HSPF2` : undefined,
    eer: eer ? `${fmtRating(eer)} EER2` : undefined,
    sound: sound ? `${Math.round(sound)} dB` : undefined,
  };
}

export function sizingBenefitLine(
  p: Pick<Product, "name" | "sku" | "category" | "equipmentKind" | "familyId">,
): string {
  const blob = `${p.name} ${p.sku} ${p.category} ${p.familyId || ""} ${p.equipmentKind || ""}`.toLowerCase();
  if (/water.?heater|tankless|voltex|hpwh|wtr-|aos-/.test(blob))
    return "Properly sized for your home's hot-water use — fewer cold showers and a longer, easier life on the equipment.";
  if (/wall.?heat|wall.?furn|forsaire|monterey|rinnai|energysaver|wall-/.test(blob))
    return "Properly sized for the space it heats — even warmth without short-cycling.";
  if (/thermostat|ctrl-|stat-/.test(blob))
    return "Matched to this system so the equipment can do what it was built to do.";
  if (/ductless|mini-?split|msz|mxz|hyper/.test(blob))
    return "Properly sized for the room it serves — one outdoor, one indoor, no new ductwork.";
  return "This system has been sized specifically for your home using our advanced load-calculation software — for maximum comfort, efficiency, and dependable year-round performance.";
}

function energyStarBenefit(p: Rated): string | null {
  if (!p.energyStar) return null;
  const k = p.equipmentKind;
  const blob = blobOf(p);
  if (/water.?heater|tankless|voltex|hpwh|npe-|wtr-|aos-/i.test(blob) || k === "water_heater") {
    return "ENERGY STAR® certified.";
  }
  if (/thermostat|ctrl-|stat-|system control/i.test(blob)) {
    return "ENERGY STAR® certified.";
  }
  if (
    k === "ac" ||
    k === "heat_pump" ||
    k === "ductless" ||
    /air condition|ductless|mini-?split/i.test(blob)
  ) {
    if (/water/i.test(blob)) return "ENERGY STAR® certified.";
    return "ENERGY STAR® certified when matched to qualifying indoor units.";
  }
  if (k === "air_handler" || k === "furnace" || /air handler|furnace/i.test(blob)) {
    return "ENERGY STAR® certified when matched to qualifying outdoor units.";
  }
  return "ENERGY STAR® certified.";
}

/** 2 short product lines — ratings + what this series actually does. */
export function equipmentValueLines(p: Rated): string[] {
  const blob = blobOf(p);
  const k = p.equipmentKind;

  if (/wall.?heat|wall.?furn|forsaire|monterey|rinnai|energysaver|wall-wil|wall-rin|wall-coz/.test(blob)) {
    if (/rinnai|energysaver/.test(blob))
      return [
        "Fan-assisted direct-vent heat — sealed to the outside, even warmth in the room.",
        "No chimney. Combustion air comes from outdoors, not your living space.",
      ];
    if (/monterey/.test(blob))
      return [
        "Gravity wall heat — no blower, no ductwork.",
        "Warms the space it sits in. Simple, quiet, and built for this opening.",
      ];
    if (/forsaire|counterflow|direct-vent/.test(blob))
      return [
        "Sealed-combustion counterflow heat — no chimney.",
        "Heat stays in the room. Combustion air from outside.",
      ];
    return ["Wall heat for the space it serves — no new ductwork."];
  }

  if (/voltex|hpwh|hybrid|nwp|signature 900/.test(blob))
    return [
      "Moves heat from the room air into the water — a fraction of the energy of a standard electric tank.",
      "Recovery is slower than gas. That’s the trade for the efficiency.",
    ];
  if (/sanden|sanco2|^san-/i.test(blob) || /^SAN-/.test(String(p.sku || "").toUpperCase()))
    return [
      "Sanden SANCO2 split heat pump — CO2 refrigerant, works in cold weather, no backup element.",
      "UEF up to 3.8. Quiet outdoor unit. The tank can sit in a closet — no tank airflow needed.",
    ];
  if (/npe-|tankless|adapt\+|signature 1[689]/.test(blob))
    return [
      "UEF 0.95 condensing tankless — about 95¢ of every fuel dollar becomes hot water.",
      "Endless hot water on demand. Compact wall-hung. Heats only what you use. No storage tank.",
    ];
  if (/electric/.test(blob) && /water|tank|aos-e/.test(blob))
    return [
      "UEF about 0.93 electric storage — sized for this home's daily hot-water use.",
      "No venting. Straightforward tank, ready when you need it.",
    ];
  if (/aos-he|he-gas|condensing/.test(blob) && /water|tank|aos-/.test(blob))
    return [
      "UEF about 0.80 condensing gas tank — more of the fuel becomes hot water than a standard tank.",
      "PVC vent. Fast gas recovery with high-efficiency heat.",
    ];
  if (/water.?heater|gas tank|proline|guln|grav|aos-guln|aos-grav/.test(blob))
    return [
      "UEF about 0.60 gas storage — fast recovery you can count on.",
      "Storage tank ready when you need it. Simple, proven heat.",
    ];

  if (k === "ac" || /air condition|car-ac-|26sca|26tpa|26vna/.test(blob)) {
    if (/infinity|26vna|variable/.test(blob)) {
      const r = ratingBits(p, { seer2: 21, sound: 56 });
      return [
        `Up to ${r.seer || "21 SEER2"} variable-speed cooling — Greenspeed® Intelligence.`,
        "Holds about ½° of the setting. Full humidity control. Quietest in this lineup.",
      ];
    }
    if (/performance|26tpa|two-stage/.test(blob)) {
      const r = ratingBits(p, { seer2: 18, sound: 67 });
      return [
        `Up to ${r.seer || "18 SEER2"} two-stage cooling — stays on low most of the day.`,
        "Better humidity control and quieter than Comfort.",
      ];
    }
    const r = ratingBits(p, { seer2: 16, sound: 72 });
    return [
      `Up to ${r.seer || "16 SEER2"} Comfort™ single-stage cooling.`,
      "Affordable everyday A/C. Built for year-round reliability.",
    ];
  }

  if (
    (k === "heat_pump" && !/water/.test(blob)) ||
    /car-hp-|27sca|27tpa|27vna/.test(blob)
  ) {
    if (/navien|nav-naz/.test(blob)) {
      const r = ratingBits(p, { seer2: 18, hspf2: 9 });
      return [
        `Navien inverter heat pump${r.seer ? ` — ${r.seer}` : ""}${r.hspf ? ` / ${r.hspf} heating` : ""}.`,
        "Year-round heat and cool, matched to Navien indoor equipment. R-454B refrigerant.",
      ];
    }
    if (/goodman|gdm-|gszh|amst/.test(blob) || /^GDM-/.test(String(p.sku || "").toUpperCase())) {
      const r = ratingBits(p, { seer2: 15.2, hspf2: 7.8 });
      return [
        `Goodman heat pump${r.seer ? ` — up to ${r.seer} SEER2` : ""}${r.hspf ? ` / ${r.hspf} heating` : ""}.`,
        "One outdoor unit that heats and cools. Straightforward everyday comfort.",
      ];
    }
    if (/bosch|ids/.test(blob)) {
      const r = ratingBits(p, { seer2: 18, hspf2: 8.5 });
      return [
        `Bosch IDS inverter — up to ${r.seer || "18 SEER2"} and up to ${r.hspf || "8.5 HSPF2"}.`,
        "Quiet modulating heat and cool in one outdoor unit. Strong cold-weather performance.",
      ];
    }
    if (/infinity|27vna|variable/.test(blob)) {
      const r = ratingBits(p, { seer2: 23, hspf2: 10.5, sound: 53 });
      return [
        `Up to ${r.seer || "23 SEER2"} and up to ${r.hspf || "10.5 HSPF2"} — Infinity® Greenspeed® variable-speed.`,
        "Holds about ½° of the setting. Full humidity control. Quietest in this lineup.",
      ];
    }
    if (/performance|27tpa|two-stage/.test(blob)) {
      const r = ratingBits(p, { seer2: 18, hspf2: 8.5, sound: 65 });
      return [
        `Up to ${r.seer || "18 SEER2"} and up to ${r.hspf || "8.5 HSPF2"} — Performance™ two-stage compressor.`,
        "Runs quieter than Comfort and stays on low most of the day for more even rooms.",
      ];
    }
    const r = ratingBits(p, { seer2: 16, hspf2: 8.1, sound: 70 });
    return [
      `Up to ${r.seer || "16 SEER2"} and up to ${r.hspf || "8.1 HSPF2"} — Comfort™ single-stage heat pump.`,
      "One outdoor unit that heats and cools. Solid everyday comfort.",
    ];
  }

  if (k === "air_handler" || /air handler|car-ah-|fan coil|h2air/.test(blob)) {
    if (/bosch|bva-|ids air handler/.test(blob))
      return [
        "Matched Bosch IDS indoor — inverter-ready airflow for the Bosch outdoor.",
        "Quiet cabinet. Conventional 24-volt control. Sized to the same tonnage class.",
      ];
    if (/navien|nas|h2air/.test(blob))
      return [
        "Matched Navien indoor airflow — quiet, even delivery from the hydronic / NAS cabinet.",
        "Built to pair with the Navien outdoor or furnace.",
      ];
    if (/goodman|gdm-|amst/.test(blob) || /^GDM-/.test(String(p.sku || "").toUpperCase()))
      return [
        "Goodman AMST indoor — multi-position cabinet for the matching Goodman outdoor.",
        "24-volt. Straightforward airflow, sized to the same tonnage class.",
      ];
    if (/infinity|fe5b/.test(blob))
      return [
        "Infinity® variable-speed indoor — communicating with the outdoor unit.",
        "Holds about ½° of the setting. Full humidity control. Quietest indoor in this lineup.",
      ];
    if (/performance|ft5/.test(blob))
      return [
        "Performance™ indoor — multi-speed blower, better humidity help than Comfort.",
        "Quieter cabinet. Matched to the Performance outdoor unit.",
      ];
    return [
      "Comfort™ indoor — reliable multi-speed airflow for the outdoor unit it sits with.",
      "Clean cabinet, easy service access, matched Comfort series.",
    ];
  }

  if (k === "furnace" || /furnace|car-58|car-59|fur-|npf|nhb|nfb/.test(blob)) {
    if (/npf/.test(blob))
      return [
        "Navien NPF variable-speed hydro furnace — 97% AFUE class.",
        "Matches the load and runs whisper-quiet. Condensing heat for this home.",
      ];
    if (/nhb|nfb/.test(blob))
      return [
        "Navien condensing gas heat — compact wall-hung, high-efficiency.",
        "More of the fuel becomes warmth. Built to pair with Navien controls.",
      ];
    if (/96%|98%|59sc|59tp|59mn|he90|ulnhe|condensing/.test(blob))
      return [
        "Up to 96% AFUE condensing gas furnace — more of the fuel becomes heat in the house.",
        "High-efficiency Comfort / Performance heat. Quieter, tighter comfort than 80% units.",
      ];
    return [
      "80% AFUE gas furnace — dependable heat when the house calls for it.",
      "Straightforward Comfort-series warmth. Proven, serviceable, built for this climate.",
    ];
  }

  if (k === "ductless" || /ductless|mini-?split|msz|mxz|hyper/.test(blob)) {
    const r = ratingBits(p, { seer2: 20, hspf2: 10 });
    const eff =
      r.seer && r.hspf
        ? `up to ${r.seer.replace(" SEER2", "")} SEER2 and up to ${r.hspf.replace(" HSPF2", "")} HSPF2`
        : r.seer
          ? `up to ${r.seer.replace(" SEER2", "")} SEER2`
          : "high-efficiency inverter operation";
    if (/hyper/.test(blob))
      return [
        `Mitsubishi Hyper-Heating® ductless system — ${eff}.`,
        "Rated to deliver strong heat in cold weather with inverter efficiency.",
      ];
    if (/infinity/.test(blob))
      return [
        `Carrier Infinity ductless system — ${eff}.`,
        "Inverter outdoor heat pump — efficient heat and cool where you live.",
      ];
    if (/performance/.test(blob) && /carrier/.test(blob))
      return [
        `Carrier Performance ductless system — ${eff}.`,
        "Inverter outdoor heat pump — efficient heat and cool for every zone on this design.",
      ];
    if (/mxz|multi|zone/.test(blob)) {
      const brand = /carrier|car-/.test(blob)
        ? "Carrier Performance"
        : /mitsubishi|mit-|mxz/.test(blob)
          ? "Mitsubishi"
          : "Multi-zone";
      return [
        `${brand} multi-zone ductless system — ${eff}.`,
        "Inverter outdoor heat pump drives efficient heat and cool for every zone on this design.",
      ];
    }
    const brand = /carrier|car-/.test(blob)
      ? "Carrier"
      : /mitsubishi|mit-|msz/.test(blob)
        ? "Mitsubishi"
        : "Ductless";
    return [
      `${brand} ductless system — ${eff}.`,
      "Inverter outdoor heat pump — efficient heat and cool where you live.",
    ];
  }

  if (/ecobee/.test(blob))
    return [
      "ecobee learns the house and cuts the waste.",
      "Comfort you can see and adjust on your phone.",
    ];
  if (/nest/.test(blob))
    return [
      "Google Nest learns your schedule.",
      "Simple comfort without the programming headache.",
    ];
  if (/infinity\s+(system\s+)?control|ctrl-inf/.test(blob))
    return [
      "Infinity® system control — outdoor and indoor talk to each other.",
      "Holds about ½° of the setting. Full humidity control on one screen.",
    ];
  if (/thermostat|ctrl-|stat-/.test(blob))
    return ["Clear everyday control — the system runs the way it was designed."];

  return ["Quality equipment, installed to code, built to last in this home."];
}

export function equipmentValueLine(p: Rated): string {
  return equipmentValueLines(p)[0] || "";
}

export function manufacturerWarrantyLine(
  p: Pick<Product, "name" | "sku" | "category" | "equipmentKind" | "familyId">,
): string {
  const blob =
    `${p.name} ${p.sku} ${p.category} ${p.familyId || ""}`.toLowerCase();
  const sku = (p.sku || "").toUpperCase();

  if (/sanden|sanco2/i.test(blob) || /^SAN-/.test(sku))
    return "Sanden 10-year limited parts warranty on the SANCO2 system.";
  if (/navien|nav-|npe-|npf|naz|nwp/.test(blob) || /^NAV-/.test(sku)) {
    if (/npe-|tankless|nwp|hpwh/.test(blob))
      return "Navien 15-year heat exchanger and 5-year parts warranty.";
    return "Navien limited heat-exchanger and parts warranty.";
  }
  if (/mitsubishi|mit-|msz|mxz/.test(blob) || /^MIT-/.test(sku))
    return "Mitsubishi Electric 10-year limited parts warranty.";
  if (/bosch|ids/.test(blob) || /^BOS-/.test(sku))
    return "Bosch 10-year limited parts warranty.";
  if (/a\.?\s*o\.?\s*smith|aos-|voltex|proline|adapt|signature/.test(blob) || /^AOS-/.test(sku)) {
    if (/tankless|adapt|npe-/.test(blob) || /AOS-SIG-TL|AOS-ADAPT/.test(sku))
      return "A. O. Smith 15-year heat exchanger and 5-year parts warranty.";
    if (/voltex|hpwh|hybrid|nwp|signature 900/.test(blob))
      return "A. O. Smith 10-year tank and parts warranty.";
    return "A. O. Smith 6-year tank and parts warranty.";
  }
  if (/rinnai|energysaver|wall-rin/.test(blob))
    return "Rinnai 10-year heat exchanger and 5-year parts warranty.";
  if (/cozy|wall-coz/.test(blob) && !/williams|forsaire|monterey|wall-wil/.test(blob))
    return "Cozy 1-year limited parts warranty.";
  if (/williams|forsaire|monterey|wall-wil/.test(blob))
    return "Williams 1-year limited parts warranty.";
  if (/ecobee/.test(blob))
    return "ecobee 3-year limited warranty.";
  if (/\bnest\b/.test(blob))
    return "Google Nest 2-year limited warranty.";
  if (/honeywell|stat-hw|resideo/.test(blob))
    return "Honeywell / Resideo 5-year limited parts warranty.";
  if (/goodman|gdm-|gszh|amst/.test(blob) || /^GDM-/.test(sku))
    return "Goodman 10-year limited parts warranty.";
  if (/carrier|car-|infinity|comfort™|performance™/.test(blob) || /^CAR-|^FUR-|^CTRL-INF|^CTRL-CAR/.test(sku))
    return "Carrier 10-year limited parts warranty.";
  return "Manufacturer limited parts warranty as published for this model.";
}

export function lockedEquipmentBenefits(p: Rated): string[] | null {
  if (!isLockableEquipment(p)) return null;
  const lines = [
    sizingBenefitLine(p),
    ...equipmentValueLines(p),
  ];
  const star = energyStarBenefit(p);
  if (star) lines.push(star);
  const blob = blobOf(p);
  const mfrLine = manufacturerWarrantyLine(p);
  const oneYearLabor =
    /1-year/i.test(mfrLine) && !/rinnai|energysaver/i.test(blob);
  lines.push(
    mfrLine,
    oneYearLabor
      ? "Acme HVAC 1-year labor warranty on this product — matches the manufacturer’s 1-year parts coverage."
      : ACME_LABOR_BENEFIT,
  );
  return lines;
}

export function stampLockedBenefits<T extends Product>(p: T): T {
  const locked = lockedEquipmentBenefits(p);
  if (!locked) return p;
  const same =
    (p.benefits || []).length === locked.length &&
    (p.benefits || []).every((b, i) => b === locked[i]);
  if (same) return p;
  return { ...p, benefits: locked };
}

/** True when a benefit was injected at quote time and does not belong. */
export function isInjectedBenefitLine(b: string): boolean {
  const t = (b || "").trim();
  if (!t) return true;
  if (/advisor fit/i.test(t)) return true;
  if (/indoor head location|multi-zone design:/i.test(t)) return true;
  if (/energy.?star/i.test(t) && !/certified/i.test(t) && !/seer2|hspf2|afue/i.test(t))
    return true;
  if (/concrete pad|custom pad/i.test(t)) return true;
  if (/acme (hvac )?installs it/i.test(t)) return true;
  if (/\$\d+.*tax credit|qualifies for/i.test(t)) return true;
  return false;
}
