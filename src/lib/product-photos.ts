/**
 * Packet product photography — official manufacturer shots of the
 * specified equipment (not crew / lifestyle photos).
 *
 * Products may override with product.imageUrl (http or /product-photos/).
 * Service-only measures (permits, load calc, custom language) skip photos.
 */
import type { Product, QuoteLine } from "./proposal-types";

const PHOTO_CACHE = "sq8";
const KEEP_JPG =
  /\/(furnace|heatpump|waterheater|ductless|wallheater|wallunit|thermostat|filter|ac|minisplit|outdoor)\.jpg$/i;

function withPhotoCache(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/product-photos/") && /\.jpe?g$/i.test(url) && !KEEP_JPG.test(url)) {
    url = url.replace(/\.jpe?g$/i, ".png");
  }
  if (!url.startsWith("/product-photos/")) return url;
  if (url.includes("?")) return url;
  return `${url}?v=${PHOTO_CACHE}`;
}

/** Current Carrier AC lineup — official series photos (Comfort / Performance / Infinity). */
export const AC_SERIES_PHOTOS = {
  comfort: "/product-photos/ac-comfort-26sca5.png",
  performance: "/product-photos/ac-performance-26tpa8.png",
  infinity: "/product-photos/ac-infinity-26vna1.png",
} as const;

export const AC_SERIES_MODELS = {
  comfort: "26SCA5",
  performance: "26TPA8",
  infinity: "26VNA1",
} as const;

/** Current Carrier heat pump lineup — official outdoor unit photos. */
export const HP_SERIES_PHOTOS = {
  comfort: "/product-photos/hp-comfort-27sca5.png",
  performance: "/product-photos/hp-performance-27tpa8.png",
  infinity: "/product-photos/hp-infinity-27vna3.png",
} as const;

export const HP_SERIES_MODELS = {
  comfort: "27SCA5",
  performance: "27TPA8",
  infinity: "27VNA3",
} as const;

/** Current Carrier air handler lineup — official indoor cabinet photos. */
export const AH_SERIES_PHOTOS = {
  comfort: "/product-photos/ah-comfort-fj5.png",
  performance: "/product-photos/ah-performance-ft5.png",
  infinity: "/product-photos/ah-infinity-fe5b.png",
} as const;

export const AH_SERIES_MODELS = {
  comfort: "FJ5",
  performance: "FT5",
  infinity: "FE5B",
} as const;

/**
 * Carrier furnace lineup. Comfort 96 (59SC6) and Performance 96 (59TP6)
 * share Carrier's official cabinet photo — same published asset.
 */
export const FURN_SERIES_PHOTOS = {
  comfort80: "/product-photos/furn-comfort-80-58sb0.png",
  performance80: "/product-photos/furn-performance-80-58tp0.png",
  infinity80: "/product-photos/furn-infinity-80-58tn.png",
  comfort96: "/product-photos/furn-comfort-59sc6.png",
  performance96: "/product-photos/furn-performance-59tp6.png",
  infinity98: "/product-photos/furn-infinity-59mn7.png",
} as const;

export const FURN_SERIES_MODELS = {
  comfort80: "58SB0",
  performance80: "58TP0",
  infinity80: "58TN",
  comfort96: "59SC6",
  performance96: "59TP6",
  infinity98: "59MN7",
} as const;

export const WH_PHOTOS = {
  voltex: "/product-photos/wh-voltex-hpwh.png",
  gasTank: "/product-photos/wh-proline-gas.png",
  electricTank: "/product-photos/wh-proline-electric.png",
  navienNpe: "/product-photos/wh-navien-npe2.png",
  aosAdapt: "/product-photos/wh-aos-adapt.png",
} as const;

export const FAN_PHOTOS = {
  vks3: "/product-photos/fan-pana-vks3.png",
  vksl3: "/product-photos/fan-pana-vksl3.png",
  wc80: "/product-photos/fan-pana-wc80.png",
  wc110l: "/product-photos/fan-pana-wc110l.png",
  sense: "/product-photos/fan-pana-sense.png",
} as const;

export const DUCTLESS_PHOTOS = {
  mszFs: "/product-photos/ductless-msz-fs.png",
  mitOut: "/product-photos/mit-ms-out-muz.png",
  mitMz: "/product-photos/mit-ms-mz-out-mxz.png",
  mitCassette: "/product-photos/mit-ms-cassette.png",
  carInfWall: "/product-photos/car-ms-inf-wall-45mpha.png",
  carPerfWall: "/product-photos/car-ms-perf-wall-45maha.png",
  carInfOut: "/product-photos/car-ms-inf-out-37maha.png",
  carPerfOut: "/product-photos/car-ms-perf-out-37mara.png",
  carMz: "/product-photos/car-ms-mz-out-37mgra.png",
  carCassette: "/product-photos/car-ms-cassette-45mcca.png",
  carFloor: "/product-photos/car-ms-floor-45mbfa.png",
  carDucted: "/product-photos/car-ms-ducted-45mbda.png",
} as const;

/** Indoor head photo for a ductless style + brand. Pair with the outdoor shot. */
export function ductlessIndoorPhotoUrl(
  style?: string | null,
  brand?: string | null,
): string | null {
  const s = String(style || "high_wall");
  const mitsu = /mitsu/i.test(brand || "");
  if (s === "low_wall") return withPhotoCache(DUCTLESS_PHOTOS.carFloor);
  if (s === "one_way" || s === "four_way")
    return withPhotoCache(
      mitsu ? DUCTLESS_PHOTOS.mitCassette : DUCTLESS_PHOTOS.carCassette,
    );
  if (s === "slim_duct" || s === "ducted_ah")
    return withPhotoCache(DUCTLESS_PHOTOS.carDucted);
  if (mitsu) return withPhotoCache(DUCTLESS_PHOTOS.mszFs);
  if (/infinity/i.test(brand || ""))
    return withPhotoCache(DUCTLESS_PHOTOS.carInfWall);
  return withPhotoCache(DUCTLESS_PHOTOS.carPerfWall);
}

export const WALL_PHOTOS = {
  williamsForsaire: "/product-photos/wall-williams-forsaire.png",
  williamsMonterey: "/product-photos/wall-williams-monterey.png",
  williamsDirectVent: "/product-photos/wall-williams-directvent.png",
  rinnai: "/product-photos/wall-rinnai-ex.png",
} as const;

export const CTRL_PHOTOS = {
  ecobee: "/product-photos/tstat-ecobee-premium.png",
  nest: "/product-photos/tstat-nest.png",
} as const;

export const FILTER_PHOTOS = {
  aprilaire: "/product-photos/filter-aprilaire.png",
  iqair: "/product-photos/filter-iqair.svg",
} as const;

export const GOODMAN_PHOTOS = {
  hp: "/product-photos/hp-goodman-gszh5.svg",
  ah: "/product-photos/ah-goodman-amst.svg",
} as const;

export const NAVIEN_HVAC_PHOTOS = {
  naz: "/product-photos/navien-naz.png",
  nas: "/product-photos/navien-nas.png",
  npf: "/product-photos/navien-npf.png",
} as const;

const PHOTOS = {
  heatpump: HP_SERIES_PHOTOS.comfort,
  outdoor: HP_SERIES_PHOTOS.comfort,
  furnace: FURN_SERIES_PHOTOS.comfort80,
  ac: AC_SERIES_PHOTOS.comfort,
  acComfort: AC_SERIES_PHOTOS.comfort,
  acPerformance: AC_SERIES_PHOTOS.performance,
  acInfinity: AC_SERIES_PHOTOS.infinity,
  ductless: DUCTLESS_PHOTOS.mszFs,
  minisplit: DUCTLESS_PHOTOS.mszFs,
  thermostat: CTRL_PHOTOS.ecobee,
  waterheater: WH_PHOTOS.voltex,
  filter: FILTER_PHOTOS.aprilaire,
  wallheater: WALL_PHOTOS.williamsForsaire,
} as const;

type SeriesKey = "comfort" | "performance" | "infinity";
type FurnSeriesKey = keyof typeof FURN_SERIES_PHOTOS;

export function seriesFromOutdoorBlob(blob: string): SeriesKey {
  const s = blob.toUpperCase();
  if (
    /26VNA1|27VNA3|27VNA1|-INF\b/.test(s) ||
    /INFINITY/.test(s) ||
    /VARIABLE-SPEED/.test(s)
  )
    return "infinity";
  if (
    /26TPA8|27TPA8|27VPA9|-PER\b/.test(s) ||
    /TWO-STAGE/.test(s) ||
    /PERFORMANCE/.test(s)
  )
    return "performance";
  return "comfort";
}

export function seriesFromFurnaceBlob(blob: string): FurnSeriesKey {
  const s = blob.toUpperCase();
  const hiEff = /96%|98%|59SC|59TP|59MN|CONDENS|HIGH EFFICIENCY|HE90|ULNHE/.test(
    s,
  );
  if (/59MN7|INFINITY.?98|GREENSPEED/.test(s)) return "infinity98";
  if (/58TN|INFINITY.?80/.test(s)) return "infinity80";
  if (/INFINITY/.test(s)) return hiEff ? "infinity98" : "infinity80";
  if (/59TP6|PERFORMANCE.?96/.test(s)) return "performance96";
  if (/58TP|PERFORMANCE.?80/.test(s)) return "performance80";
  if (/PERFORMANCE/.test(s)) return hiEff ? "performance96" : "performance80";
  if (/59SC6|COMFORT.?96/.test(s)) return "comfort96";
  if (/58SB|COMFORT.?80/.test(s)) return "comfort80";
  return hiEff ? "comfort96" : "comfort80";
}

export function acSeriesFromSource(blob: string): SeriesKey {
  return seriesFromOutdoorBlob(blob);
}

export function acPhotoForSeries(series: SeriesKey): string {
  return AC_SERIES_PHOTOS[series];
}

/** Measures that look better without a product photo on the packet. */
export function shouldShowProductPhoto(
  line: Pick<QuoteLine, "name" | "role" | "unitPrice" | "showPrice" | "imageUrl"> & {
    equipmentKind?: string | null;
    sku?: string | null;
  },
): boolean {
  const blob = `${line.name}`.toLowerCase();
  if (
    /permit|load calc|manual j|warranty|maintenance|rebate|education|vs gas|expectations|language|info only|hers|title 24|svc-hers/i.test(
      blob,
    )
  )
    return false;
  if (line.showPrice === false && (line.unitPrice || 0) === 0) {
    if (/guide|info|conversion/i.test(blob)) return false;
  }
  return true;
}

function sourceBlob(
  source:
    | Pick<
        Product,
        "name" | "sku" | "category" | "equipmentKind" | "imageUrl" | "familyId"
      >
    | Pick<QuoteLine, "name" | "imageUrl">
    | null
    | undefined,
): string {
  if (!source) return "";
  return [
    "name" in source ? source.name : "",
    "sku" in source ? source.sku : "",
    "category" in source ? source.category : "",
    "equipmentKind" in source ? source.equipmentKind : "",
    "familyId" in source ? source.familyId : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function resolveProductPhotoUrl(
  source:
    | Pick<
        Product,
        "name" | "sku" | "category" | "equipmentKind" | "imageUrl" | "familyId"
      >
    | Pick<QuoteLine, "name" | "imageUrl">
    | null
    | undefined,
): string | null {
  if (!source) return null;

  const explicit = source.imageUrl?.trim();
  if (explicit) {
    if (
      /^https?:\/\//i.test(explicit) ||
      (explicit.startsWith("/product-photos/") &&
        !/\/(furnace|heatpump|waterheater|ductless|minisplit|wallheater|wallunit|thermostat|filter|outdoor|ac)\.jpg(\?|$)/i.test(
          explicit,
        ))
    ) {
      return withPhotoCache(explicit.split("?")[0]);
    }
    if (!explicit.endsWith(".svg") && !explicit.startsWith("/product-photos/"))
      return explicit;
  }

  const blob = sourceBlob(source);
  if (/goodman|gszh|amst|gdm-/i.test(blob)) {
    if (/air handler|amst|gdm-amst/i.test(blob))
      return withPhotoCache(GOODMAN_PHOTOS.ah);
    return withPhotoCache(GOODMAN_PHOTOS.hp);
  }
  if (
    /hers test|svc-hers|title 24 hers|state required independent hers|svc-permit|svc-load|svc-install|permit acquisition|load.?calc/i.test(
      blob,
    )
  )
    return null;
  const kind = "equipmentKind" in source ? source.equipmentKind || "" : "";

  if (
    /ductless|mini-?split|msz|mxz|mit-ms|mit-hyper|car-ms|38mar|37mah|37mgr|37mar/i.test(
      blob,
    ) ||
    kind === "ductless"
  ) {
    // Outdoor SKUs first — 37MAR/37MAH are condensers, not wall heads.
    if (/car-ms-mz|37mgr|38mgr/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carMz);
    if (/37mah|car-ms-inf-out/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carInfOut);
    if (/37mar|38mar|car-ms-perf-out/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carPerfOut);
    if (/mit-ms-mz-(5|8)z|mxz-sm/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.mitMz);
    if (/mit-ms-mz|mxz|multi-zone.*mitsu|mitsu.*multi-zone/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.mitMz);
    if (/muz|mit-ms-out|mit-hyper/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.mitOut);
    if (/45mph|car-ms-inf-wall/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carInfWall);
    if (/45mah|car-ms-perf-wall/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carPerfWall);
    if (/cassette/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carCassette);
    if (/floor|console|45mbf/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carFloor);
    if (/slim|ducted|45mbd|sez/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carDucted);
    if (/hyper|mit-hyper|msz-?fs|indoor|head|wall/i.test(blob) && !/out|outdoor|muz/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.mszFs);
    if (/mitsu|mit-ms/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.mitOut);
    if (/infinity.*mini/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carInfOut);
    if (/carrier|performance.*mini/i.test(blob))
      return withPhotoCache(DUCTLESS_PHOTOS.carPerfOut);
    return withPhotoCache(DUCTLESS_PHOTOS.mszFs);
  }

  if (/thermostat|ecobee|nest|infinity control|ctrl-|stat-hw/i.test(blob)) {
    if (/nest/i.test(blob)) return withPhotoCache(CTRL_PHOTOS.nest);
    if (/ecobee|ctrl-eco/i.test(blob)) return withPhotoCache(CTRL_PHOTOS.ecobee);
    return null;
  }

  if (
    /water.?heater|tankless|navien npe|wtr-|aos-|hpwh|voltex|proline|adapt\+/i.test(
      blob,
    )
  ) {
    if (/voltex|hpwh|hybrid|heat pump water|nwp/i.test(blob))
      return withPhotoCache(WH_PHOTOS.voltex);
    if (/npe-|navien.*tankless|wtr-nav|wtr-tl/i.test(blob))
      return withPhotoCache(WH_PHOTOS.navienNpe);
    if (/adapt|aos-adapt|tankless/i.test(blob))
      return withPhotoCache(WH_PHOTOS.aosAdapt);
    if (/electric|aos-e-/i.test(blob))
      return withPhotoCache(WH_PHOTOS.electricTank);
    return withPhotoCache(WH_PHOTOS.gasTank);
  }

  if (
    /wall.?heat|wall.?furnace|williams|forsaire|monterey|rinnai|energysaver|wall-wil|wall-rin|wall-coz/i.test(
      blob,
    )
  ) {
    if (/rinnai|energysaver|wall-rin|ex\d{2}dtn/i.test(blob))
      return withPhotoCache(WALL_PHOTOS.rinnai);
    if (/counterflow|forsaire/i.test(blob))
      return withPhotoCache(WALL_PHOTOS.williamsForsaire);
    if (/direct.?vent|1403822|2203822|3003822/i.test(blob) &&
        !/counterflow|forsaire|monterey|top.?vent/i.test(blob))
      return withPhotoCache(WALL_PHOTOS.williamsDirectVent);
    if (/monterey|top.?vent|wall-coz-w25|wall-coz-w35|2509622|3509622|5009622/i.test(blob))
      return withPhotoCache(WALL_PHOTOS.williamsMonterey);
    return withPhotoCache(WALL_PHOTOS.williamsMonterey);
  }

  if (/iqair|perfect 16|iq-p16/i.test(blob))
    return withPhotoCache(FILTER_PHOTOS.iqair);

  if (/bath.?fan|whispergreen|whisperceiling|whispersense|fan-pana|whisper.?green|whisper.?ceiling|whisper.?sense/i.test(blob)) {
    if (/vksl|select led|led 50/i.test(blob)) return withPhotoCache(FAN_PHOTOS.vksl3);
    if (/vks3|whispergreen select|pick-?a-?flow/i.test(blob))
      return withPhotoCache(FAN_PHOTOS.vks3);
    if (/wc110|110 cfm.*led|led 110/i.test(blob))
      return withPhotoCache(FAN_PHOTOS.wc110l);
    if (/sense|moisture and motion/i.test(blob)) return withPhotoCache(FAN_PHOTOS.sense);
    return withPhotoCache(FAN_PHOTOS.wc80);
  }

  if (/filter|media|aprilaire|air.?clean|purifier/i.test(blob))
    return withPhotoCache(FILTER_PHOTOS.aprilaire);

  if (/navien|nav-naz|nav-nas|nav-npf|nav-nhb|nav-nfb|h2air/i.test(blob)) {
    if (/nwp|heat pump water/i.test(blob)) return withPhotoCache(WH_PHOTOS.voltex);
    if (/npe|tankless/i.test(blob)) return withPhotoCache(WH_PHOTOS.navienNpe);
    if (/naz|heat pump|nav-naz/i.test(blob))
      return withPhotoCache(NAVIEN_HVAC_PHOTOS.naz);
    if (/nas|h2air|air handler|nav-nas|nav-ah/i.test(blob))
      return withPhotoCache(NAVIEN_HVAC_PHOTOS.nas);
    return withPhotoCache(NAVIEN_HVAC_PHOTOS.npf);
  }

  if (
    /furnace|car-58|car-59|fur-|gas heat|59sc6|59tp6|59mn7|58sb|58tp|58tn/i.test(
      blob,
    ) ||
    kind === "furnace"
  )
    return withPhotoCache(FURN_SERIES_PHOTOS[seriesFromFurnaceBlob(blob)]);

  if (
    /air condition|car-26|car-ac-|\b26sca5\b|\b26tpa8\b|\b26vna1\b|cooling only/i.test(
      blob,
    ) ||
    kind === "ac"
  )
    return withPhotoCache(AC_SERIES_PHOTOS[seriesFromOutdoorBlob(blob)]);

  if (
    /heat pump|car-hp|\b27sca5\b|\b27tpa8\b|\b27vna3\b/i.test(blob) ||
    kind === "heat_pump"
  ) {
    if (/bosch|ids/i.test(blob)) return null;
    return withPhotoCache(HP_SERIES_PHOTOS[seriesFromOutdoorBlob(blob)]);
  }

  if (
    /air handler|fan coil|car-ah|\bfj5\b|\bft5\b|\bfe5b\b/i.test(blob) ||
    kind === "air_handler"
  )
    return withPhotoCache(AH_SERIES_PHOTOS[seriesFromOutdoorBlob(blob)]);

  if (/concrete pad|pad /i.test(blob)) return null;
  if (/zone|honeywell|duct seal|install|startup|permit/i.test(blob))
    return null;

  return null;
}

/**
 * Stamp the official equipment photo onto a catalog product
 * so packet, packages, and admin all show the specified unit.
 */
export function stampOfficialPhoto<T extends {
  name: string;
  sku?: string;
  category?: string;
  equipmentKind?: string | null;
  imageUrl?: string | null;
  familyId?: string | null;
}>(product: T): T {
  const url = resolveProductPhotoUrl({
    name: product.name,
    sku: product.sku || "",
    category: product.category || "",
    equipmentKind: (product.equipmentKind as Product["equipmentKind"]) || undefined,
    imageUrl: null,
    familyId: product.familyId || undefined,
  });
  if (!url) return product;
  const clean = url.split("?")[0];
  if (clean === (product.imageUrl || "").split("?")[0]) return product;
  return { ...product, imageUrl: clean };
}

/**
 * Attach a packet-friendly photo URL onto a line (keeps SVG icons for admin UI).
 */
export function withPacketPhoto<T extends QuoteLine>(line: T): T {
  if (!shouldShowProductPhoto(line)) {
    return { ...line, packetPhotoUrl: null } as T;
  }
  const url = resolveProductPhotoUrl(line);
  return { ...line, packetPhotoUrl: url } as T;
}

export { PHOTOS as PRODUCT_PHOTO_MAP };
