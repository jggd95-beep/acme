/**
 * Ductless / mini-split site extras.
 * Brand lanes (Carrier vs Mitsubishi) share the same questions.
 * Hub / PAC-MKA only when Mitsubishi goes past home-run ports.
 */

export const DUCTLESS_HEAD_STYLES = [
  { id: "high_wall", label: "High wall" },
  { id: "low_wall", label: "Low wall / floor" },
  { id: "one_way", label: "1-way cassette" },
  { id: "four_way", label: "4-way cassette" },
  { id: "slim_duct", label: "Slimline (slim ducted)" },
  { id: "ducted_ah", label: "Ducted air handler" },
] as const;

export type DuctlessHeadStyle = (typeof DUCTLESS_HEAD_STYLES)[number]["id"];

export function ductlessNeedsHub(opts: {
  brand: string | null | undefined;
  zones: number;
}): boolean {
  const b = (opts.brand || "").toLowerCase();
  const mitsu = b === "mitsubishi" || b === "both" || b.includes("mitsu");
  if (!mitsu) return false;
  return opts.zones >= 6;
}

export function ductlessHubMaybe(opts: {
  brand: string | null | undefined;
  zones: number;
}): boolean {
  const b = (opts.brand || "").toLowerCase();
  const mitsu = b === "mitsubishi" || b === "both" || b.includes("mitsu");
  return mitsu && opts.zones === 5;
}

export const DUCTLESS_HUB = {
  laborHours: 3.5,
  materialCost: 980,
  circuitLabor: 1.25,
  circuitMaterial: 185,
  serviceLightLabor: 0.45,
  serviceLightMaterial: 48,
  atticPanLabor: 0.6,
  atticPanMaterial: 95,
};

export const DUCTLESS_COVER = {
  laborHoursPerHead: 0.45,
  materialCostPerHead: 95,
};

export const DUCTLESS_ONE_WAY = {
  laborHours: 1.75,
  materialCost: 0,
};

export const DUCTLESS_SLIM = {
  laborHours: 2.25,
  materialCost: 0,
};

export const DUCTLESS_FILTER_GRILLE = {
  laborHours: 0.6,
  materialCost: 85,
};

export const DUCTLESS_APRILAIRE = {
  laborHours: 1.1,
  materialCost: 285,
};

export function isDuctlessMultiZoneProduct(p: {
  sku?: string;
  name?: string;
  category?: string;
}): boolean {
  const blob = `${p.sku || ""} ${p.name || ""} ${p.category || ""}`;
  return /MS-MZ-|multi-zone/i.test(blob);
}

export function matchesDuctlessZonePlan(
  p: { sku?: string; name?: string; category?: string; capacityValue?: number | null },
  zones: string | null | undefined,
): boolean {
  if (!zones) return true;
  const mz = isDuctlessMultiZoneProduct(p);
  if (zones === "1") {
    if (mz) return false;
    if (/\(1-to-1\)/i.test(p.name || "")) return true;
    const cap = Number(p.capacityValue);
    return [9000, 12000, 15000, 18000, 24000, 36000].includes(cap);
  }
  const sku = p.sku || "";
  if (zones === "8") return /MZ-8Z/i.test(sku);
  return new RegExp(`MZ-${zones}Z`, "i").test(sku);
}

/** 9 / 12 / 15 / 18 / 24 / 36 from SKU or capacityValue. */
export function ductlessOneToOneKbtu(p: {
  sku?: string;
  name?: string;
  capacityValue?: number | null;
}): number | null {
  if (isDuctlessMultiZoneProduct(p)) return null;
  const cap = Number(p.capacityValue);
  if ([9000, 12000, 15000, 18000, 24000, 36000].includes(cap)) return cap / 1000;
  const sku = (p.sku || "").toUpperCase();
  const m = sku.match(/-(09|12|15|18|24|36)$/);
  if (m) return Number(m[1]);
  const n = (p.name || "").match(/\b(9|12|15|18|24|36)\s*k\b/i);
  if (n) return Number(n[1]);
  return null;
}

export function isDuctlessOneToOneProduct(p: {
  sku?: string;
  name?: string;
  category?: string;
  capacityValue?: number | null;
  equipmentKind?: string | null;
}): boolean {
  if (isDuctlessMultiZoneProduct(p)) return false;
  if (p.equipmentKind && p.equipmentKind !== "ductless") return false;
  return ductlessOneToOneKbtu(p) != null;
}

export function sameDuctlessOneToOneSize(
  a: { sku?: string; name?: string; capacityValue?: number | null },
  b: { sku?: string; name?: string; capacityValue?: number | null },
): boolean {
  const ka = ductlessOneToOneKbtu(a);
  const kb = ductlessOneToOneKbtu(b);
  return ka != null && kb != null && ka === kb;
}

export const DUCTLESS_ZONE_TILES = [
  { id: "1", label: "1-to-1", blurb: "One outdoor · one indoor" },
  { id: "2", label: "2 zones", blurb: "One outdoor · two heads" },
  { id: "3", label: "3 zones", blurb: "One outdoor · three heads" },
  { id: "4", label: "4 zones", blurb: "One outdoor · four heads" },
  { id: "5", label: "5 zones", blurb: "One outdoor · five heads" },
  {
    id: "6",
    label: "6 zones",
    blurb: "Carrier home-run · Mitsubishi needs dist. box",
  },
  {
    id: "7",
    label: "7 zones",
    blurb: "Mitsubishi · distribution box",
  },
  {
    id: "8",
    label: "8 zones",
    blurb: "Mitsubishi · distribution box",
  },
] as const;

export function isDuctlessOneToOneZones(
  zones: string | number | null | undefined,
): boolean {
  return String(zones ?? "").trim() === "1";
}

/** 1-to-1 equipment walk: style tiles, in the order Mike named. */
export const DUCTLESS_1TO1_STYLES: {
  id: DuctlessHeadStyle;
  label: string;
  blurb: string;
}[] = [
  { id: "high_wall", label: "High wall", blurb: "Most rooms" },
  { id: "low_wall", label: "Low wall", blurb: "Floor console" },
  { id: "one_way", label: "1-way cassette", blurb: "Joist bay" },
  { id: "four_way", label: "4-way cassette", blurb: "Ceiling" },
  { id: "slim_duct", label: "Slimline", blurb: "Hidden / slim ducted" },
];

/** Outdoor sizes to quote on 1-to-1. Larger = future headroom, not an extra head today. */
export const DUCTLESS_1TO1_SIZE_KBTU = [9, 12, 15, 18, 24, 36] as const;

export function ductlessOneToOneSizeBtus(
  style: string | null | undefined,
  brands?: string[] | null,
): number[] {
  const list = (brands || []).filter(Boolean);
  const use = list.length ? list : ["Carrier", "Mitsubishi"];
  const indoor = new Set(
    ductlessHeadKbtuForStyle(style || "high_wall", use),
  );
  return DUCTLESS_1TO1_SIZE_KBTU.filter((k) => {
    if (indoor.has(k)) return true;
    // Bigger outdoor for later heads — only sizes the selected brand actually catalogs.
    if (k >= 24) {
      return use.some((b) => !(k === 15 && /carrier/i.test(b)));
    }
    return false;
  }).map((k) => k * 1000);
}

/** Which selected brands actually sell this indoor kBTU in this style. */
export function brandsThatSellHeadKbtuStyle(
  k: number,
  style: string | null | undefined,
  brands?: string[] | null,
): string[] {
  const map = DUCTLESS_HEAD_KBTU_BY_STYLE[style || "high_wall"];
  const pool = (brands || []).filter(Boolean);
  const names = map ? Object.keys(map) : Object.keys(DUCTLESS_HEAD_KBTU_BY_BRAND);
  return names.filter((b) => {
    if (pool.length && !pool.some((p) => p.toLowerCase() === b.toLowerCase()))
      return false;
    const sizes = map ? map[b] : DUCTLESS_HEAD_KBTU_BY_BRAND[b];
    return (sizes || []).includes(k);
  });
}

export const DUCTLESS_BOTH_BRANDS = ["Carrier", "Mitsubishi"] as const;

export const DUCTLESS_HEAD_KBTU = [6, 9, 12, 15, 18, 24] as const;

/** Indoor wall-head kBTU each brand actually sells on this catalog. */
export const DUCTLESS_HEAD_KBTU_BY_BRAND: Record<string, number[]> = {
  Mitsubishi: [6, 9, 12, 15, 18, 24],
  Carrier: [9, 12, 18, 24],
};

/** Not every style sells every kBTU. Front-end sizer must honor this. */
export const DUCTLESS_HEAD_KBTU_BY_STYLE: Record<
  string,
  Record<string, number[]>
> = {
  high_wall: {
    Mitsubishi: [6, 9, 12, 15, 18, 24],
    Carrier: [9, 12, 18, 24],
  },
  low_wall: {
    Mitsubishi: [9, 12, 18],
    Carrier: [9, 12, 18],
  },
  one_way: {
    Mitsubishi: [6, 9, 12, 18],
    Carrier: [9, 12, 18],
  },
  four_way: {
    Mitsubishi: [9, 12, 18],
    Carrier: [9, 12, 18],
  },
  slim_duct: {
    Mitsubishi: [9, 12, 18, 24],
    Carrier: [9, 12, 18],
  },
  ducted_ah: {
    Mitsubishi: [18, 24, 30, 36],
    Carrier: [18, 24, 36],
  },
};

/** Slimline indoor cabinet — inches. Space is why they picked this style. */
export const SLIM_INDOOR_DIMS: Record<
  number,
  { widthIn: number; depthIn: number; heightIn: number }
> = {
  9: { widthIn: 31.125, depthIn: 27.5, heightIn: 7.875 },
  12: { widthIn: 31.125, depthIn: 27.5, heightIn: 7.875 },
  18: { widthIn: 39, depthIn: 27.5, heightIn: 7.875 },
  24: { widthIn: 46.875, depthIn: 27.5, heightIn: 7.875 },
};

export const DUCTLESS_HEAD_ROOMS: { id: string; label: string }[] = [
  { id: "other", label: "Custom" },
  { id: "living", label: "Living" },
  { id: "family", label: "Family" },
  { id: "dining", label: "Dining" },
  { id: "kitchen", label: "Kitchen" },
  { id: "primary", label: "Primary bed" },
  { id: "bed2", label: "Bed 2" },
  { id: "bed3", label: "Bed 3" },
  { id: "guest", label: "Guest" },
  { id: "office", label: "Office" },
  { id: "bonus", label: "Bonus" },
  { id: "media", label: "Media" },
  { id: "garage", label: "Garage" },
  { id: "laundry", label: "Laundry" },
  { id: "gym", label: "Gym" },
  { id: "hall", label: "Hall" },
  { id: "basement", label: "Basement" },
  { id: "sunroom", label: "Sunroom" },
  { id: "play", label: "Playroom" },
  { id: "loft", label: "Loft" },
];

/** Legacy featured list — dedicated room page now shows every room up front. */
export const DUCTLESS_FEATURED_ROOM_IDS = [
  "living",
  "primary",
  "office",
  "kitchen",
  "family",
  "dining",
] as const;

export function ductlessHeadKbtuForStyle(
  style: string | null | undefined,
  brands: string[] | null | undefined,
): number[] {
  const map = DUCTLESS_HEAD_KBTU_BY_STYLE[style || "high_wall"];
  const list = (brands || []).filter(Boolean);
  if (!map) return ductlessHeadKbtuForBrands(brands);
  if (!list.length) {
    const all = new Set<number>();
    Object.values(map).forEach((arr) => arr.forEach((n) => all.add(n)));
    return [...all].sort((a, b) => a - b);
  }
  const set = new Set<number>();
  for (const b of list) {
    const key = Object.keys(map).find(
      (k) => k.toLowerCase() === b.toLowerCase(),
    );
    (key ? map[key] : ductlessHeadKbtuForBrands([b])).forEach((n) =>
      set.add(n),
    );
  }
  return [...set].sort((a, b) => a - b);
}

export function ductlessHeadKbtuForBrands(
  brands: string[] | null | undefined,
): number[] {
  const list = (brands || []).filter(Boolean);
  if (!list.length) {
    const all = new Set<number>();
    Object.values(DUCTLESS_HEAD_KBTU_BY_BRAND).forEach((arr) =>
      arr.forEach((n) => all.add(n)),
    );
    return [...all].sort((a, b) => a - b);
  }
  const set = new Set<number>();
  for (const b of list) {
    const key = Object.keys(DUCTLESS_HEAD_KBTU_BY_BRAND).find(
      (k) => k.toLowerCase() === b.toLowerCase(),
    );
    (key
      ? DUCTLESS_HEAD_KBTU_BY_BRAND[key]
      : [...DUCTLESS_HEAD_KBTU]
    ).forEach((n) => set.add(n));
  }
  return [...set].sort((a, b) => a - b);
}

export function brandsThatSellHeadKbtu(k: number): string[] {
  return Object.entries(DUCTLESS_HEAD_KBTU_BY_BRAND)
    .filter(([, sizes]) => sizes.includes(k))
    .map(([b]) => b);
}

const STYLE_SHORT: Record<string, string> = {
  high_wall: "high-wall",
  low_wall: "low-wall",
  one_way: "1-way cassette",
  four_way: "4-way cassette",
  slim_duct: "slim ducted",
  ducted_ah: "ducted air handler",
};

export const DUCTLESS_INDOOR_SERIES: Record<
  string,
  Record<string, string>
> = {
  high_wall: {
    Mitsubishi: "MSZ high-wall",
    Carrier: "40MAHB high-wall",
  },
  low_wall: {
    Mitsubishi: "MFZ floor console",
    Carrier: "40MBFQ floor console",
  },
  one_way: {
    Mitsubishi: "MLZ 1-way cassette",
    Carrier: "40MBCQ cassette",
  },
  four_way: {
    Mitsubishi: "SLZ 4-way cassette",
    Carrier: "40MBCQ 4-way cassette",
  },
  slim_duct: {
    Mitsubishi: "SEZ slim ducted",
    Carrier: "40MBDQ slim ducted",
  },
  ducted_ah: {
    Mitsubishi: "SVZ ducted air handler",
    Carrier: "40MBAA ducted air handler",
  },
};

export const DUCTLESS_BRAND_LANES = ["Carrier", "Mitsubishi"] as const;

/** Cheapest first. Carrier Performance is the lead; Mitsubishi is the option. */
export function ductlessBrandCostOrder(
  brands: string[] | null | undefined,
): string[] {
  const live = ductlessBrandsOnJob(brands);
  return [...DUCTLESS_BRAND_LANES].filter((b) => live.includes(b));
}

export function ductlessBrandsOnJob(
  brands: string[] | null | undefined,
): string[] {
  const list = (brands || []).filter(Boolean);
  if (!list.length) return [...DUCTLESS_BRAND_LANES];
  return DUCTLESS_BRAND_LANES.filter((b) =>
    list.some((x) => x.toLowerCase() === b.toLowerCase()),
  );
}

/** Both is still Both even if only one indoor has a size yet. */
export function ductlessBothBrandsLive(
  brands: string[] | null | undefined,
  allBrandsInSize?: boolean | null,
): boolean {
  if (allBrandsInSize) return true;
  return ductlessBrandsOnJob(brands).length > 1;
}

export function ductlessLiveBrandLanes(
  brands: string[] | null | undefined,
  allBrandsInSize?: boolean | null,
): string[] {
  if (ductlessBothBrandsLive(brands, allBrandsInSize)) {
    return [...DUCTLESS_BRAND_LANES];
  }
  return ductlessBrandCostOrder(brands);
}

export const DUCTLESS_OUTDOOR_SERIES: Record<string, string> = {
  "Carrier Performance": "38MARB outdoor",
  "Carrier Infinity": "37MAHA outdoor",
  Mitsubishi: "MUZ outdoor",
  "Mitsubishi Hyper-Heating": "MUZ Hyper-Heating outdoor",
};

/** Advisor-facing indoor + outdoor series for a unit card. Not packet copy. */
export function ductlessAdvisorModelLine(
  product: {
    name?: string | null;
    sku?: string | null;
    tierLabel?: string | null;
  },
  style?: string | null,
): string {
  const blob = `${product.name || ""} ${product.sku || ""} ${product.tierLabel || ""}`;
  const outdoor = /hyper/i.test(blob)
    ? DUCTLESS_OUTDOOR_SERIES["Mitsubishi Hyper-Heating"]
    : /mitsubishi/i.test(blob)
      ? DUCTLESS_OUTDOOR_SERIES.Mitsubishi
      : /infinity/i.test(blob)
        ? DUCTLESS_OUTDOOR_SERIES["Carrier Infinity"]
        : /carrier|performance/i.test(blob)
          ? DUCTLESS_OUTDOOR_SERIES["Carrier Performance"]
          : "";
  const brand = /mitsubishi/i.test(blob) ? "Mitsubishi" : "Carrier";
  const indoor = style ? ductlessIndoorSeries(style, brand) : "";
  return [indoor, outdoor].filter(Boolean).join(" · ") || outdoor;
}

export function ductlessIndoorSeries(
  style: string | null | undefined,
  brand: string,
): string {
  const map = DUCTLESS_INDOOR_SERIES[style || "high_wall"];
  const key = Object.keys(map || {}).find(
    (k) => k.toLowerCase() === brand.toLowerCase(),
  );
  return (key && map[key]) || STYLE_SHORT[style || "high_wall"] || "indoor";
}

export function nearestDuctlessHeadKbtu(
  want: number,
  style: string | null | undefined,
  brand: string,
): number {
  const sizes = ductlessHeadKbtuForStyle(style, [brand]);
  if (!sizes.length) return want;
  return sizes.reduce((best, n) =>
    Math.abs(n - want) < Math.abs(best - want) ? n : best,
  );
}

/** What that indoor is actually called on the job. Size + style is the unit. */
export function ductlessIndoorUnitName(opts: {
  style?: string | null;
  kbtu?: number | null;
  brands?: string[] | null;
}): string {
  const style = String(opts.style || "high_wall");
  const brands = (opts.brands || []).map((b) => b.toLowerCase());
  const onlyMitsu =
    brands.length > 0 && brands.every((b) => /mitsu/.test(b));
  const onlyCarr =
    brands.length > 0 && brands.every((b) => /carrier/.test(b));
  let noun = STYLE_SHORT[style] || "indoor";
  if (onlyMitsu) {
    if (style === "high_wall") noun = "MSZ high-wall";
    else if (style === "low_wall") noun = "MFZ floor console";
    else if (style === "one_way") noun = "MLZ 1-way cassette";
    else if (style === "slim_duct") noun = "SEZ slim ducted";
    else if (style === "ducted_ah") noun = "SVZ ducted air handler";
  } else if (onlyCarr) {
    if (style === "high_wall") noun = "40MAHB high-wall";
    else if (style === "low_wall") noun = "40MBFQ floor console";
    else if (style === "one_way") noun = "40MBCQ cassette";
    else if (style === "slim_duct") noun = "40MBDQ slim ducted";
    else if (style === "ducted_ah") noun = "40MBAA ducted air handler";
  } else if (style === "low_wall") {
    noun = "low-wall / floor console";
  }
  const k = Number(opts.kbtu || 0);
  return k > 0 ? `${k}k ${noun}` : noun;
}

const ROOM_SHORT: Record<string, string> = Object.fromEntries(
  DUCTLESS_HEAD_ROOMS.map((r) => [r.id, r.label]),
);

/** "9k low-wall in Living" — the unit they picked, then where it goes. */
export function ductlessHeadSiteLabel(opts: {
  rooms?: string[] | null;
  roomNames?: (string | null)[] | null;
  styles?: string[] | null;
  kbtus?: number[] | null;
  kbtusMitsu?: number[] | null;
  kbtusCarrier?: number[] | null;
  brands?: string[] | null;
  index: number;
}): string {
  const i = opts.index;
  const style = opts.styles?.[i] || "high_wall";
  const roomId = String(opts.rooms?.[i] || "");
  const custom = String(opts.roomNames?.[i] || "").trim();
  const room =
    (roomId === "other" || roomId === "custom") && custom
      ? custom
      : ROOM_SHORT[roomId];
  const lanes = ductlessBrandCostOrder(opts.brands);
  const bits: string[] = [];
  for (const brand of lanes) {
    const k = /mitsu/i.test(brand)
      ? Number(opts.kbtusMitsu?.[i] || 0)
      : Number(opts.kbtusCarrier?.[i] || 0);
    if (!(k > 0) && lanes.length > 1 && !(Number(opts.kbtus?.[i] || 0) > 0))
      continue;
    bits.push(
      ductlessIndoorUnitName({
        style,
        kbtu: k || opts.kbtus?.[i],
        brands: [brand],
      }),
    );
  }
  if (!bits.length) {
    bits.push(
      ductlessIndoorUnitName({
        style,
        kbtu: opts.kbtus?.[i],
        brands: opts.brands,
      }),
    );
  }
  const main = room ? `${bits[0]} in ${room}` : bits[0];
  const labeled = `Zone ${i + 1} · ${main}`;
  if (bits.length > 1) return `${labeled} · ${bits[1]} optional`;
  return labeled;
}

/** Site-question voice: 12k / 15k high-wall in Living — no SKU. */
export function ductlessHeadPlainLabel(opts: {
  rooms?: string[] | null;
  roomNames?: (string | null)[] | null;
  styles?: string[] | null;
  kbtus?: number[] | null;
  kbtusMitsu?: number[] | null;
  kbtusCarrier?: number[] | null;
  brands?: string[] | null;
  index: number;
}): string {
  const i = opts.index;
  const style = STYLE_SHORT[String(opts.styles?.[i] || "high_wall")] || "indoor";
  const roomId = String(opts.rooms?.[i] || "");
  const custom = String(opts.roomNames?.[i] || "").trim();
  const room =
    (roomId === "other" || roomId === "custom") && custom
      ? custom
      : ROOM_SHORT[roomId];
  const live = ductlessBrandsOnJob(opts.brands);
  const sizes: number[] = [];
  const add = (n: number) => {
    if (n > 0 && !sizes.includes(n)) sizes.push(n);
  };
  if (live.length > 1) {
    add(Number(opts.kbtusCarrier?.[i] || 0));
    add(Number(opts.kbtusMitsu?.[i] || 0));
  } else if (live.some((b) => /mitsu/i.test(b))) {
    add(Number(opts.kbtusMitsu?.[i] || 0));
  } else if (live.some((b) => /carrier/i.test(b))) {
    add(Number(opts.kbtusCarrier?.[i] || 0));
  }
  add(Number(opts.kbtus?.[i] || 0));
  const k = sizes.map((n) => `${n}k`).join(" / ");
  const body = k ? `${k} ${style}` : style;
  const labeled = `Zone ${i + 1} · ${body}`;
  return room ? `${labeled} in ${room}` : labeled;
}

export function ductlessAllHeadsLabel(opts: {
  rooms?: string[] | null;
  styles?: string[] | null;
  kbtus?: number[] | null;
}): string {
  const n = Math.max(
    opts.rooms?.length || 0,
    opts.styles?.length || 0,
    opts.kbtus?.length || 0,
  );
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!(Number(opts.kbtus?.[i] || 0) > 0) && !opts.rooms?.[i]) continue;
    parts.push(ductlessHeadSiteLabel({ ...opts, index: i }));
  }
  return parts.join(", ");
}

export function ductlessOutdoorKbtu(p: {
  sku?: string;
  name?: string;
  capacityValue?: number | null;
  matchKey?: string | null;
}): number | null {
  const cap = Number(p.capacityValue);
  if (Number.isFinite(cap) && cap > 1000) return Math.round(cap / 1000);
  if (Number.isFinite(cap) && cap > 0 && cap < 100) return Math.round(cap * 12);
  const blob = `${p.sku || ""} ${p.name || ""} ${p.matchKey || ""}`;
  const tonM =
    blob.match(/(\d+(?:\.\d+)?)\s*-?\s*ton/i) || blob.match(/(\d+(?:\.\d+)?)ton/i);
  if (tonM) return Math.round(Number(tonM[1]) * 12);
  return null;
}

export function ductlessConnectedHeadKbtu(
  heads: number[] | null | undefined,
): number {
  if (!heads || !heads.length) return 0;
  return heads.reduce((s, n) => s + (Number(n) || 0), 0);
}

export function ductlessHeadsOverOutdoor(
  outdoorKbtu: number | null,
  heads: number[] | null | undefined,
): boolean {
  if (outdoorKbtu == null || outdoorKbtu <= 0) return false;
  const sum = ductlessConnectedHeadKbtu(heads);
  if (sum <= 0) return false;
  return sum > outdoorKbtu * 1.05;
}

export function ductlessLargerOutdoorCandidates<
  T extends {
    id: string;
    sku?: string;
    name?: string;
    capacityValue?: number | null;
    matchKey?: string | null;
  },
>(current: T, pool: T[]): { required: T[]; optional: T[] } {
  const cur = ductlessOutdoorKbtu(current);
  if (cur == null) return { required: [], optional: [] };
  const larger = pool
    .filter((p) => p.id !== current.id)
    .map((p) => ({ p, k: ductlessOutdoorKbtu(p) }))
    .filter((x) => x.k != null && (x.k as number) > cur)
    .sort((a, b) => (a.k as number) - (b.k as number));
  return {
    required: larger.map((x) => x.p),
    optional: larger.slice(0, 2).map((x) => x.p),
  };
}

function headRoomReady(
  rooms: string[] | null | undefined,
  names: (string | null)[] | null | undefined,
  i: number,
): boolean {
  const room = String(rooms?.[i] || "").trim();
  if (!room) return false;
  if (room === "other" || room === "custom") {
    return Boolean(String(names?.[i] || "").trim());
  }
  return true;
}

export function ductlessHeadFilled(opts: {
  rooms?: string[] | null;
  roomNames?: (string | null)[] | null;
  kbtus?: number[] | null;
  kbtusMitsu?: number[] | null;
  kbtusCarrier?: number[] | null;
  index: number;
}): boolean {
  const i = opts.index;
  const k =
    Number(opts.kbtus?.[i] || 0) ||
    Number(opts.kbtusMitsu?.[i] || 0) ||
    Number(opts.kbtusCarrier?.[i] || 0);
  return headRoomReady(opts.rooms, opts.roomNames, i) && k > 0;
}

/** Required indoor count. 1-to-1 picks style + size before the outdoor, then install Qs. */
export function ductlessHeadsNeeded(
  zones: string | number | null | undefined,
): number {
  const raw = String(zones ?? "").trim();
  if (!raw) return 0;
  const n = Number(raw) || 0;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n >= 8 || raw === "8") return 8;
  return Math.min(Math.max(n, 0), 7);
}

/** Both brand lanes set when Both is on the job. Otherwise one size is enough. */
export function ductlessHeadLanesReady(opts: {
  rooms?: string[] | null;
  roomNames?: (string | null)[] | null;
  kbtusMitsu?: number[] | null;
  kbtusCarrier?: number[] | null;
  brands?: string[] | null;
  index: number;
}): boolean {
  const i = opts.index;
  if (!headRoomReady(opts.rooms, opts.roomNames, i)) return false;
  const live = ductlessBrandsOnJob(opts.brands);
  const hasC = Number(opts.kbtusCarrier?.[i] || 0) > 0;
  const hasM = Number(opts.kbtusMitsu?.[i] || 0) > 0;
  if (live.length > 1) return hasC && hasM;
  if (live.some((b) => /mitsu/i.test(b))) return hasM;
  if (live.some((b) => /carrier/i.test(b))) return hasC;
  return hasC || hasM;
}

/** Outdoor stays locked until every required indoor has room + size. */
export function allHeadsInstalled(opts: {
  zones?: string | number | null;
  rooms?: string[] | null;
  roomNames?: (string | null)[] | null;
  kbtus?: number[] | null;
  kbtusMitsu?: number[] | null;
  kbtusCarrier?: number[] | null;
  brands?: string[] | null;
  allBrandsInSize?: boolean;
}): boolean {
  const needed = ductlessHeadsNeeded(opts.zones);
  if (needed <= 0) return false;
  const both = ductlessBothBrandsLive(opts.brands, opts.allBrandsInSize);
  const live = ductlessLiveBrandLanes(opts.brands, opts.allBrandsInSize);
  return Array.from({ length: needed }).every((_, i) =>
    both
      ? ductlessHeadLanesReady({
          rooms: opts.rooms,
          roomNames: opts.roomNames,
          kbtusMitsu: opts.kbtusMitsu,
          kbtusCarrier: opts.kbtusCarrier,
          brands: live,
          index: i,
        })
      : ductlessHeadFilled({
          rooms: opts.rooms,
          roomNames: opts.roomNames,
          kbtus: opts.kbtus,
          kbtusMitsu: opts.kbtusMitsu,
          kbtusCarrier: opts.kbtusCarrier,
          index: i,
        }),
  );
}

/** Line set (new takeoff or reuse wires) done for one indoor. */
export function headSiteDone(
  scope: Record<string, unknown> | null | undefined,
  index: number,
): boolean {
  const n = index + 1;
  const sa = scope || {};
  const run = String(sa[`ms_h${n}_run`] ?? "");
  if (run === "new") {
    const take = sa[`ms_h${n}_run_takeoff`];
    if (take == null || take === "") return false;
    if (sa[`ms_h${n}_run_takeoff_closed`] === true) return true;
    return typeof take === "object" || typeof take === "string";
  }
  if (run === "reuse") {
    const ctrl = String(sa[`ms_h${n}_ctrl`] ?? "");
    if (!ctrl) return false;
    if (ctrl === "w3" || ctrl === "unverified") {
      return Boolean(sa[`ms_h${n}_14_4`]);
    }
    return true;
  }
  return false;
}

/** Line set (new takeoff or reuse wires) done for every required indoor. */
export function allHeadSitesDone(opts: {
  zones?: string | number | null;
  scope?: Record<string, unknown> | null;
}): boolean {
  const needed = ductlessHeadsNeeded(opts.zones);
  if (needed <= 0) return false;
  return Array.from({ length: needed }).every((_, i) =>
    headSiteDone(opts.scope, i),
  );
}

export type DuctlessOutdoorBand = "under" | "ideal" | "more";

/** 100% is the proper size. 75% is a legal price Main. */
export function ductlessCapacityPct(
  outdoorKbtu: number | null,
  connectedKbtu: number,
): number | null {
  if (outdoorKbtu == null || outdoorKbtu <= 0 || connectedKbtu <= 0) return null;
  return Math.round((outdoorKbtu / connectedKbtu) * 100);
}

export function ductlessCapacityBadge(
  pct: number | null,
  band: DuctlessOutdoorBand,
): string {
  if (pct == null) {
    if (band === "ideal") return "Ideal · 100%";
    if (band === "under") return "Under capacity";
    return "Future capacity";
  }
  if (band === "ideal") return `Ideal · ${pct}%`;
  if (band === "under") {
    if (pct <= 78) return `${pct}% · minimum`;
    return `${pct}% · price`;
  }
  return `${pct}% · future capacity`;
}

export function ductlessOutdoorBand(
  outdoorKbtu: number | null,
  connectedKbtu: number,
): DuctlessOutdoorBand {
  if (outdoorKbtu == null || connectedKbtu <= 0) return "ideal";
  const ratio = outdoorKbtu / connectedKbtu;
  if (ratio < 0.9) return "under";
  if (ratio > 1.1) return "more";
  return "ideal";
}

export function rankDuctlessOutdoors<
  T extends {
    id: string;
    sku?: string;
    name?: string;
    category?: string;
    capacityValue?: number | null;
    matchKey?: string | null;
  },
>(
  pool: T[],
  connectedKbtu: number,
  opts?: { showLarger?: boolean },
): { under: T[]; ideal: T[]; more: T[] } {
  const under: T[] = [];
  const ideal: T[] = [];
  const more: T[] = [];
  const brandRank = (p: T) => {
    const blob = `${p.name || ""} ${p.sku || ""} ${p.category || ""}`;
    if (/carrier/i.test(blob)) return 0;
    if (/mitsubishi/i.test(blob)) return 1;
    return 2;
  };
  const interleave = (list: T[]) => {
    const buckets: T[][] = [[], [], []];
    for (const p of list) buckets[brandRank(p)].push(p);
    const out: T[] = [];
    const max = Math.max(0, ...buckets.map((b) => b.length));
    for (let i = 0; i < max; i++) {
      for (const b of buckets) {
        if (b[i]) out.push(b[i]);
      }
    }
    return out;
  };
  const byFit = (a: T, b: T) => {
    const ak = ductlessOutdoorKbtu(a) || 0;
    const bk = ductlessOutdoorKbtu(b) || 0;
    const aPct = Math.abs(ak - connectedKbtu);
    const bPct = Math.abs(bk - connectedKbtu);
    if (aPct !== bPct) return aPct - bPct;
    return ak - bk;
  };
  const byKbtu = (a: T, b: T) => {
    const ak = ductlessOutdoorKbtu(a) || 0;
    const bk = ductlessOutdoorKbtu(b) || 0;
    if (ak !== bk) return ak - bk;
    return brandRank(a) - brandRank(b);
  };
  const cap = 60;
  const minKeep = connectedKbtu * 0.68;
  for (const p of pool) {
    const k = ductlessOutdoorKbtu(p);
    const band = ductlessOutdoorBand(k, connectedKbtu);
    if (band === "under" && (k || 0) < minKeep) continue;
    if (band === "more" && (k || 0) > cap) continue;
    if (band === "under") under.push(p);
    else if (band === "more") more.push(p);
    else ideal.push(p);
  }
  under.sort(byKbtu);
  ideal.sort(byFit);
  more.sort(byKbtu);
  return {
    under: interleave(under),
    ideal: interleave(ideal),
    more: interleave(more),
  };
}

export function ductlessProductBrand(p: {
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  tierLabel?: string | null;
}): "Carrier" | "Mitsubishi" | "Other" {
  const blob = `${p.name || ""} ${p.sku || ""} ${p.category || ""} ${p.tierLabel || ""}`;
  if (/mitsubishi|\bmit-|\bmuz|\bmsz|\bmfz|\bmlz|\bsez|\bsvz/i.test(blob))
    return "Mitsubishi";
  if (/carrier|\bcar-|\b38marb|\b37maha|\b38mura|\b37mpra|\b38mgr/i.test(blob))
    return "Carrier";
  return "Other";
}

/** Both brands: manufacturer first, size low → high inside that brand. */
export function groupDuctlessByBrandThenSize<
  T extends {
    name?: string | null;
    sku?: string | null;
    category?: string | null;
    tierLabel?: string | null;
    capacityValue?: number | null;
    matchKey?: string | null;
    tier?: number | null;
  },
>(pool: T[]): { key: string; label: string; items: T[] }[] {
  const buckets: Record<"Carrier" | "Mitsubishi" | "Other", T[]> = {
    Carrier: [],
    Mitsubishi: [],
    Other: [],
  };
  for (const p of pool) buckets[ductlessProductBrand(p)].push(p);
  const bySize = (a: T, b: T) => {
    const ak = ductlessOutdoorKbtu(a) || 0;
    const bk = ductlessOutdoorKbtu(b) || 0;
    if (ak !== bk) return ak - bk;
    return (Number(a.tier) || 0) - (Number(b.tier) || 0);
  };
  return (["Carrier", "Mitsubishi", "Other"] as const)
    .map((label) => {
      const items = buckets[label].slice().sort(bySize);
      return {
        key: label.toLowerCase(),
        label,
        items,
      };
    })
    .filter((g) => g.items.length > 0);
}
