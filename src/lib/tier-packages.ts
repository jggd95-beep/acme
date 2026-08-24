/**
 * Package cards from the outdoor the advisor picked as Main, plus every
 * model they tapped Option on. Never invent Comfort / Performance / Infinity
 * / Hyper / other-brand columns the advisor did not offer.
 * Heat-pump / air-handler indoor still pairs to that outdoor (matched set).
 */
import type { Product, ProductOption, Proposal, QuoteLine } from "./proposal-types";
import {
  findMatchedIndoor,
  SAMPLE_PRODUCTS,
} from "./proposal-types";
import type { PacketPackageCard } from "./packet-packages";
import { rebateDollars } from "./rebates-financing";
import { resolveProductPhotoUrl, ductlessIndoorPhotoUrl } from "./product-photos";
import { lockedEquipmentBenefits } from "./locked-benefits";
import { productBrand } from "./session-filters";
import { customerInstallName } from "./equipment-scope-lead";
import { makeConcretePadOption } from "./equipment-catalog";
import { ductlessIndoorUnitName } from "./ductless-materials";

const TIER_NAME: Record<number, string> = {
  1: "Comfort",
  2: "Performance",
  3: "Infinity",
};

function shortTier(p: Product): string {
  if (p.equipmentKind === "ductless") {
    const blob = `${p.tierLabel} ${p.name} ${p.sku}`.toLowerCase();
    if (/hyper/i.test(blob)) return "Hyper-Heat";
    if (/infinity/i.test(blob)) return "Infinity";
    if (/performance/i.test(blob)) return "Performance";
    if (/mitsubishi/i.test(blob)) return "Mitsubishi";
    if (/carrier/i.test(blob)) return "Carrier";
  }
  const brand = productBrand(p);
  if (brand && !/^carrier$/i.test(brand)) return brand;
  if (p.tier === 3 || /infinity/i.test(`${p.tierLabel} ${p.name}`))
    return "Infinity";
  if (p.tier === 2 || /performance/i.test(`${p.tierLabel} ${p.name}`))
    return "Performance";
  if (p.tier === 1 || /comfort/i.test(`${p.tierLabel} ${p.name}`))
    return "Comfort";
  return (p.tierLabel || p.name).split(/[·•]/)[0].trim() || "System";
}

function resolveProduct(
  line: QuoteLine,
  catalog: Product[],
): Product | null {
  if (line.productId) {
    const hit = catalog.find((p) => p.id === line.productId);
    if (hit) return hit;
  }
  if (line.sku) {
    const hit = catalog.find((p) => p.sku === line.sku);
    if (hit) return hit;
  }
  return catalog.find((p) => p.name === line.name) || null;
}


function ductlessIndoorFromWizard(proposal: Proposal, outdoor: Product): { name: string; style: string; brand: string } {
  const a = proposal.wizardSnapshot?.answers as any;
  const insts = a?.measureInstances || [];
  const inst = insts.find((m: any) => m.familyId === "ductless" && m.productId === outdoor.id)
    || insts.find((m: any) => m.familyId === "ductless") || null;
  const brandBlob = `${outdoor.name || ""} ${outdoor.sku || ""}`;
  const brand = (inst?.selectedBrands || [])[0]
    || (/mitsu/i.test(brandBlob) ? "Mitsubishi" : /carrier/i.test(brandBlob) ? "Carrier" : productBrand(outdoor) || "");
  const style = String((inst?.ductlessHeadStyles || [])[0] || "high_wall");
  let kbtu = Number((inst?.ductlessHeadKbtus || [])[0] || 0);
  if (!kbtu) kbtu = /mitsu/i.test(brandBlob + brand)
    ? Number((inst?.ductlessHeadKbtusMitsubishi || [])[0] || 0)
    : Number((inst?.ductlessHeadKbtusCarrier || [])[0] || 0);
  if (!kbtu && outdoor.capacityValue) kbtu = Math.round(Number(outdoor.capacityValue) / 1000);
  if (!kbtu) kbtu = 15;
  let name = ductlessIndoorUnitName({ style, kbtu, brands: brand ? [brand] : [] });
  const room = String((inst?.ductlessHeadRoomNames || [])[0] || (inst?.ductlessHeadRooms || [])[0] || "").trim();
  if (room && !/ in /i.test(name)) name = `${name} in ${room}`;
  return { name, style, brand };
}

function isOutdoorLine(p: Product | null): boolean {
  if (!p) return false;
  return (
    p.equipmentKind === "heat_pump" ||
    p.equipmentKind === "ac" ||
    p.equipmentKind === "furnace" ||
    p.equipmentKind === "ductless"
  );
}

function linePrice(line: QuoteLine): number {
  return (
    Math.max(0, Number(line.unitPrice) || 0) *
    Math.max(1, Number(line.quantity) || 1)
  );
}

function conversionOn(p: Proposal): boolean {
  const a = p.wizardSnapshot?.answers as
    | { heatingPath?: string; goals?: string[]; activeJobGoalId?: string }
    | undefined;
  if (a?.heatingPath === "heat_pump_conversion") return true;
  if (a?.activeJobGoalId === "hp_conversion") return true;
  if ((a?.goals || []).includes("hp_conversion")) return true;
  return (p.lineItems || []).some((l) =>
    /gas furnace vs heat pump|heat pump conversion|what changes/i.test(
      `${l.name} ${l.description || ""}`,
    ),
  );
}

function whyFor(tier: string, kind?: string | null): string {
  const acme = "Installed by Acme HVAC — permit, startup, and our workmanship.";
  if (kind === "ductless") {
    if (tier === "Hyper-Heat")
      return `Rated heat when it is actually cold outside. Quiet indoor head. ${acme}`;
    if (tier === "Infinity")
      return `Carrier's quietest ductless. Inverter heat and cool, no new ductwork. ${acme} This is the system we recommend.`;
    if (tier === "Performance")
      return `Carrier inverter ductless — everyday heat and cool without new ducts. ${acme}`;
    if (tier === "Mitsubishi")
      return `Proven ductless heat and cool. Quiet indoor head, inverter outdoor. ${acme}`;
    return `Ductless heat and cool for the rooms you live in. ${acme}`;
  }
  if (tier === "Infinity") {
    return `Variable-speed — quietest, most even rooms, best humidity control. ${acme} This is the system we recommend.`;
  }
  if (tier === "Hyper-Heat") {
    return `Rated heat when it is actually cold outside. ${acme}`;
  }
  if (tier === "Performance") {
    return `Two-stage — stays on low most of the day. Quieter than Comfort, more even rooms. ${acme}`;
  }
  if (tier === "Bosch") {
    return `Bosch inverter — quiet modulating heat and cool in one outdoor unit. ${acme}`;
  }
  if (tier === "Mitsubishi") {
    return `Proven ductless heat and cool. Quiet indoor head, inverter outdoor. ${acme}`;
  }
  return `Solid single-stage. Reliable on/off comfort. Lowest investment. ${acme}`;
}

function bakedName(name: string): boolean {
  return /permit|load calc|load calculation|conversion language|what changes|what to expect|rebate|maintenance|startup package|^install$/i.test(
    name,
  );
}

function collectAddOns(
  lines: QuoteLine[],
  proposal: Proposal,
): { name: string; optional: boolean; price?: number }[] {
  const out: { name: string; optional: boolean; price?: number }[] = [];
  const seen = new Set<string>();
  const push = (name: string, optional: boolean, price?: number) => {
    const key = name.toLowerCase().replace(/^option:\s*/i, "").trim();
    if (!key) return;
    const existing = out.find((x) => x.name.toLowerCase() === key);
    if (existing) {
      if (!(Number(existing.price) > 0) && Number(price) > 0) {
        existing.price = price;
      }
      return;
    }
    seen.add(key);
    out.push({ name: name.replace(/^Option:\s*/i, ""), optional, price });
  };
  for (const li of lines) {
    if (li.optional && !bakedName(li.name)) {
      push(li.name, true, Number(li.unitPrice) || undefined);
    }
    for (const o of li.options || []) {
      if (o.kind === "tier_upgrade") {
        if (/zone|zoning|truezone|honeywell/i.test(`${o.title} ${o.upgradeSku || ""}`)) {
          push(o.title || "", true, Number(o.priceDelta) || undefined);
        }
        continue;
      }
      const selected = (li.selectedOptionIds || []).includes(o.id);
      const title = (o.title || "").replace(/^Option:\s*/i, "");
      if (!title) continue;
      const delta = Number(o.priceDelta) || undefined;
      if (o.kind === "pad" || /concrete pad|equipment pad/i.test(title)) {
        push("Concrete pad", !selected, delta);
        continue;
      }
      push(title, !selected, delta);
    }
  }
  const fallbackPad = Number(makeConcretePadOption("job").priceDelta) || 0;
  const insts =
    (
      proposal.wizardSnapshot?.answers as
        | {
            measureInstances?: {
              familyId?: string;
              accessoryPicks?: string[];
              accessoryOffers?: string[];
            }[];
          }
        | undefined
    )?.measureInstances || [];
  for (const inst of insts) {
    if ((inst.accessoryPicks || []).includes("pad")) {
      push("Concrete pad", false, fallbackPad);
    } else if ((inst.accessoryOffers || []).includes("pad")) {
      push("Concrete pad", true, fallbackPad);
    }
    if ((inst.accessoryOffers || []).includes("sound_wall")) {
      push("Sound wall", true);
    }
    if ((inst.accessoryOffers || []).includes("disguise_wall")) {
      push("Disguise wall", true);
    }
  }
  return out;
}

/** Zoning only on Infinity + Bosch. Infinity control only on Infinity. */
function addOnsForPackage(
  addOns: { name: string; optional: boolean; price?: number }[],
  badge: string,
): { name: string; optional: boolean; price?: number }[] {
  const inf = /infinity/i.test(badge);
  const bosch = /bosch/i.test(badge);
  return addOns.filter((a) => {
    const n = a.name || "";
    if (
      /infinity\s*(system\s*)?control|infinity\s*(wall\s*)?(control|thermostat|sensor)/i.test(
        n,
      )
    ) {
      return inf;
    }
    if (/infinity.*zone|zone.*infinity/i.test(n)) return inf;
    if (/honeywell|truezone/i.test(n)) return bosch;
    if (/zone|zoning/i.test(n)) {
      return inf || bosch;
    }
    return true;
  });
}

function everyPackageIncludes(
  conversion: boolean,
  alsoOnVisit: string[],
): string[] {
  const rows = [
    "Acme HVAC crew — permit, startup, and workmanship",
    "Install scoped for this house",
  ];
  if (conversion) rows.push("Heat pump conversion — off the old gas heat");
  for (const extra of alsoOnVisit) rows.push(extra);
  return rows;
}

function packageRebateHit(
  proposal: Proposal,
  outdoor: Product,
  basis: number,
  tier: number,
): {
  instant: number;
  deferred: number;
  priceAfter: number;
  highlight?: string;
} {
  const kind = outdoor.equipmentKind || "";
  const tag =
    kind === "heat_pump"
      ? "heat_pump"
      : kind === "ac"
        ? "ac"
        : kind === "furnace"
          ? "furnace"
          : kind === "ductless"
            ? "ductless"
            : kind === "water_heater" || outdoor.familyId === "water_heater"
              ? "water_heater"
              : "";
  let instant = 0;
  let deferred = 0;
  for (const r of proposal.rebates || []) {
    if (!r.enabled) continue;
    const need = r.equipmentTags || [];
    if (need.includes("gas_furnace") && tag !== "furnace") continue;
    if (need.includes("water_heater") && tag !== "water_heater") continue;
    if (
      need.length &&
      !need.includes("any") &&
      tag &&
      !need.includes(tag as (typeof need)[number])
    ) {
      continue;
    }
    const dollars = rebateDollars(r, basis);
    if (dollars <= 0) continue;
    if (r.timing === "instant") instant += dollars;
    else deferred += dollars;
  }
  const highlight =
    tier >= 2
      ? "Higher-efficiency path — often qualifies for incentives the Comfort unit does not."
      : undefined;
  return {
    instant,
    deferred,
    priceAfter: Math.max(0, basis - instant),
    highlight,
  };
}

function offeredUpgradeProducts(
  line: QuoteLine,
  catalog: Product[],
  proposal?: Proposal,
): Product[] {
  const out: Product[] = [];
  const seen = new Set<string>();
  const pushSku = (sku: string | null | undefined) => {
    const s = (sku || "").trim();
    if (!s) return;
    const p = catalog.find((x) => (x.sku || "").toUpperCase() === s.toUpperCase()) || null;
    if (!p || seen.has(p.id || p.sku || "")) return;
    seen.add(p.id || p.sku || "");
    out.push(p);
  };
  for (const o of (line.options || []) as ProductOption[]) {
    if (o.kind !== "tier_upgrade") continue;
    pushSku(o.upgradeSku);
    const m = /^tier_up_.+_to_(.+)$/i.exec(o.id || "");
    if (m) pushSku(m[1]);
  }
  const a = proposal?.wizardSnapshot?.answers as any;
  if (a?.optionSelections) {
    const instId = String(line.id || "").replace(/^li_/, "");
    const matchKeys = new Set<string>([instId, line.id || "", line.productId || ""]);
    for (const inst of a.measureInstances || []) {
      if (inst.productId && inst.productId === line.productId && inst.id) matchKeys.add(inst.id);
      if (inst.id && `li_${inst.id}` === line.id) matchKeys.add(inst.id);
    }
    const ids = new Set<string>();
    for (const key of matchKeys) {
      if (!key) continue;
      for (const oid of a.optionSelections[key] || []) ids.add(oid);
    }
    for (const oid of ids) {
      const m = /^tier_up_.+_to_(.+)$/i.exec(oid);
      if (m) pushSku(m[1]);
      const onLine = ((line.options || []) as ProductOption[]).find((o) => o.id === oid);
      if (onLine?.upgradeSku) pushSku(onLine.upgradeSku);
    }
  }
  return out;
}

/**
 * Main outdoor + every model the advisor tapped as Option.
 * No brand-ladder fill. Indoor still matches the outdoor for ducted systems.
 */
export function buildTierPacketPackages(
  proposal: Proposal,
  catalog: Product[] = SAMPLE_PRODUCTS,
): PacketPackageCard[] | null {
  const lines = (proposal.lineItems || []).filter(
    (l) => l.role !== "info" && l.role !== "parked",
  );
  const included = lines.filter((l) => !l.optional);
  let outdoorLine: QuoteLine | null = null;
  let outdoor: Product | null = null;
  for (const li of included) {
    const p = resolveProduct(li, catalog);
    if (isOutdoorLine(p)) {
      outdoorLine = li;
      outdoor = p;
      break;
    }
  }
  if (!outdoor || !outdoorLine) return null;

  const offered = offeredUpgradeProducts(outdoorLine, catalog, proposal);
  const merged: Product[] = [];
  const seen = new Set<string>();
  const push = (p: Product | null | undefined) => {
    if (!p) return;
    const key = (p.sku || p.id || "").toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(p);
  };
  push(outdoor);
  for (const p of offered) push(p);
  const siblings = merged;
  if (siblings.length < 1) return null;

  let indoorLine: QuoteLine | null = null;
  let indoorHint: Product | null = null;
  for (const li of included) {
    if (li.id === outdoorLine.id) continue;
    const p = resolveProduct(li, catalog);
    if (
      p &&
      (p.equipmentKind === "air_handler" ||
        (outdoor.equipmentKind === "furnace" && p.equipmentKind === "ac") ||
        (outdoor.equipmentKind === "ac" && p.equipmentKind === "furnace"))
    ) {
      indoorLine = li;
      indoorHint = p;
      break;
    }
  }

  const shared = included.filter(
    (l) => l.id !== outdoorLine!.id && l.id !== indoorLine?.id,
  );
  const sharedPrice = shared.reduce((s, l) => s + linePrice(l), 0);
  const alsoOnVisit = shared
    .filter((l) => !bakedName(l.name) && !l.optional)
    .filter((l) =>
      /water heater|tankless|hpwh|wall heater|gallon|\bgal\b/i.test(l.name),
    )
    .map((l) => l.name);
  const conversion = conversionOn(proposal);
  const includedInEvery = everyPackageIncludes(conversion, alsoOnVisit);
  const addOns = collectAddOns(lines, proposal);
  const letters = "ABCDEFGH";
  const maxTier = Math.max(...siblings.map((s) => s.tier ?? 0));

  const cards: PacketPackageCard[] = siblings.map((sib, i) => {
    const indoor = findMatchedIndoor(sib, catalog, indoorHint);
    const ductlessHead = sib.equipmentKind === "ductless" ? ductlessIndoorFromWizard(proposal, sib) : null;
    const indoorPrice = indoorLine ? indoor?.unitPrice || 0 : 0;
    const badge = shortTier(sib);
    const recommended = (sib.tier ?? 0) === maxTier && i === siblings.findIndex((s) => (s.tier ?? 0) === maxTier);
    const outdoorName = customerInstallName(sib) || sib.name;
    const indoorName = (indoor ? customerInstallName(indoor) || indoor.name : "") || (ductlessHead?.name || "");
    const items = [outdoorName, indoorName].filter(Boolean) as string[];
    if (/infinity/i.test(badge)) {
      const ctrl = lines.find((l) =>
        /infinity\s*(system\s*)?control/i.test(l.name || ""),
      );
      if (ctrl && !items.some((n) => /infinity\s*(system\s*)?control/i.test(n))) {
        items.push(ctrl.name.replace(/^Option:\s*/i, ""));
      }
    }
    const photos: { url: string; label: string }[] = [];
    const outdoorUrl = resolveProductPhotoUrl(sib);
    if (outdoorUrl) photos.push({ url: outdoorUrl, label: outdoorName });
    if (sib.equipmentKind === "ductless") {
      const headUrl = ductlessIndoorPhotoUrl(ductlessHead?.style || "high_wall", ductlessHead?.brand || productBrand(sib) || "");
      if (headUrl && headUrl !== outdoorUrl) photos.push({ url: headUrl, label: indoorName || "Indoor head" });
    } else if (indoor) {
      const indoorUrl = resolveProductPhotoUrl(indoor);
      if (indoorUrl && indoorUrl !== outdoorUrl) photos.push({ url: indoorUrl, label: indoorName || indoor.name });
    }
    const price = (sib.unitPrice || 0) + indoorPrice + sharedPrice;
    const rebates = packageRebateHit(proposal, sib, price, sib.tier ?? 1);
    const warrantyLine =
      (sib.tier ?? 0) >= 3
        ? "Acme labor warranty + longest parts coverage"
        : (sib.tier ?? 0) >= 2
          ? "Acme labor warranty + maintenance path"
          : "Acme labor warranty on the equipment we install";
    const sameBadge = siblings.filter((s) => shortTier(s) === badge).length;
    const face = customerInstallName(sib);
    const headline =
      sameBadge > 1
        ? face || (sib.tierLabel || sib.name).replace(/\s+/g, " ").trim()
        : `${badge} system`;
    const label = `${badge} system`;
    const rawPoints = lockedEquipmentBenefits(sib) || [];
    const points = rawPoints
      .filter((b) => !/concrete pad|warranty/i.test(b))
      .map((b) =>
        /sized specifically for your home/i.test(b)
          ? "Sized to this home with a proper load calculation."
          : b,
      )
      .slice(0, 4);
    return {
      letter: letters[i] || String(i + 1),
      label,
      badge,
      headline,
      why: whyFor(badge, sib.equipmentKind),
      points,
      items,
      photos,
      warrantyLine,
      recommended,
      popular: recommended,
      rankLabel: siblings.length > 4 ? badge : undefined,
      price,
      rebateInstant: rebates.instant,
      rebateDeferred: rebates.deferred,
      priceAfterRebates: rebates.priceAfter,
      rebateHighlight: rebates.highlight,
      includedInEvery,
      addOns: addOnsForPackage(addOns, badge),
      selectKey: sib.sku || sib.id,
      outdoorSku: sib.sku,
      indoorSku: indoor?.sku,
    };
  });

  return cards.length ? cards : null;
}

void TIER_NAME;
