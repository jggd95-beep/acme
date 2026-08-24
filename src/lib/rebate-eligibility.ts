/**
 * Which rebates apply to a quote given property location + equipment on the job.
 *
 * Contract: SUGGEST only. Never mark a rebate selected. Advisor taps to approve.
 * Main, option units, and packages are different product sets — a rebate can
 * qualify on option 3 / Package C and not on the first two.
 */
import type {
  Rebate,
  RebateEquipmentTag,
  RebateLocationScope,
} from "./rebates-financing";
import type { Product } from "./proposal-types";

type MeasureLike = {
  id?: string;
  productId?: string | null;
  familyId?: string;
  waterHeaterStyle?: string | null;
};


/** East Bay ZIP → city + county (expand as needed) */
export const ZIP_JURISDICTION: Record<
  string,
  { city: string; county: string }
> = {
  "94702": { city: "Berkeley", county: "Alameda" },
  "94703": { city: "Berkeley", county: "Alameda" },
  "94704": { city: "Berkeley", county: "Alameda" },
  "94705": { city: "Berkeley", county: "Alameda" },
  "94707": { city: "Berkeley", county: "Alameda" },
  "94708": { city: "Berkeley", county: "Alameda" },
  "94709": { city: "Berkeley", county: "Alameda" },
  "94710": { city: "Berkeley", county: "Alameda" },
  "94720": { city: "Berkeley", county: "Alameda" },
  "94706": { city: "Albany", county: "Alameda" },
  "94601": { city: "Oakland", county: "Alameda" },
  "94602": { city: "Oakland", county: "Alameda" },
  "94605": { city: "Oakland", county: "Alameda" },
  "94606": { city: "Oakland", county: "Alameda" },
  "94607": { city: "Oakland", county: "Alameda" },
  "94608": { city: "Emeryville", county: "Alameda" },
  "94609": { city: "Oakland", county: "Alameda" },
  "94610": { city: "Oakland", county: "Alameda" },
  "94611": { city: "Oakland", county: "Alameda" },
  "94612": { city: "Oakland", county: "Alameda" },
  "94618": { city: "Oakland", county: "Alameda" },
  "94619": { city: "Oakland", county: "Alameda" },
  "94621": { city: "Oakland", county: "Alameda" },
  "94501": { city: "Alameda", county: "Alameda" },
  "94502": { city: "Alameda", county: "Alameda" },
  "94530": { city: "El Cerrito", county: "Contra Costa" },
  "94563": { city: "Orinda", county: "Contra Costa" },
  "94549": { city: "Lafayette", county: "Contra Costa" },
  "94556": { city: "Moraga", county: "Contra Costa" },
  "94596": { city: "Walnut Creek", county: "Contra Costa" },
  "94595": { city: "Walnut Creek", county: "Contra Costa" },
  "94598": { city: "Walnut Creek", county: "Contra Costa" },
  "94541": { city: "Hayward", county: "Alameda" },
  "94544": { city: "Hayward", county: "Alameda" },
  "94545": { city: "Hayward", county: "Alameda" },
  "94546": { city: "Castro Valley", county: "Alameda" },
  "94577": { city: "San Leandro", county: "Alameda" },
  "94578": { city: "San Leandro", county: "Alameda" },
  "94579": { city: "San Leandro", county: "Alameda" },
  "94580": { city: "San Lorenzo", county: "Alameda" },
  "94801": { city: "Richmond", county: "Contra Costa" },
  "94804": { city: "Richmond", county: "Contra Costa" },
  "94805": { city: "Richmond", county: "Contra Costa" },
  "94806": { city: "San Pablo", county: "Contra Costa" },
  "94506": { city: "Danville", county: "Contra Costa" },
  "94507": { city: "Alamo", county: "Contra Costa" },
  "94509": { city: "Antioch", county: "Contra Costa" },
  "94513": { city: "Brentwood", county: "Contra Costa" },
  "94517": { city: "Clayton", county: "Contra Costa" },
  "94518": { city: "Concord", county: "Contra Costa" },
  "94519": { city: "Concord", county: "Contra Costa" },
  "94520": { city: "Concord", county: "Contra Costa" },
  "94521": { city: "Concord", county: "Contra Costa" },
  "94523": { city: "Pleasant Hill", county: "Contra Costa" },
  "94525": { city: "Crockett", county: "Contra Costa" },
  "94526": { city: "Danville", county: "Contra Costa" },
  "94531": { city: "Antioch", county: "Contra Costa" },
  "94547": { city: "Hercules", county: "Contra Costa" },
  "94553": { city: "Martinez", county: "Contra Costa" },
  "94561": { city: "Oakley", county: "Contra Costa" },
  "94564": { city: "Pinole", county: "Contra Costa" },
  "94565": { city: "Pittsburg", county: "Contra Costa" },
  "94572": { city: "Rodeo", county: "Contra Costa" },
  "94582": { city: "San Ramon", county: "Contra Costa" },
  "94583": { city: "San Ramon", county: "Contra Costa" },
  "94597": { city: "Walnut Creek", county: "Contra Costa" },
  "94803": { city: "El Sobrante", county: "Contra Costa" },
  "94901": { city: "San Rafael", county: "Marin" },
  "94903": { city: "San Rafael", county: "Marin" },
  "94904": { city: "Kentfield", county: "Marin" },
  "94920": { city: "Tiburon", county: "Marin" },
  "94924": { city: "Bolinas", county: "Marin" },
  "94925": { city: "Corte Madera", county: "Marin" },
  "94930": { city: "Fairfax", county: "Marin" },
  "94939": { city: "Larkspur", county: "Marin" },
  "94941": { city: "Mill Valley", county: "Marin" },
  "94945": { city: "Novato", county: "Marin" },
  "94947": { city: "Novato", county: "Marin" },
  "94949": { city: "Novato", county: "Marin" },
  "94957": { city: "Ross", county: "Marin" },
  "94960": { city: "San Anselmo", county: "Marin" },
  "94965": { city: "Sausalito", county: "Marin" },
  "94970": { city: "Stinson Beach", county: "Marin" },
};

export type PropertyLocation = {
  city?: string | null;
  zip?: string | null;
  county?: string | null;
  state?: string | null;
};

function norm(s: string | null | undefined) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function zip5(z: string | null | undefined) {
  const d = (z || "").replace(/\D/g, "");
  return d.slice(0, 5);
}

/** Resolve city/county from explicit fields + ZIP table */
export function resolvePropertyLocation(
  loc: PropertyLocation,
): { city: string; county: string; zip: string } {
  const zip = zip5(loc.zip);
  const fromZip = zip ? ZIP_JURISDICTION[zip] : undefined;
  const city = (loc.city || fromZip?.city || "").trim();
  const county = (loc.county || fromZip?.county || "").trim();
  return { city, county, zip };
}

export function locationScopeIsOpen(
  scope?: RebateLocationScope | null,
): boolean {
  if (!scope) return true;
  const cities = scope.cities || [];
  const zips = scope.zips || [];
  const counties = scope.counties || [];
  return cities.length === 0 && zips.length === 0 && counties.length === 0;
}

export function rebateMatchesLocation(
  rebate: Pick<Rebate, "location">,
  loc: PropertyLocation,
): boolean {
  const scope = rebate.location;
  if (locationScopeIsOpen(scope)) return true;
  const resolved = resolvePropertyLocation(loc);
  const cities = (scope?.cities || []).map(norm);
  const zips = (scope?.zips || []).map(zip5).filter(Boolean);
  const counties = (scope?.counties || []).map(norm);

  if (zips.length && resolved.zip && zips.includes(resolved.zip)) return true;
  if (cities.length && resolved.city && cities.includes(norm(resolved.city)))
    return true;
  if (
    counties.length &&
    resolved.county &&
    counties.includes(norm(resolved.county))
  )
    return true;

  return false;
}

/** Tags present on this job from selected products / measure families */
export function equipmentTagsOnJob(opts: {
  products: Product[];
  productIds: string[];
  measureInstances?: MeasureLike[];
  families?: string[];
}): Set<RebateEquipmentTag> {
  const tags = new Set<RebateEquipmentTag>(["any"]);
  const byId = new Map(opts.products.map((p) => [p.id, p]));
  const ids = new Set(opts.productIds.filter(Boolean));
  for (const inst of opts.measureInstances || []) {
    if (inst.productId) ids.add(inst.productId);
    if (inst.familyId === "furnace") {
      tags.add("furnace");
      tags.add("gas_furnace");
      tags.add("buyback");
    }
    if (inst.familyId === "water_heater") {
      tags.add("water_heater");
      tags.add("buyback");
      if (
        inst.waterHeaterStyle === "hybrid" ||
        inst.waterHeaterStyle === "sanden-split"
      ) {
        tags.add("hpwh");
      }
    }
    if (inst.familyId === "heat_pump") tags.add("heat_pump");
    if (inst.familyId === "ac") tags.add("ac");
    if (inst.familyId === "ductless") tags.add("ductless");
  }
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const blob =
      `${p.name} ${p.category} ${p.sku} ${p.equipmentKind || ""}`.toLowerCase();
    const kind = p.equipmentKind || "";
    if (kind === "furnace" || /furnace/.test(blob)) {
      tags.add("furnace");
      tags.add("gas_furnace");
      tags.add("buyback");
    }
    if (/water.?heat|tankless|navien/.test(blob)) {
      tags.add("water_heater");
      tags.add("buyback");
    }
    if (/hpwh|hybrid|voltex|heat pump water/.test(blob)) tags.add("hpwh");
    if (kind === "heat_pump" || /heat.?pump/.test(blob)) tags.add("heat_pump");
    if (kind === "ac" || /\bac\b|air condition/.test(blob)) tags.add("ac");
    if (kind === "ductless" || /ductless|mini.?split/.test(blob))
      tags.add("ductless");
  }
  for (const f of opts.families || []) {
    if (f === "furnace") {
      tags.add("furnace");
      tags.add("gas_furnace");
      tags.add("buyback");
    }
    if (f === "water_heater") {
      tags.add("water_heater");
      tags.add("buyback");
    }
  }
  return tags;
}

export function rebateMatchesEquipment(
  rebate: Pick<Rebate, "equipmentTags">,
  jobTags: Set<RebateEquipmentTag>,
): boolean {
  const need = rebate.equipmentTags || [];
  if (!need.length || need.includes("any")) return true;
  return need.some((t) => jobTags.has(t));
}

function skuNorm(s: string | null | undefined) {
  return (s || "").trim().toLowerCase();
}

/** Tighter product match. Empty productIds/skus/keys = any product already on the job. */
export function rebateMatchesProducts(
  rebate: Pick<Rebate, "productIds" | "skus" | "qualifyingKeys">,
  products: Product[],
  productIds: string[],
): boolean {
  const ids = rebate.productIds || [];
  const skus = (rebate.skus || []).map(skuNorm).filter(Boolean);
  const keys = (rebate.qualifyingKeys || []).map(skuNorm).filter(Boolean);
  if (!ids.length && !skus.length && !keys.length) return true;
  const picked = new Set(productIds.filter(Boolean));
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of picked) {
    if (ids.includes(id)) return true;
    const p = byId.get(id);
    if (!p) continue;
    const sku = skuNorm(p.sku);
    if (skus.some((s) => sku === s || sku.startsWith(s))) return true;
    const blob = skuNorm(
      `${p.id} ${p.sku} ${p.matchKey || ""} ${p.tierLabel || ""} ${p.name || ""}`,
    );
    if (keys.some((k) => blob.includes(k))) return true;
  }
  return false;
}

/**
 * Every unit on the quote: mains plus option units.
 * `mode: "main_only"` is Package A / included path.
 * `mode: "main_and_options"` is “does ANY unit on this job qualify?”
 */
export function collectQuoteProductIds(
  answers: {
    coreProductIds?: string[];
    optionalProductIds?: string[];
    measureInstances?: MeasureLike[];
    optionSelections?: Record<string, string[]>;
  },
  mode: "main_only" | "main_and_options" = "main_and_options",
): string[] {
  const ids = new Set<string>();
  for (const id of answers.coreProductIds || []) if (id) ids.add(id);
  for (const id of answers.optionalProductIds || []) if (id) ids.add(id);
  for (const inst of answers.measureInstances || []) {
    if (inst.productId) ids.add(inst.productId);
    if (mode === "main_and_options" && inst.id) {
      for (const oid of answers.optionSelections?.[inst.id] || []) {
        if (oid) ids.add(oid);
      }
    }
  }
  return [...ids];
}

/** Product ids for one comparison package (main or a specific option override). */
export function productIdsForPackageView(opts: {
  measureInstanceIds: string[];
  measureInstances?: MeasureLike[];
  optionSelections?: Record<string, string[]>;
  /** measureId → use this product instead of main (option 2 / 3) */
  productIdOverrides?: Record<string, string>;
}): string[] {
  const byId = new Map((opts.measureInstances || []).map((m) => [m.id, m]));
  const ids = new Set<string>();
  for (const mid of opts.measureInstanceIds) {
    const inst = byId.get(mid);
    if (!inst) continue;
    const override = opts.productIdOverrides?.[mid];
    if (override) ids.add(override);
    else if (inst.productId) ids.add(inst.productId);
  }
  return [...ids];
}

/**
 * Catalog rebates eligible for this property + equipment.
 * Disabled catalog items are excluded unless includeDisabled.
 * Does not select anything — caller must wait for advisor tap.
 */
export function filterEligibleRebates(
  catalog: Rebate[],
  opts: {
    location: PropertyLocation;
    products: Product[];
    productIds: string[];
    measureInstances?: MeasureLike[];
    families?: string[];
    includeDisabled?: boolean;
  },
): Rebate[] {
  const jobTags = equipmentTagsOnJob(opts);
  return catalog.filter((r) => {
    if (!opts.includeDisabled && !r.enabled) return false;
    if (!rebateMatchesLocation(r, opts.location)) return false;
    if (!rebateMatchesEquipment(r, jobTags)) return false;
    if (!rebateMatchesProducts(r, opts.products, opts.productIds)) return false;
    return true;
  });
}

/** Alias: same matcher, named for the “suggest, don’t apply” contract. */
export function suggestRebatesForProductSet(
  catalog: Rebate[],
  opts: {
    location: PropertyLocation;
    products: Product[];
    productIds: string[];
    measureInstances?: MeasureLike[];
    families?: string[];
  },
): Rebate[] {
  return filterEligibleRebates(catalog, opts);
}

/** Apply advisor amount overrides onto a rebate clone */
export function applyRebateOverrides(
  rebates: Rebate[],
  overrides?: Record<string, number> | null,
  selectedIds?: string[] | null,
): Rebate[] {
  const selected = selectedIds ? new Set(selectedIds) : null;
  return rebates
    .filter((r) => (selected ? selected.has(r.id) : r.enabled))
    .map((r) => {
      const next = { ...r, enabled: true };
      if (
        overrides &&
        overrides[r.id] != null &&
        Number.isFinite(overrides[r.id])
      ) {
        let amt = Number(overrides[r.id]);
        if (r.minAmount != null) amt = Math.max(r.minAmount, amt);
        if (r.maxAmount != null) amt = Math.min(r.maxAmount, amt);
        next.amount = Math.max(0, amt);
      }
      return next;
    });
}
