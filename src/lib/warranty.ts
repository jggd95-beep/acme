/**
 * Manufacturer parts + Acme HVAC labor warranty rules for the packet.
 * Parts years reflect typical residential limited warranties when product is
 * registered (where registration is required). Labor is Acme HVAC policy.
 *
 * Caveats encoded here:
 * - Wall heaters (Williams etc.): 1-year manufacturer parts — Acme HVAC does
 *   NOT extend labor to 3 years on these.
 * - Thermostats / controls: shorter Acme HVAC labor (2 years).
 * - Consumables (media, filters): no multi-year parts on disposable media.
 * - Permits / duct / load calc / pure service measures: NO measure-level labor
 *   warranty line (3-year labor is only on equipment we install).
 */
import type { Product } from "./proposal-types";
import { stampLockedBenefits } from "./locked-benefits";

export type WarrantyInfo = {
  brand: string;
  /** Manufacturer limited parts years (typical registered residential) */
  partsYears: number | null;
  /** Extra manufacturer note (HX, compressor, etc.) */
  partsDetail: string;
  /** Acme HVAC labor coverage years (null = not applicable / not extended) */
  laborYears: number | null;
  laborDetail: string;
  /** One-line customer-facing summary */
  summary: string;
  /** Benefit bullets for the measure — empty when warranty does not apply */
  benefitLines: string[];
  /** True when Acme HVAC labor is shortened vs standard equipment */
  limitedLabor: boolean;
};

const ACME_LABOR_STD = 3;
const ACME_LABOR_TSTAT = 2;

export function detectBrand(p: Product): string {
  const blob = `${p.name} ${p.sku} ${p.category} ${p.description}`.toLowerCase();
  if (
    /carrier|infinity|comfort.*series|performance.*series|24vna|25vna|58|59|fe4|fv4|26sca|24sca/i.test(
      blob,
    ) ||
    /^(car-|ctrl-inf)/i.test(p.sku)
  )
    return "Carrier";
  if (
    /mitsubishi|m-series|mxz|msz|muz|hyper.?heat|ductless/i.test(blob) ||
    /^(mit-|msz|muz|mxz)/i.test(p.sku)
  )
    return "Mitsubishi";
  if (/bosch|ids|bova/i.test(blob) || /^bos-/i.test(p.sku)) return "Bosch";
  if (/navien|npe|ncb|npe-a/i.test(blob) || /^wtr-nav/i.test(p.sku))
    return "Navien";
  if (/aprilaire|april.?aire|^aa-/i.test(blob) || /^aa-/i.test(p.sku))
    return "AprilAire";
  if (
    /williams|forsaire|monterey|wall.?furn|wall.?heat|direct.?vent/i.test(
      blob,
    ) ||
    /^wall-wil/i.test(p.sku)
  )
    return "Williams";
  if (/ecobee/i.test(blob) || /^ctrl-eco/i.test(p.sku)) return "ecobee";
  if (/\bnest\b|google nest/i.test(blob) || /^ctrl-nest/i.test(p.sku))
    return "Google Nest";
  if (/honeywell|resideo|visionpro|t10|t6/i.test(blob)) return "Honeywell";
  if (
    /generic|aarvaks|acme|svc-|install|permit|duct|load/i.test(blob) ||
    /^(svc-|custom)/i.test(p.sku)
  )
    return "Acme HVAC";
  return "Manufacturer";
}

function isWallHeater(p: Product): boolean {
  const blob =
    `${p.name} ${p.sku} ${p.category} ${p.familyId || ""}`.toLowerCase();
  if (/rinnai|energysaver/i.test(blob)) return false;
  return (
    p.familyId === "wall_heater" ||
    p.familyId === "wall-heater" ||
    p.matchKey === "wall-heater" ||
    /wall.?heat|wall.?furn|forsaire|monterey|cozy/i.test(blob) ||
    /^wall-wil|^wall-coz/i.test(p.sku)
  );
}

function isThermostat(p: Product): boolean {
  const blob = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
  return (
    /thermostat|system control|ecobee|nest|smart.?stat|infinity.?control/i.test(
      blob,
    ) || /^ctrl-/i.test(p.sku)
  );
}

function isMajorEquipment(p: Product): boolean {
  const k = p.equipmentKind;
  if (
    k === "furnace" ||
    k === "heat_pump" ||
    k === "air_handler" ||
    k === "ac" ||
    k === "ductless"
  )
    return true;
  if (p.familyId === "hrv" || /truefresh|\berv\b|energy recovery/i.test(`${p.category} ${p.name}`))
    return true;
  if (isWallHeater(p) || isThermostat(p)) return false;
  if (
    /water.?heat|tankless|humidifier|zone|air.?clean|media|filter/i.test(
      `${p.category} ${p.name}`,
    )
  )
    return true;
  return false;
}

/**
 * Permits, load calcs, duct sealing, startup, compliance, pure labor —
 * these are NOT equipment and must not show the 3-year install labor line.
 */
export function isServiceOnly(p: Product): boolean {
  const blob =
    `${p.name} ${p.sku} ${p.category} ${p.description} ${p.familyId || ""} ${p.matchKey || ""}`.toLowerCase();
  if (/^(svc-|custom|prod_permit)/i.test(p.sku)) return true;
  if (p.id === "prod_permit" || p.familyId === "permit") return true;
  if (
    /permit|load.?calc|manual.?j|duct.?seal|startup|commission|compliance|warranty\s*page|inspection\s*coord|mechanical\s*permit/i.test(
      blob,
    )
  )
    return true;
  // Concrete pad is an option/accessory install, not a 3-yr equipment labor measure
  if (/concrete\s*pad|custom\s*pad/i.test(blob) && !isMajorEquipment(p))
    return true;
  // education / guide measures
  if (/guide|vs gas|education|what to expect|heat pump conversion/i.test(blob))
    return true;
  return false;
}

/** Empty warranty for service / non-equipment measures */
function noMeasureWarranty(brand = "Acme HVAC"): WarrantyInfo {
  return {
    brand,
    partsYears: null,
    partsDetail: "Not an equipment measure — manufacturer parts N/A",
    laborYears: null,
    laborDetail:
      "Labor warranty on this line is not shown separately. Acme HVAC 3-year equipment labor applies only to major equipment measures (see warranty page).",
    summary: "See warranty page — not a separate equipment warranty line",
    benefitLines: [],
    limitedLabor: false,
  };
}

/** Resolve warranty for a product (parts + Acme HVAC labor). */
export function resolveWarranty(p: Product): WarrantyInfo {
  const brand = detectBrand(p);

  // Permits / service / guides: never stamp 3-year labor on the measure benefits
  if (isServiceOnly(p) && !isMajorEquipment(p) && !isWallHeater(p) && !isThermostat(p)) {
    return noMeasureWarranty("Acme HVAC");
  }

  if (isWallHeater(p)) {
    return {
      brand: brand === "Manufacturer" ? "Williams" : brand,
      partsYears: 1,
      partsDetail:
        "Manufacturer limited parts warranty is typically 1 year from original purchase (Williams wall / direct-vent heaters).",
      laborYears: 1,
      laborDetail:
        "Acme HVAC labor warranty on wall heaters / direct-vent heaters matches the short manufacturer coverage (1 year) — the company does not extend labor to 3 years on these products.",
      summary:
        "1-year manufacturer parts · Acme HVAC 1-year labor (not extended to 3 years)",
      benefitLines: [
        "Manufacturer limited parts warranty: 1 year (wall / direct-vent heater class)",
        "Acme HVAC labor warranty: 1 year on this product class — not extended to the standard 3-year equipment labor term",
      ],
      limitedLabor: true,
    };
  }

  if (isThermostat(p)) {
    let partsYears = 2;
    let partsDetail = "Manufacturer limited warranty on the control";
    if (brand === "ecobee") {
      partsYears = 3;
      partsDetail =
        "ecobee limited warranty on the thermostat (typically 3 years when purchased new — register at ecobee.com)";
    } else if (brand === "Google Nest") {
      partsYears = 2;
      partsDetail =
        "Google Nest limited warranty (typically 2 years from purchase — see nest.com warranty)";
    } else if (brand === "Carrier") {
      partsYears = 10;
      partsDetail =
        "Carrier Infinity® System Control — 10-year limited parts with a qualifying Carrier system.";
    } else if (brand === "Honeywell") {
      partsYears = 5;
      partsDetail =
        "Honeywell / Resideo limited parts warranty (model-dependent; typically 5 years)";
    }
    return {
      brand,
      partsYears,
      partsDetail,
      laborYears: ACME_LABOR_TSTAT,
      laborDetail: `Acme HVAC ${ACME_LABOR_TSTAT}-year labor warranty on thermostat / control install (shorter than major equipment).`,
      summary: `${partsYears}-year ${brand} parts · Acme HVAC ${ACME_LABOR_TSTAT}-year labor`,
      benefitLines: [
        `${brand} limited parts warranty: ${partsYears} years`,
        `Acme HVAC ${ACME_LABOR_TSTAT}-year labor warranty on thermostat / control installation`,
      ],
      limitedLabor: true,
    };
  }

  if (brand === "Carrier") {
    return {
      brand,
      partsYears: 10,
      partsDetail:
        "Carrier 10-year limited parts warranty.",
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment installation`,
      summary: `Carrier 10-year parts · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        "Carrier 10-year limited parts warranty.",
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment`,
      ],
      limitedLabor: false,
    };
  }

  if (brand === "Mitsubishi") {
    return {
      brand,
      partsYears: 10,
      partsDetail:
        "Mitsubishi Electric 10-year limited parts / compressor warranty.",
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment installation`,
      summary: `Mitsubishi 10-year parts · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        "Mitsubishi Electric 10-year limited parts warranty.",
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment`,
      ],
      limitedLabor: false,
    };
  }

  if (brand === "Bosch") {
    return {
      brand,
      partsYears: 10,
      partsDetail:
        "Bosch IDS / residential HVAC 10-year limited parts warranty.",
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment installation`,
      summary: `Bosch 10-year parts · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        "Bosch 10-year limited parts warranty.",
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment`,
      ],
      limitedLabor: false,
    };
  }

  if (brand === "Navien") {
    return {
      brand,
      partsYears: 5,
      partsDetail:
        "Navien residential tankless — 5-year parts, 15-year heat exchanger, 1-year manufacturer labor.",
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on tankless install (beyond manufacturer labor)`,
      summary: `Navien 5-yr parts / 15-yr HX · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        "Navien 15-year heat exchanger and 5-year parts warranty.",
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on the installation`,
      ],
      limitedLabor: false,
    };
  }

  if (brand === "Honeywell" && (p.familyId === "hrv" || /truefresh|\berv\b/i.test(`${p.name} ${p.sku}`))) {
    return {
      brand,
      partsYears: 5,
      partsDetail:
        "Honeywell TrueFRESH limited parts warranty (typically 5 years — register the unit).",
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on the energy recovery ventilator we install.`,
      summary: `Honeywell 5-year parts · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        "Honeywell TrueFRESH limited parts warranty: 5 years.",
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on this fresh-air system.`,
      ],
      limitedLabor: false,
    };
  }

  if (brand === "AprilAire") {
    const consumable = /media|filter only|replacement media/i.test(
      `${p.name} ${p.description}`,
    );
    if (consumable) {
      return {
        brand,
        partsYears: null,
        partsDetail:
          "Replacement media is a consumable — not multi-year warranted",
        laborYears: 1,
        laborDetail:
          "Acme HVAC 1-year labor on media change service when sold alone",
        summary: "Consumable media · Acme HVAC 1-year labor on install service",
        benefitLines: [
          "Replacement media is a maintenance consumable (not a multi-year parts warranty item)",
          "Acme HVAC 1-year labor on the installation service for this item",
        ],
        limitedLabor: true,
      };
    }
    return {
      brand,
      partsYears: 5,
      partsDetail:
        "AprilAire media air cleaner / cabinet — typically 5-year limited warranty on the non-consumable product (filters/media excluded)",
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor on cabinet / cleaner install`,
      summary: `AprilAire 5-year product · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        "AprilAire limited warranty: typically 5 years on the air cleaner / cabinet (media filters excluded as consumables)",
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on installation`,
      ],
      limitedLabor: false,
    };
  }

  if (isMajorEquipment(p)) {
    return {
      brand,
      partsYears: 10,
      partsDetail: `${brand} 10-year limited parts warranty.`,
      laborYears: ACME_LABOR_STD,
      laborDetail: `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment installation`,
      summary: `${brand} 10-year parts · Acme HVAC ${ACME_LABOR_STD}-year labor`,
      benefitLines: [
        `${brand} 10-year limited parts warranty.`,
        `Acme HVAC ${ACME_LABOR_STD}-year labor warranty on equipment`,
      ],
      limitedLabor: false,
    };
  }

  // Accessories / other — short labor only once
  return {
    brand,
    partsYears: 1,
    partsDetail: `${brand} limited parts warranty (see product literature)`,
    laborYears: 1,
    laborDetail: "Acme HVAC 1-year labor on this accessory / measure",
    summary: "Manufacturer limited parts · Acme HVAC 1-year labor",
    benefitLines: [
      "Manufacturer limited parts warranty per product literature",
      "Acme HVAC 1-year labor warranty on this install",
    ],
    limitedLabor: true,
  };
}

/** Auto-generated warranty benefit lines we may inject (for strip/dedupe). */
function isAutoWarrantyBenefitLine(b: string): boolean {
  const t = b.trim();
  if (!t) return true;
  // Brand-prefixed warranty lines
  if (
    /^(carrier|mitsubishi|bosch|navien|aprilaire|williams|ecobee|google nest|honeywell|manufacturer|aarvaks|acme(?:\s*(?:rvacs|hvac))?)\b/i.test(
      t,
    ) &&
    /warranty|parts|labor/i.test(t)
  )
    return true;
  // Any Acme / Aarvaks labor warranty phrasing (including mid-line after rebrand)
  if (
    /(acme(?:\s*(?:rvacs|hvac))?|aarvaks).{0,40}(labor warranty|\d[- ]?year labor)/i.test(
      t,
    )
  )
    return true;
  // Generic stamped lines
  if (
    /limited parts warranty when registered|labor warranty on (the )?(equipment|installation|this)/i.test(
      t,
    )
  )
    return true;
  if (/labor warranty on workmanship for this measure/i.test(t)) return true;
  if (/not extended to the standard 3-year/i.test(t)) return true;
  return false;
}

function normalizeBenefitKey(b: string): string {
  return b
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rewriteBrandInText(s: string): string {
  return s
    .replace(/\bAarvaks\b/gi, "Acme HVAC")
    .replace(/\bAxme Heating(?:\s+and\s+Air(?:\s+Conditioning)?)?\b/gi, "Acme HVAC")
    .replace(/\bAcme RVACs\b/g, "Acme HVAC")
    .replace(/\bACME RVACS\b/g, "ACME HVAC");
}

/**
 * Merge warranty benefit lines into product benefits (idempotent).
 * Strips previous auto-warranty lines so re-enrich never triples them.
 */
export function applyWarrantyToBenefits(
  benefits: string[],
  info: WarrantyInfo,
): string[] {
  const kept = (benefits || [])
    .map((b) => rewriteBrandInText(b.trim()))
    .filter(Boolean)
    .filter((b) => !isAutoWarrantyBenefitLine(b));

  const add = (info.benefitLines || [])
    .map((b) => rewriteBrandInText(b.trim()))
    .filter(Boolean);

  // Deduplicate by normalized key
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of [...kept, ...add]) {
    const k = normalizeBenefitKey(b);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

/** Stamp warranty fields + benefits onto a product. */
export function enrichProductWarranty<T extends Product>(p: T): T {
  const info = resolveWarranty(p);
  const next = {
    ...p,
    partsWarrantyYears: info.partsYears,
    laborWarrantyYears: info.laborYears,
    warrantySummary: info.summary,
    warrantyPartsDetail: info.partsDetail,
    warrantyLaborDetail: info.laborDetail,
    benefits: applyWarrantyToBenefits(p.benefits || [], info),
    updatedAt: p.updatedAt || new Date().toISOString(),
  } as T;
  return stampLockedBenefits(next);
}

export function enrichCatalogWarranties(products: Product[]): Product[] {
  return products.map((p) => enrichProductWarranty(p));
}

/**
 * Clean warranty lines already baked into quote line benefits
 * (fixes older quotes that were stamped 2–3 times).
 */
export function scrubLineWarrantyBenefits(
  benefits: string[],
  productLike?: Pick<Product, "name" | "sku" | "category" | "description" | "familyId" | "matchKey" | "equipmentKind" | "id">,
): string[] {
  if (!productLike) {
    // Still dedupe auto lines when product unknown
    const kept = (benefits || []).filter((b) => !isAutoWarrantyBenefitLine(b));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of kept) {
      const k = normalizeBenefitKey(b);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(b);
    }
    return out;
  }
  const info = resolveWarranty(productLike as Product);
  return applyWarrantyToBenefits(benefits || [], info);
}

/** Aggregate warranty blurb for the proposal warranty page. */
export function buildProposalWarrantyPage(
  products: Product[],
  companyName = "Acme HVAC Heating and Air Conditioning",
): string {
  const lines = [
    `${companyName} stands behind both manufacturer coverage and our own labor.`,
    "",
    "STANDARD EQUIPMENT LABOR",
    `• ${companyName} provides a 3-year labor warranty on major equipment we install (furnaces, heat pumps, air conditioners, air handlers, ductless systems, tankless water heaters, and similar), unless a shorter term is noted on a specific measure.`,
    `• Permits, load calculations, duct sealing, and similar non-equipment measures do not carry a separate 3-year labor line — equipment labor is listed on the equipment measures and summarized here.`,
    "",
    "MANUFACTURER PARTS (typical residential — California does not require registration)",
    "• Carrier: 10-year limited parts.",
    "• Mitsubishi Electric: 10-year limited parts / compressor.",
    "• Bosch: 10-year limited parts.",
    "• Navien tankless: 5-year parts and 15-year heat exchanger. Manufacturer labor is shorter — Acme HVAC labor still applies.",
    "• A. O. Smith tankless: 15-year heat exchanger and 5-year parts. Storage tanks: 6-year tank and parts (10-year on Voltex hybrids).",
    "• AprilAire cabinets / cleaners: 5-year limited product warranty; replacement media is a consumable.",
    "",
    "EXCEPTIONS (read the measure line)",
    "• Wall heaters / direct-vent heaters (e.g. Williams): manufacturer parts are typically 1 year. Acme HVAC does NOT extend labor to 3 years on these products — labor matches the short manufacturer term (1 year).",
    "• Thermostats & controls: manufacturer parts vary (Nest 2 years, ecobee 3 years, Carrier Infinity System Control 10 years). Acme HVAC labor on thermostats / controls is 2 years.",
    "",
    "Full terms appear in manufacturer literature and on the signed contract. In California, registration is not required to receive the published warranty.",
  ];
  return lines.join("\n");
}
