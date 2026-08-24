import { liveCompany } from "./company-store";
import { clientFacingProductTitle } from "./session-filters";
import type { Product } from "./proposal-types";
import {
  fillPacketTemplate,
  useStandardCopyStore,
} from "./standard-copy-store";

const LEAD_RE =
  /^(?:Acme HVAC will (?:furnish and install|implement) the equipment named below[\s\S]*?\n)?(?:Furnish and install new [^\n]+\n*)|^Acme HVAC will install a new [^\n]+\n*/i;

const NO_LEAD = new Set([
  "permits",
  "hers",
  "load_calc",
  "custom",
  "rebates",
  "flue",
  "install",
  "conversion_guide",
  "hpwh_guide",
  "maintenance",
  "ductwork",
]);

export function familyGetsEquipmentLead(
  familyId: string | null | undefined,
): boolean {
  if (!familyId) return false;
  return !NO_LEAD.has(familyId);
}

export function stripDisplayedFuelTag(name: string): string {
  return name
    .replace(/\s*\((NG|LP|propane)\)/gi, "")
    .replace(/\s*·\s*natural gas\b/gi, "")
    .replace(/\s*,?\s*natural gas only\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Outdoor models the packet is supposed to name (1-to-1 analog of Comfort 16). */
const KEEP_OUTDOOR_RE =
  /\b(MUZ-FS[A-Z0-9]+|MSZ-FS[A-Z0-9]+|MFZ-[A-Z0-9]+|38MARB|38MURA|37MAHA|37MPRA)\b/gi;

function withKeptOutdoorModels(text: string, edit: (s: string) => string): string {
  const kept: string[] = [];
  let s = String(text || "").replace(KEEP_OUTDOOR_RE, (m) => {
    const i = kept.length;
    kept.push(m);
    return `@@OUT${i}@@`;
  });
  s = edit(s);
  kept.forEach((m, i) => {
    s = s.replace(`@@OUT${i}@@`, m);
  });
  return s;
}

/** Drop shop codes. Keep 1-to-1 outdoor models. Strip HP chassis (27SCA5). */
export function stripShopModelCodes(text: string): string {
  return withKeptOutdoorModels(text, (s) =>
    s
      .replace(/\bNPE-\d{3}[A-Z]\d\b/gi, "")
      .replace(/\b(?:26|27)[A-Z]{3}\d\b/g, "")
      .replace(/\(\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.)])/g, "$1")
      .replace(/^\s*[,.]+\s*/g, "")
      .trim(),
  );
}

function ductlessBrandLead(title: string): string {
  const hyper = /hyper/i.test(title);
  const infinity = /infinity/i.test(title);
  const performance = /performance/i.test(title);
  if (/mitsubishi/i.test(title))
    return hyper ? "Mitsubishi Hyper-Heating®" : "Mitsubishi";
  if (/carrier/i.test(title)) {
    if (infinity) return "Carrier Infinity®";
    if (performance) return "Carrier Performance™";
    return "Carrier";
  }
  return "";
}

function customerFacingModel(
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
): string {
  if (!product) return "";
  const blob = `${product.name || ""} ${product.tierLabel || ""}`;
  const m =
    blob.match(/\b((?:26|27)[A-Z]{3}\d)\b/) ||
    blob.match(/\b(FJ5|FT5|FE5B|FV4C(?:NF)?|AMST|GSZH5|BOVA|BOVB)\b/i) ||
    blob.match(/\b(NPE-\d{3}[A-Z]?\d?)\b/i) ||
    blob.match(/\b(NWP\d+[-\s]?\d+)\b/i);
  return m ? String(m[1]).replace(/\s+/g, "") : "";
}

function withModel(
  label: string,
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
): string {
  const clean = String(label || "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const model = customerFacingModel(product);
  if (!model || !clean) return clean;
  if (new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(clean)) {
    return clean;
  }
  return `${clean} (${model})`;
}

/** Buyer-facing name — no shop SKU. Series + size + chassis model stay. */
export function customerInstallName(
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
): string {
  if (!product) return "";
  const face = clientFacingProductTitle(product as Product);
  let title = stripShopModelCodes(
    stripDisplayedFuelTag(face.title || product.name || ""),
  );
  title = withKeptOutdoorModels(title, (s) =>
    s
      .replace(/\s*Ultra-?Low\s*NOx\s*/gi, " ")
      .replace(/\s+\d{2}[A-Z]{2,}\d?\b/g, "")
      .replace(/\s+[A-Z]{2}\d[A-Z]?\b/g, "")
      .replace(/\(\s*[A-Z0-9]{4,10}\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
  const kind = (product as Product).equipmentKind;
  const blob = `${title} ${product.sku || ""} ${product.tierLabel || ""}`;
  const zoneSku = /ZONE-(HW|INF)-(\d+)/i.exec(String(product.sku || ""));
  if (zoneSku || /zone comfort|infinity®?\s+\d+-zone/i.test(title)) {
    const n = zoneSku
      ? Number(zoneSku[2])
      : Number((title.match(/(\d+)\s*-?\s*zone/i) || [])[1] || 0);
    const inf = /INF|infinity/i.test(`${product.sku} ${title}`);
    if (n >= 2) {
      title = inf
        ? `Carrier Infinity ${n}-zone system`
        : `Honeywell ${n}-zone comfort system`;
    }
  }
  if ((product as Product).familyId === "electrical" || /^ELEC-/.test(String(product.sku || ""))) {
    const sku = String(product.sku || "");
    if (/ELEC-240/.test(sku)) return "240-volt circuit";
    if (/ELEC-GFI/.test(sku)) return "GFCI receptacle";
    if (/ELEC-LIGHT/.test(sku)) return "light and wall switch";
    if (/ELEC-SUB/.test(sku)) return "sub panel";
    return "dedicated 120-volt circuit";
  }
  if ((product as Product).familyId === "hrv" || /truefresh|energy recovery|heat recovery ventilator/i.test(blob)) {
    const cfm = title.match(/(\d+)\s*CFM/i);
    const hrv = /HRV-HW|heat recovery ventilator/i.test(blob) && !/energy recovery/i.test(title);
    const noun = hrv
      ? "heat recovery ventilator"
      : "energy recovery ventilator";
    title = cfm
      ? `Honeywell TrueFRESH ${noun} · ${cfm[1]} CFM class`
      : `Honeywell TrueFRESH ${noun}`;
    return title;
  }
  const whKind = (product as Product).equipmentKind;
  if (
    whKind === "water_heater" ||
    (product as Product).familyId === "water_heater" ||
    /tankless|voltex|proline|guln|water heater|hpwh|npe-/i.test(blob)
  ) {
    const brand = /navien/i.test(blob)
      ? "Navien"
      : /sanden|sanco2/i.test(blob)
        ? "Sanden"
        : /a\.?\s*o\.?\s*smith|aos-/i.test(blob)
          ? "A. O. Smith"
          : /rinnai/i.test(blob)
            ? "Rinnai"
            : /rheem/i.test(blob)
              ? "Rheem"
              : "";
    if (/sanden|sanco2/i.test(blob)) {
      const gal = blob.match(/(\d+)\s*gal/i);
      return gal
        ? `Sanden SANCO2 ${gal[1]} gal split heat pump water heater`
        : "Sanden SANCO2 split heat pump water heater";
    }
    if (/tankless|npe-|adapt/i.test(blob))
      return `${brand ? brand + " " : ""}condensing tankless water heater`.replace(/\s+/g, " ").trim();
    if (/voltex|hybrid|hpwh|nwp|signature 900/i.test(blob)) {
      const gal =
        Number((product as Product).capacityValue) ||
        Number((blob.match(/(\d{2,3})\s*gal/i) || [])[1]) ||
        Number((String(product.sku || "").match(/(\d{2,3})$/) || [])[1]) ||
        0;
      const model =
        (String(product.name || "").match(/NWP\d+[-\s]?\d+/i) ||
          String(product.tierLabel || "").match(/NWP\d+/i) ||
          [])[0] ||
        "";
      return [brand, model, gal ? `${gal}-gallon` : "", "heat pump water heater"]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (/electric/i.test(blob) && /water|tank/i.test(blob)) {
      const gal =
        Number((product as Product).capacityValue) ||
        Number((blob.match(/(\d{2,3})\s*gal/i) || [])[1]) ||
        0;
      return `${brand ? brand + " " : ""}${gal ? gal + "-gallon " : ""}electric water heater`
        .replace(/\s+/g, " ")
        .trim();
    }
    if (/water.?heater|gas tank|proline|guln|grav/i.test(blob)) {
      const gal =
        Number((product as Product).capacityValue) ||
        Number((blob.match(/(\d{2,3})\s*gal/i) || [])[1]) ||
        0;
      return `${brand ? brand + " " : ""}${gal ? gal + "-gallon " : ""}gas water heater`
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  if (kind === "ductless" || /mini-?split|ductless/i.test(blob)) {
    const brand = ductlessBrandLead(`${title} ${product.tierLabel || ""}`);
    const zoneM = blob.match(/(\d+)\s*-?\s*zone/i);
    const zones = zoneM ? Number(zoneM[1]) : 0;
    const btuM =
      title.match(/(\d{1,2}),000\s*BTU/i) ||
      title.match(/\b(\d{1,2})k\b/i) ||
      String(product.sku || "").match(/-(\d{2})$/);
    const kbtu = btuM ? String(Number(btuM[1])) : "";
    if (zones >= 2) {
      title = `${brand || "Ductless"} ${zones}-zone ductless heat pump`;
    } else if (/MUZ-|MSZ-|38MARB|38MURA|37MAHA|37MPRA/i.test(title)) {
      // Keep the outdoor model on the packet — same rule as Comfort 16 27SCA5.
    } else if (kbtu) {
      title = `${brand || "Ductless"} ${kbtu},000 BTU ductless heat pump`;
    } else {
      title = title
        .replace(/\(1-to-1\)/gi, "")
        .replace(/Mini-Split Outdoor/gi, "ductless system")
        .replace(/Mini-Split/gi, "ductless system")
        .replace(/\b(\d{1,2})k\b/gi, "$1,000 BTU")
        .replace(/·\s*~\s*\d+(?:\.\d+)?\s*ton class/gi, "")
        .replace(/·\s*distribution box/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+·\s*$/g, "")
        .replace(/\s+\(\s*\)/g, "")
        .trim();
    }
  }
  title = title
    .replace(/\s*\(\s*placeholder\s*\)/gi, "")
    .replace(/[™®]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const fam = String((product as Product).familyId || "");
  const blobAll = `${title} ${product.sku || ""} ${product.tierLabel || ""} ${fam}`;
  const brand =
    /carrier/i.test(blobAll)
      ? "Carrier"
      : /bosch/i.test(blobAll)
        ? "Bosch"
        : /goodman/i.test(blobAll)
          ? "Goodman"
          : /navien/i.test(blobAll)
            ? "Navien"
            : /mitsubishi/i.test(blobAll)
              ? "Mitsubishi"
              : /rheem/i.test(blobAll)
                ? "Rheem"
                : "";
  const tonM = blobAll.match(/(\d+(?:\.\d+)?)\s*-?\s*ton/i);
  const tons = tonM ? tonM[1] : "";
  const namedSeries = `${product.name || ""} ${product.tierLabel || ""}`.match(
    /\b(Infinity(?:\s*®?\s*\d+)?|Performance(?:\s*™?\s*\d+)?|Comfort(?:\s*™?\s*\d+)?)/i,
  );
  const namedSeriesClean = namedSeries
    ? namedSeries[1].replace(/[™®]/g, "").replace(/\s+/g, " ").trim()
    : "";
  if (
    (kind === "heat_pump" || fam === "heat_pump" || /heat pump package/i.test(blobAll)) &&
    !/ductless|mini-?split/i.test(blobAll)
  ) {
    const series = namedSeriesClean || String(product.tierLabel || "")
      .replace(/\s*·\s*[A-Z0-9]+$/i, "")
      .replace(/\s*heat pump.*$/i, "")
      .replace(/\s*\d+(?:\.\d+)?\s*-?\s*ton.*$/i, "")
      .replace(/\bAC\b/g, "")
      .trim();
    const seriesClean =
      series && !new RegExp(`^${brand}$`, "i").test(series) ? series : "";
    if (brand && tons) {
      return withModel(
        /package/i.test(blobAll)
          ? [brand, seriesClean, `${tons}-ton`, "heat pump package"]
              .filter(Boolean)
              .join(" ")
          : [brand, seriesClean, `${tons}-ton`, "heat pump"]
              .filter(Boolean)
              .join(" "),
        product,
      );
    }
  }
  if (kind === "air_handler" || fam === "air_handler" || /air handler|fan coil/i.test(blobAll)) {
    const series = String(product.tierLabel || "")
      .replace(/\s*·\s*[A-Z0-9]+$/i, "")
      .replace(/\s*air handler.*$/i, "")
      .replace(/\s*fan coil.*$/i, "")
      .replace(/\s*\d+(?:\.\d+)?\s*-?\s*ton.*$/i, "")
      .trim();
    const seriesClean =
      series && !new RegExp(`^${brand}$`, "i").test(series) ? series : "";
    if (brand && tons)
      return withModel(
        [brand, seriesClean, `${tons}-ton`, "air handler"]
          .filter(Boolean)
          .join(" "),
        product,
      );
    if (brand)
      return withModel(
        [brand, seriesClean, "air handler"].filter(Boolean).join(" "),
        product,
      );
  }
  if (kind === "ac" || fam === "ac") {
    const series = String(product.tierLabel || "")
      .replace(/\s*·\s*[A-Z0-9]+$/i, "")
      .replace(/\s*air conditioner.*$/i, "")
      .replace(/\s*\d+(?:\.\d+)?\s*-?\s*ton.*$/i, "")
      .trim();
    const seriesClean =
      series && !new RegExp(`^${brand}$`, "i").test(series) ? series : "";
    if (brand && tons)
      return withModel(
        [brand, seriesClean, `${tons}-ton`, "air conditioner"]
          .filter(Boolean)
          .join(" "),
        product,
      );
  }
  if (kind === "coil" || fam === "coil" || /cased coil|evaporator coil/i.test(blobAll)) {
    const series = namedSeriesClean || String(product.tierLabel || "")
      .replace(/\s*·\s*[A-Z0-9]+$/i, "")
      .replace(/\s*coil.*$/i, "")
      .trim();
    const seriesClean =
      series && !new RegExp(`^${brand}$`, "i").test(series) ? series : "";
    if (brand && tons)
      return withModel(
        [brand, seriesClean, `${tons}-ton`, "coil"].filter(Boolean).join(" "),
        product,
      );
    if (brand)
      return withModel(
        [brand, seriesClean, "coil"].filter(Boolean).join(" "),
        product,
      );
  }
  if (kind === "furnace" || fam === "furnace") {
    const series = String(product.tierLabel || "")
      .replace(/\s*furnace.*$/i, "")
      .trim();
    const seriesClean =
      series && !new RegExp(`^${brand}$`, "i").test(series) ? series : "";
    if (brand)
      return withModel(
        [brand, seriesClean, "furnace"].filter(Boolean).join(" "),
        product,
      );
  }
  return withModel(title.replace(/\s{2,}/g, " ").trim(), product);
}

/** Packet title: advisor edit wins; otherwise the customer face, never the catalog SKU name. */
export function packetFaceTitle(
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
  storedTitle?: string | null,
): string {
  const stored = String(storedTitle || "").trim();
  const face = product ? customerInstallName(product) : "";
  if (!product) return stored;
  if (stored && stored !== product.name && stored !== face) return stored;
  return face || stored;
}

/** One-line subtitle under the product name on the packet. No shop codes. */
export function customerInstallBlurb(
  product: Pick<Product, "name" | "sku" | "tierLabel" | "description"> | null | undefined,
): string {
  if (!product) return "";
  const blob = `${product.name} ${product.sku || ""} ${product.tierLabel || ""}`;
  const kind = (product as Product).equipmentKind;
  if (kind === "ductless" || /mini-?split|ductless/i.test(blob)) {
    const zoneM = blob.match(/(\d+)\s*-?\s*zone/i);
    const zones = zoneM ? Number(zoneM[1]) : 0;
    if (zones >= 8)
      return "One outdoor unit serving eight indoor heads through a distribution box. Each room on its own setpoint.";
    if (zones >= 2)
      return `One outdoor unit serving ${zones} indoor heads. Each room on its own setpoint.`;
    if (/hyper/i.test(blob))
      return "Rated heat when it is actually cold outside. One outdoor, one indoor.";
    return "One outdoor and one indoor. Heat and cool the room you live in.";
  }
  if (/sanden|sanco2/i.test(blob) || /^SAN-/i.test(product.sku || ""))
    return "Split CO2 heat pump outdoor unit plus a storage tank. Works in cold weather. No backup element.";
  if (/tankless|npe-/i.test(blob))
    return "Endless hot water on demand. Compact wall-hung. Heats only what you use.";
  if (/voltex|hybrid|hpwh/i.test(blob))
    return "Pulls heat from the room air into the water. High-efficiency storage.";
  return stripShopModelCodes((product.description || "").trim());
}

/** Opener — stamp first, then the product. Standing rule for every equipment measure. */
export function familyInstallNoun(
  familyId?: string | null,
  product?: Pick<Product, "name" | "sku" | "tierLabel"> | null,
): string {
  switch (familyId) {
    case "heat_pump":
      return "heat pump system";
    case "ac":
      return "air conditioning system";
    case "furnace":
      return "furnace";
    case "air_handler":
      return "air handler";
    case "ductless":
      return "ductless system";
    case "water_heater":
      if (/sanden|sanco2/i.test(`${product?.name || ""} ${product?.sku || ""}`))
        return "Sanden SANCO2 heat pump water heater";
      if (/voltex|hybrid|hpwh|heat pump/i.test(`${product?.name || ""} ${product?.sku || ""}`))
        return "heat pump water heater";
      return "water heater";
    case "wall_heater":
      return "wall heater";
    case "coil":
      return "coil";
    case "package_unit":
      return "package unit";
    case "humidifier":
      return "humidifier";
    case "dehumidifier":
      return "dehumidifier";
    case "air_cleaner":
      return "air filter";
    case "bath_fan":
      return "bath fan";
    case "hrv": {
      const blob = `${product?.name || ""} ${product?.sku || ""}`;
      if (/HRV-HW|heat recovery ventilator/i.test(blob) && !/energy recovery/i.test(product?.name || ""))
        return "heat recovery ventilator";
      if (/ERV-HW|energy recovery/i.test(blob))
        return "energy recovery ventilator";
      return "heat recovery ventilator";
    }
    case "zoning":
      return "zone system";
    case "electrical": {
      const sku = String(product?.sku || "");
      if (/ELEC-240/.test(sku)) return "240-volt circuit";
      if (/ELEC-GFI/.test(sku)) return "GFCI receptacle";
      if (/ELEC-LIGHT/.test(sku)) return "light and wall switch";
      if (/ELEC-SUB/.test(sku)) return "sub panel";
      if (/ELEC-120/.test(sku)) return "dedicated 120-volt circuit";
      return "electrical circuit";
    }
    case "thermostat": {
      const blob = `${product?.name || ""} ${product?.sku || ""}`;
      if (/infinity/i.test(blob)) return "Infinity system control";
      return "thermostat";
    }
    case "gas_line":
      return "gas line";
    case "flue":
      return "flue";
    case "condensate":
      return "condensate drain";
    case "electrical_disconnect":
      return "electrical disconnect";
    case "ev_charger":
      return "car charger";
    case "range_hood":
      return "range hood";
    case "seismic_valve":
      return "earthquake shutoff";
    case "attic_ladder":
      return "attic ladder";
    case "attic_platform":
      return "attic platform";
    case "attic_vent":
      return "attic ventilation";
    case "sheet_metal":
      return "sheet metal";
    case "single_duct":
      return "duct run";
    default:
      return "system";
  }
}

export function equipmentLeadLines(
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
  familyId?: string | null,
  _gasFuel?: "ng" | "lp" | null,
): string[] {
  if (!product || !familyGetsEquipmentLead(familyId)) return [];
  const title = customerInstallName(product);
  if (!title) return [];
  const noun = familyInstallNoun(familyId, product);
  const co = liveCompany().shortName;
  const raw =
    useStandardCopyStore.getState().resolveBody("packet_lead") ||
    `{company} will install a new {noun} to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nInstall a new {name}.`;
  const filled = fillPacketTemplate(raw, {
    company: co,
    noun,
    name: title,
  });
  return filled
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function equipmentCloseLine(
  familyId?: string | null,
  product?: Pick<Product, "name" | "sku" | "tierLabel"> | null,
): string {
  const noun = familyInstallNoun(familyId, product);
  const co = liveCompany().shortName;
  const title = product ? customerInstallName(product) : noun;
  const raw =
    useStandardCopyStore.getState().resolveBody("packet_close") ||
    "Check, test, adjust, and start the new {noun}. Confirm proper operation.";
  return (
    fillPacketTemplate(raw, {
      company: co,
      noun,
      name: title,
    }) || `Check, test, adjust, and start the new ${noun}. Confirm proper operation.`
  );
}

export function equipmentScopeLead(
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
  familyId?: string | null,
  gasFuel?: "ng" | "lp" | null,
): string | null {
  const lines = equipmentLeadLines(product, familyId, gasFuel);
  return lines.length ? lines.join("\n") : null;
}

export function withEquipmentScopeLead(
  scope: string,
  product: Pick<Product, "name" | "sku" | "tierLabel"> | null | undefined,
  familyId?: string | null,
  gasFuel?: "ng" | "lp" | null,
): string {
  const lead = equipmentScopeLead(product, familyId, gasFuel);
  const rest = (scope || "").replace(LEAD_RE, "").trim();
  if (!lead) return rest;
  return rest ? `${lead}\n\n${rest}` : lead;
}
