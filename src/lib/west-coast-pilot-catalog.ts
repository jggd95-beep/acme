import type { Product } from "./proposal-types";
import { stampEnergyStar } from "./energy-star";
import { stampOfficialPhoto } from "./product-photos";
import { stampLockedBenefits } from "./locked-benefits";
import {
  defaultDimensionsForKind,
  navienNazDims,
  airHandlerCabinetDims,
  tankWaterHeaterDims,
  hpwhDims,
  navienNwpDims,
  navienNpe2Dims,
  furnaceCabinetDims,
} from "./equipment-dimensions";

const ART = "/product-art/generic.svg";
const nowIso = () => new Date().toISOString();

/**
 * West Coast / CA test catalog.
 * Natural gas only — no LP. No tankless.
 * Navien: NAZ heat pumps + NAS air handlers + NPF furnace (NG),
 *         plus NHB/NFB furnaces + H2Air for hydronic forced-air jobs.
 * Mitsubishi: M-Series ductless + communicating FAU (SVZ/SUZ, PVA/PUZ).
 * Rinnai: EnergySaver direct-vent wall furnaces, NG (DTN) only.
 * A. O. Smith: ULN / gravity / HE tanks, Voltex + Signature 900 HPWH,
 *         Adapt+ and Signature tankless. No Sanden. No 120V HPWH.
 */
export function buildWestCoastPilotCatalog(): Product[] {
  const now = nowIso();
  const out: Product[] = [];

  const boilers: {
    sku: string;
    model: string;
    btu: number;
    price: number;
    mat: number;
    hours: number;
    tier: number;
  }[] = [
    { sku: "NAV-NHB-55H", model: "NHB-55H", btu: 55000, price: 4200, mat: 1850, hours: 6, tier: 1 },
    { sku: "NAV-NHB-80H", model: "NHB-80H", btu: 80000, price: 4650, mat: 2050, hours: 6.25, tier: 1 },
    { sku: "NAV-NHB-110H", model: "NHB-110H", btu: 110000, price: 5150, mat: 2280, hours: 6.5, tier: 2 },
    { sku: "NAV-NHB-150H", model: "NHB-150H", btu: 150000, price: 5650, mat: 2520, hours: 7, tier: 2 },
    { sku: "NAV-NFB-175H", model: "NFB-175H", btu: 175000, price: 6400, mat: 2880, hours: 7.5, tier: 3 },
    { sku: "NAV-NFB-200H", model: "NFB-200H", btu: 200000, price: 6950, mat: 3120, hours: 8, tier: 3 },
  ];
  for (const b of boilers) {
    const k = Math.round(b.btu / 1000);
    out.push({
      id: "prod_" + b.sku.toLowerCase(),
      name: `Navien ${b.model} Condensing Gas Furnace — ${k},000 BTU (NG)`,
      sku: b.sku,
      category: "Heating · Navien furnace",
      description:
        `Navien ${b.model} wall-hung condensing gas furnace, natural gas only (no LP on this quote). ` +
        `~95% AFUE class. Common West Coast hydronic / H2Air heat source. Ultra-Low NOx class for CA.`,
      unitPrice: b.price,
      unit: "each",
      materialCost: b.mat,
      laborHours: b.hours,
      familyId: "navien-boiler",
      tier: b.tier,
      tierLabel: `${b.model} · ${k}k BTU NG`,
      equipmentKind: "furnace",
      matchKey: `${k}k-furnace`,
      installFuel: "gas",
      installPower: "plug_nearby",
      installMount: "wall",
      installFootprint: "wall_heater",
      installEcosystem: "none",
      installCommunicating: false,
      packageRule: "forced",
      requiresTpValve: true,
      dimensions: { widthIn: 17, depthIn: 13, heightIn: 27.6 },
      benefits: [
        "Natural gas only — no LP conversion on this quote",
        "~95% AFUE condensing heat",
        `${k},000 BTU input class`,
        "Wall-hung compact — common CA mechanical closet / garage",
        "T&P relief valve required — not a standard furnace path",
        "Pairs with Navien H2Air hydronic air handler when forced-air is needed",
        "NaviLink Wi-Fi optional (owner app)",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm natural-gas supply, condensate drain, and concentric / PVC vent path for Navien condensing furnace.\n" +
        "2. Hang furnace; gas, vent, condensate, and near-furnace piping per manufacturer.\n" +
        "3. Fill, purge, and fire; combustion analysis; set heat curve.\n" +
        "4. Owner orientation on reset, condensate, and service access.",
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const ton of [2, 2.5, 3, 3.5, 4, 5]) {
    const slug = String(ton).replace(".", "p");
    const tLabel = String(ton);
    out.push({
      id: "prod_nav_h2air_" + slug,
      name: `Navien H2Air Hydronic Air Handler (${tLabel} ton)`,
      sku: "NAV-AH-H2AIR-" + slug.toUpperCase(),
      category: "Air handler · Navien",
      description:
        `Navien H2Air hydronic air handler / coil class sized near ${tLabel} ton. ` +
        `Pairs with a Navien NHB/NFB natural-gas furnace for forced-air heat. Not a refrigerant heat pump.`,
      unitPrice: Math.round(2800 + ton * 420),
      unit: "each",
      materialCost: Math.round(1250 + ton * 180),
      laborHours: 3 + ton * 0.25,
      familyId: "navien-h2air",
      tier: 1,
      tierLabel: `H2Air · ${tLabel} ton`,
      equipmentKind: "air_handler",
      matchKey: `${tLabel}ton-ah`,
      installFuel: "n/a",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: defaultDimensionsForKind("air_handler", ton) ?? undefined,
      benefits: [
        "Hydronic air handler — furnace water to the duct system",
        `Sized near ${tLabel}-ton airflow class`,
        "Pairs with Navien NHB / NFB natural-gas furnaces",
        "Useful when the home already has (or wants) hydronic heat plus ducts",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Set H2Air air handler; transitions, condensate, and electrical.\n" +
        "2. Pipe to Navien furnace primary/secondary per H2Air kit.\n" +
        "3. Airflow and water-side commission with the matched furnace.\n" +
        "4. Owner orientation on heat-only hydronic air.",
      createdAt: now,
      updatedAt: now,
    });
  }

  // —— Navien NAZ + NAS + NPF (US HVAC, 2025+). NG only on gas. 24V conventional. ——
  const hpTons = [2, 2.5, 3, 3.5, 4, 5] as const;
  const nazChassis = (ton: number) => {
    if (ton <= 3) {
      const seer = ton <= 2 ? 18.0 : 19.5;
      return {
        model: "NAZ-17V36",
        seer2: seer,
        eer2: ton <= 2 ? 12.4 : 11.7,
        hspf2: 8.75,
        soundDb: 56,
      };
    }
    return {
      model: "NAZ-17V60",
      seer2: ton >= 5 ? 18.5 : 18.0,
      eer2: ton >= 5 ? 10.45 : 11.4,
      hspf2: ton >= 5 ? 9.1 : 9.3,
      soundDb: 58,
    };
  };
  const nasCabinet = (ton: number) => {
    if (ton <= 2.5) return "24";
    if (ton <= 3.5) return "36";
    if (ton <= 4) return "48";
    return "59";
  };
  const hpSell: Record<number, number> = {
    2: 4850,
    2.5: 5180,
    3: 5520,
    3.5: 5980,
    4: 6420,
    5: 7180,
  };

  for (const ton of hpTons) {
    const tLabel = String(ton);
    const slug = String(ton).replace(".", "p");
    const ch = nazChassis(ton);
    const sell = hpSell[ton] ?? 5500;
    out.push({
      id: "prod_nav_naz_" + slug,
      name: `Navien ${ch.model} Heat Pump (${tLabel} ton)`,
      sku: `NAV-NAZ-${slug.toUpperCase()}`,
      category: "Heat pump · Navien",
      description:
        `${tLabel}-ton Navien NAZ inverter air-to-air heat pump (R-454B). ` +
        `Chassis ${ch.model}. Conventional 24-volt thermostat. ` +
        `AHRI-matched with Navien NAS air handlers. West Coast / CA available.`,
      unitPrice: sell,
      unit: "each",
      materialCost: Math.round(sell * 0.46),
      laborHours: 2.5 + ton * 0.35,
      familyId: "navien-naz-" + slug,
      tier: 2,
      tierLabel: `NAZ inverter · ${tLabel} ton`,
      equipmentKind: "heat_pump",
      matchKey: `${tLabel}ton-hp`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "pad",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: navienNazDims(ton),
      seer2: ch.seer2,
      eer2: ch.eer2,
      hspf2: ch.hspf2,
      soundDb: ch.soundDb,
      partsWarrantyYears: 10,
      laborWarrantyYears: 1,
      benefits: [
        "Inverter compressor — matches load instead of on/off",
        `Up to ${ch.seer2} SEER2 / ${ch.hspf2} HSPF2 (AHRI match class)`,
        `Outdoor sound class ~${ch.soundDb} dBA`,
        "R-454B low-GWP refrigerant",
        "Rated heat down to −4°F outdoor",
        "Works with a standard 24-volt thermostat (not Infinity-style communicating)",
        "AHRI-matched with Navien NAS air handlers",
        "Bluetooth setup / diagnostics (Navien Multikit)",
        `Quoted in the ${tLabel}-ton capacity class`,
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Recover refrigerant; remove existing outdoor unit.\n" +
        "2. Set Navien NAZ on pad; line set and electrical per manufacturer.\n" +
        "3. Evacuate, charge R-454B, and commission heat/cool.\n" +
        "4. Pair with matched NAS air handler; owner orientation on inverter heat pump.",
      productInfoUrl: "https://www.navieninc.com/series/naz",
      createdAt: now,
      updatedAt: now,
    });

    const ahSellCt = Math.round(2800 + ton * 380);
    const ahSellVs = Math.round(ahSellCt * 1.18);
    for (const row of [
      {
        code: "NASS",
        motor: "constant torque",
        sku: `NAV-NAS-S-${slug.toUpperCase()}`,
        name: `Navien NASS${nasCabinet(ton)} Air Handler (${tLabel} ton)`,
        sell: ahSellCt,
        hours: 2.5 + ton * 0.2,
        tier: 1,
        tierLabel: `NAS constant torque · ${tLabel} ton`,
      },
      {
        code: "NASV",
        motor: "variable speed",
        sku: `NAV-NAS-V-${slug.toUpperCase()}`,
        name: `Navien NASV${nasCabinet(ton)} Air Handler (${tLabel} ton)`,
        sell: ahSellVs,
        hours: 2.7 + ton * 0.22,
        tier: 2,
        tierLabel: `NAS variable speed · ${tLabel} ton`,
      },
    ]) {
      out.push({
        id: "prod_" + row.sku.toLowerCase(),
        name: row.name,
        sku: row.sku,
        category: "Air handler · Navien",
        description:
          `${tLabel}-ton Navien ${row.code} ${row.motor} air handler. ` +
          `AHRI-matched to NAZ heat pumps. Multi-position. R-454B TXV. 24-volt.`,
        unitPrice: row.sell,
        unit: "each",
        materialCost: Math.round(row.sell * 0.48),
        laborHours: row.hours,
        familyId: "navien-nas-" + slug,
        tier: row.tier,
        tierLabel: row.tierLabel,
        equipmentKind: "air_handler",
        matchKey: `${tLabel}ton-ah`,
        installFuel: "n/a",
        installPower: "from_outdoor_shared",
        installMount: "either",
        installFootprint: "standard_cube",
        installEcosystem: "none",
        installCommunicating: false,
        dimensions: airHandlerCabinetDims(ton),
        benefits: [
          `${row.motor} ECM blower`,
          `Matched to ${tLabel}-ton Navien NAZ outdoor class`,
          "Factory TXV · R-454B · A2L leak sensor",
          "Multi-position (upflow / horizontal; downflow kit when needed)",
          "Standard 24-volt control — pairs with NAZ",
        ],
        options: [],
        imageUrl: ART,
        workScope:
          "1. Set Navien NAS air handler; transitions, condensate, and electrical.\n" +
          "2. Braze / connect R-454B line set to matched NAZ outdoor.\n" +
          "3. Commission airflow with outdoor unit.\n" +
          "4. Owner orientation on filter and drain.",
        productInfoUrl: "https://www.navieninc.com/series/nas",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const npf: {
    sku: string;
    model: string;
    btu: number;
    price: number;
    mat: number;
    hours: number;
  }[] = [
    { sku: "NAV-NPF-060U", model: "NPF700-060U3BH", btu: 60000, price: 6820, mat: 2980, hours: 6.5 },
    { sku: "NAV-NPF-080U", model: "NPF700-080U3BH", btu: 80000, price: 7480, mat: 3280, hours: 6.75 },
    { sku: "NAV-NPF-100U", model: "NPF700-100U5CH", btu: 100000, price: 8240, mat: 3620, hours: 7.25 },
    { sku: "NAV-NPF-060D", model: "NPF700-060D3BH", btu: 60000, price: 6920, mat: 3040, hours: 6.75 },
    { sku: "NAV-NPF-080D", model: "NPF700-080D3BH", btu: 80000, price: 7580, mat: 3340, hours: 7 },
    { sku: "NAV-NPF-100D", model: "NPF700-100D5CH", btu: 100000, price: 8340, mat: 3680, hours: 7.5 },
    { sku: "NAV-NPF-060H", model: "NPF700-060H3BH", btu: 60000, price: 6920, mat: 3040, hours: 6.75 },
    { sku: "NAV-NPF-080H", model: "NPF700-080H3BH", btu: 80000, price: 7580, mat: 3340, hours: 7 },
    { sku: "NAV-NPF-100H", model: "NPF700-100H5CH", btu: 100000, price: 8340, mat: 3680, hours: 7.5 },
  ];
  for (const f of npf) {
    const k = Math.round(f.btu / 1000);
    const cab = /D3BH|D5CH/.test(f.model)
      ? "Downflow"
      : /H3BH|H5CH/.test(f.model)
        ? "Horizontal"
        : "Upflow";
    out.push({
      id: "prod_" + f.sku.toLowerCase(),
      name: `Navien NPF Furnace ${cab} — ${k},000 BTU (NG)`,
      sku: f.sku,
      category: "Heating · Navien furnace",
      description:
        `Navien ${f.model} condensing ${cab.toLowerCase()} furnace, 97% AFUE, natural gas only on this quote. ` +
        `Variable 15–100% capacity. Ultra-Low NOx. Dual-fuel capable with matched NAZ heat pump. No LP quoted.`,
      unitPrice: f.price,
      unit: "each",
      materialCost: f.mat,
      laborHours: f.hours,
      familyId: "navien-npf",
      tier: 3,
      tierLabel: `NPF ${cab} · ${k}k BTU NG`,
      equipmentKind: "furnace",
      matchKey: `${k}k-furnace`,
      dimensions: furnaceCabinetDims(f.btu),
      installFuel: "gas",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      packageRule: "forced",
      requiresTpValve: true,
      benefits: [
        "97% AFUE condensing furnace",
        `${cab} cabinet — not a multi-position Carrier-style box`,
        "T&P relief valve required — own package if compared to a standard furnace",
        `${k},000 BTU input · modulates 15–100%`,
        "Natural gas only on this quote (no LP)",
        "Ultra-Low NOx (14 ng/J) — CA / West Coast path",
        "Dual-fuel capable with AHRI-matched NAZ heat pump",
        "Variable-speed ECM blower",
        "Standard 24-volt thermostat",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm natural-gas, condensate, PVC vent, and electrical for Navien NPF.\n" +
        `2. Remove existing furnace; set NPF ${cab.toLowerCase()}; gas, vent, transitions, condensate.\n` +
        "3. Startup, combustion analysis, and dual-fuel lockout if paired with NAZ.\n" +
        "4. Owner orientation on condensing furnace and filter.",
      productInfoUrl: "https://www.navieninc.com/series/npf",
      createdAt: now,
      updatedAt: now,
    });
  }

  const rinnai: {
    sku: string;
    model: string;
    btu: number;
    street: number;
    w: number;
    d: number;
    h: number;
    hours: number;
    tier: number;
  }[] = [
    { sku: "WALL-RIN-EX11DTN", model: "EX11DTN", btu: 11000, street: 1249, w: 29.1, d: 10, h: 22.9, hours: 5.5, tier: 1 },
    { sku: "WALL-RIN-EX17DTN", model: "EX17DTN", btu: 16700, street: 1499, w: 29.9, d: 10.1, h: 22.9, hours: 5.75, tier: 2 },
    { sku: "WALL-RIN-EX22DTN", model: "EX22DTN", btu: 21500, street: 1749, w: 29.9, d: 10.1, h: 27.4, hours: 6, tier: 3 },
    { sku: "WALL-RIN-EX38DTN", model: "EX38DTN", btu: 38400, street: 2149, w: 36.6, d: 13, h: 27.4, hours: 6.5, tier: 4 },
  ];
  for (const r of rinnai) {
    const laborSell = Math.round(r.hours * 145);
    out.push({
      id: "prod_" + r.sku.toLowerCase(),
      name: `Rinnai EnergySaver ${r.model} Direct-Vent Wall Furnace (${r.btu.toLocaleString()} BTU NG)`,
      sku: r.sku,
      category: "Wall heat · Direct-vent",
      description:
        `Rinnai EnergySaver ${r.model} sealed direct-vent wall furnace, natural gas only (DTN = NG). ` +
        `West Coast / CA common. No LP (DTP) on this catalog. Through-wall concentric vent.`,
      unitPrice: Math.round(r.street * 1.18 + laborSell),
      unit: "each",
      materialCost: r.street,
      laborHours: r.hours,
      familyId: "wall-heater",
      tier: r.tier,
      tierLabel: `Direct-vent · ${r.btu.toLocaleString()} BTU · natural gas`,
      equipmentKind: "other",
      matchKey: "wall-heater-direct-vent",
      installFuel: "gas",
      installPower: "plug_nearby",
      installMount: "wall",
      installFootprint: "wall_heater",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: { widthIn: r.w, depthIn: r.d, heightIn: r.h },
      benefits: [
        "Sealed direct-vent — combustion air from outdoors",
        `${r.btu.toLocaleString()} BTU natural gas (no LP on this quote)`,
        "Modulating EnergySaver — quieter, even zone heat",
        "Programmable thermostat on the unit",
        `Advisor fit: ${r.w}" W × ${r.d}" D × ${r.h}" H class`,
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm exterior wall, wall thickness, and clearances for Rinnai EnergySaver concentric vent.\n" +
        "2. Core / prepare the through-wall penetration; protect finishes.\n" +
        "3. Hang the heater; install the vent kit and seals; connect natural gas per code.\n" +
        "4. Commission ignition and modulation; verify venting; owner orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const cozy: {
    sku: string;
    model: string;
    name: string;
    btu: number;
    street: number;
    hours: number;
    vent: string;
    match: string;
    w: number;
    d: number;
    h: number;
    tier: number;
  }[] = [
    {
      sku: "WALL-COZ-W255",
      model: "W255",
      name: "Cozy 25,000 BTU Top-Vent Wall Furnace (NG)",
      btu: 25000,
      street: 889,
      hours: 5.5,
      vent: "Top-vent gravity",
      match: "wall-heater-top-vent",
      w: 16,
      d: 7,
      h: 72,
      tier: 1,
    },
    {
      sku: "WALL-COZ-W355",
      model: "W355",
      name: "Cozy 35,000 BTU Top-Vent Wall Furnace (NG)",
      btu: 35000,
      street: 1049,
      hours: 6,
      vent: "Top-vent gravity",
      match: "wall-heater-top-vent",
      w: 16,
      d: 7,
      h: 72,
      tier: 2,
    },
    {
      sku: "WALL-COZ-CDV335D",
      model: "CDV335D",
      name: "Cozy 33,000 BTU Direct-Vent Wall Furnace (NG)",
      btu: 33000,
      street: 1399,
      hours: 5.5,
      vent: "Direct-vent through-wall",
      match: "wall-heater-direct-vent",
      w: 34.5,
      d: 9.75,
      h: 31.5,
      tier: 3,
    },
    {
      sku: "WALL-COZ-DVCF403D",
      model: "DVCF403D",
      name: "Cozy 40,000 BTU Counterflow Direct-Vent (NG)",
      btu: 40000,
      street: 1899,
      hours: 7,
      vent: "Counterflow direct-vent",
      match: "wall-heater-counterflow",
      w: 14.25,
      d: 11.5,
      h: 72,
      tier: 4,
    },
  ];
  for (const c of cozy) {
    const laborSell = Math.round(c.hours * 145);
    out.push({
      id: "prod_" + c.sku.toLowerCase(),
      name: c.name,
      sku: c.sku,
      category: "Wall heat · Cozy",
      description:
        `Cozy ${c.model} ${c.vent}, natural gas only. Common West Coast wall-furnace replacement. No LP.`,
      unitPrice: Math.round(c.street * 1.18 + laborSell),
      unit: "each",
      materialCost: c.street,
      laborHours: c.hours,
      familyId: "wall-heater",
      tier: c.tier,
      tierLabel: `${c.vent} · ${c.btu.toLocaleString()} BTU · NG`,
      equipmentKind: "other",
      matchKey: c.match,
      installFuel: "gas",
      installPower: c.match.includes("counterflow")
        ? "dedicated_circuit"
        : "none",
      installMount: "wall",
      installFootprint: "wall_heater",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: { widthIn: c.w, depthIn: c.d, heightIn: c.h },
      benefits: [
        `${c.vent} · ${c.btu.toLocaleString()} BTU natural gas`,
        "Cozy — common alternate to Williams",
        "No LP on this quote",
        `Advisor fit: ${c.w}" W × ${c.d}" D × ${c.h}" H`,
      ],
      options: [],
      imageUrl: ART,
      workScope:
        `1. Confirm vent path, wall, and gas for Cozy ${c.model}.\n` +
        "2. Remove existing wall heater if applicable.\n" +
        "3. Set cabinet; vent and natural gas per code.\n" +
        "4. Fire, safety/CO checks; owner orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosTanks: { gal: number; sku: string; model: string; price: number; mat: number; hours: number }[] = [
    { gal: 30, sku: "AOS-GULN-30", model: "ProLine XE Ultra-Low NOx 30", price: 2280, mat: 860, hours: 4.25 },
    { gal: 40, sku: "AOS-GULN-40", model: "ProLine XE Ultra-Low NOx 40", price: 2450, mat: 980, hours: 4.5 },
    { gal: 50, sku: "AOS-GULN-50", model: "ProLine XE Ultra-Low NOx 50", price: 2680, mat: 1120, hours: 4.75 },
    { gal: 75, sku: "AOS-GULN-75", model: "ProLine XE Ultra-Low NOx 75", price: 3250, mat: 1480, hours: 5.5 },
  ];
  for (const t of aosTanks) {
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: `A. O. Smith ${t.model} Gallon Gas Tank (NG)`,
      sku: t.sku,
      category: "Water heating · AO Smith",
      description:
        `A. O. Smith ${t.model}-gallon natural-gas tank. Ultra-Low NOx for CA / West Coast. No LP. No tankless.`,
      unitPrice: t.price,
      unit: "each",
      materialCost: t.mat,
      laborHours: t.hours,
      familyId: "aos-gas-tank",
      tier: t.gal >= 75 ? 2 : 1,
      tierLabel: `${t.gal} gal NG tank`,
      capacityValue: t.gal,
      equipmentKind: "other",
      matchKey: `wh-tank-${t.gal}`,
      installFuel: "gas",
      installPower: "none",
      installMount: "either",
      installFootprint: "tank",
      installEcosystem: "none",
      installCommunicating: false,
      ventStyle: "gravity",
      dimensions: tankWaterHeaterDims(t.gal),
      benefits: [
        `${t.gal}-gallon natural-gas tank`,
        t.gal >= 75
          ? "UEF ~0.59 · first-hour ~115 gal class"
          : t.gal >= 50
            ? "UEF ~0.63 · first-hour ~80 gal class"
            : "UEF ~0.60 · first-hour ~65 gal class",
        "Ultra-Low NOx — CA / West Coast path",
        "Familiar recovery vs hybrid heat-pump tanks",
        "Seismic strap and expansion tank as required",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm natural-gas, vent, and seismic for A. O. Smith tank.\n" +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set new tank; water, gas, vent, T&P, expansion, strap.\n" +
        "4. Fire, check draft, set temperature; owner orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosGravity: { gal: number; sku: string; model: string; price: number; mat: number; hours: number; flue: number }[] = [
    { gal: 30, sku: "AOS-GRAV-30", model: "ProLine Atmospheric 30", price: 2090, mat: 780, hours: 4, flue: 58.5 },
    { gal: 40, sku: "AOS-GRAV-40", model: "ProLine Atmospheric 40", price: 2280, mat: 890, hours: 4.25, flue: 66.75 },
    { gal: 50, sku: "AOS-GRAV-50", model: "ProLine Atmospheric 50", price: 2480, mat: 1020, hours: 4.5, flue: 68.5 },
    { gal: 75, sku: "AOS-GRAV-75", model: "ProLine Atmospheric 75", price: 2980, mat: 1320, hours: 5.25, flue: 70 },
  ];
  for (const t of aosGravity) {
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: `A. O. Smith ${t.model} Gallon Gravity (NG)`,
      sku: t.sku,
      category: "Water heating · AO Smith",
      description:
        `A. O. Smith ${t.gal}-gallon atmospheric / gravity-vent tank, natural gas. ` +
        `Draft hood + B-vent. Flue height to collar ${t.flue}". No LP.`,
      unitPrice: t.price,
      unit: "each",
      materialCost: t.mat,
      laborHours: t.hours,
      familyId: "aos-gas-tank",
      tier: 1,
      tierLabel: `${t.gal} gal gravity NG`,
      capacityValue: t.gal,
      equipmentKind: "other",
      matchKey: `wh-tank-${t.gal}`,
      installFuel: "gas",
      installPower: "none",
      installMount: "either",
      installFootprint: "tank",
      installEcosystem: "none",
      installCommunicating: false,
      ventStyle: "gravity",
      flueHeightIn: t.flue,
      dimensions: tankWaterHeaterDims(t.gal),
      benefits: [
        `${t.gal}-gallon atmospheric gravity-vent tank`,
        `Flue ${t.flue}" floor to draft-hood collar`,
        t.gal >= 50
          ? "UEF ~0.60 · first-hour ~80 gal class"
          : "UEF ~0.58 · first-hour ~65 gal class",
        "Natural gas only — no LP on this quote",
        "Reuse existing B-vent when size and height work",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm existing B-vent size, height, and draft for gravity tank.\n" +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set gravity tank; water, gas, draft hood, T&P, strap.\n" +
        "4. Check draft; set temperature; owner orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosHe: { gal: number; sku: string; model: string; price: number; mat: number; hours: number }[] = [
    { gal: 50, sku: "AOS-HE-50", model: "ProLine XE Condensing 50", price: 3180, mat: 1480, hours: 5.25 },
    { gal: 75, sku: "AOS-HE-75", model: "ProLine XE Condensing 75", price: 3780, mat: 1820, hours: 5.75 },
  ];
  for (const t of aosHe) {
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: `A. O. Smith ${t.model} Gallon High-Efficiency Gas (NG)`,
      sku: t.sku,
      category: "Water heating · AO Smith",
      description:
        `A. O. Smith ${t.gal}-gallon condensing high-efficiency gas tank. PVC vent (same path as tankless). ` +
        `UEF ~0.80. Needs 120V and a condensate drain. No LP. Not Sanden. Not 120V heat pump.`,
      unitPrice: t.price,
      unit: "each",
      materialCost: t.mat,
      laborHours: t.hours,
      familyId: "aos-gas-tank",
      tier: 2,
      tierLabel: `HE ${t.gal} gal PVC`,
      capacityValue: t.gal,
      equipmentKind: "other",
      matchKey: `wh-tank-he-${t.gal}`,
      installFuel: "gas",
      installPower: "plug_nearby",
      installMount: "either",
      installFootprint: "tank",
      installEcosystem: "none",
      installCommunicating: false,
      ventStyle: "power_vent",
      dimensions: tankWaterHeaterDims(t.gal),
      benefits: [
        `${t.gal}-gallon condensing high-efficiency gas tank`,
        "PVC vent — same path as tankless",
        "120V plug + condensate drain",
        "UEF ~0.80 class",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm PVC vent path, condensate, and 120V for the high-efficiency tank.\n" +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set HE gas tank; water, gas, PVC vent, condensate, T&P, strap.\n" +
        "4. Fire; set temperature; owner orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const navienTl: {
    sku: string;
    model: string;
    klass: number;
    price: number;
    mat: number;
    hours: number;
  }[] = [
    { sku: "WTR-NAV-NPE-150S2", model: "NPE-150S2", klass: 150, price: 3199, mat: 1450, hours: 5 },
    { sku: "WTR-NAV-NPE-180S2", model: "NPE-180S2", klass: 180, price: 3499, mat: 1649, hours: 5 },
    { sku: "WTR-NAV-NPE-210A2", model: "NPE-210A2", klass: 210, price: 3899, mat: 1899, hours: 5.5 },
    { sku: "WTR-NAV-NPE-240A2", model: "NPE-240A2", klass: 240, price: 4299, mat: 2099, hours: 5.5 },
  ];
  for (const t of navienTl) {
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: `Navien ${t.model} Tankless Water Heater`,
      sku: t.sku,
      category: "Water heating · Navien",
      description:
        `Navien ${t.model} condensing tankless, ${t.klass} class. PVC vent. Natural gas only. No LP.`,
      unitPrice: t.price,
      unit: "each",
      materialCost: t.mat,
      laborHours: t.hours,
      familyId: "water_heater",
      tier: t.klass >= 210 ? 3 : 2,
      tierLabel: `NPE-2 · ${t.klass}`,
      capacityValue: t.klass,
      equipmentKind: "other",
      matchKey: "wh-npe2",
      installFuel: "gas",
      installPower: "plug_nearby",
      installMount: "wall",
      installCommunicating: false,
      ventStyle: "direct_vent",
      dimensions: navienNpe2Dims(),
      benefits: [
        `Navien ${t.model} — ${t.klass}k class`,
        "PVC vent / condensate",
        "Natural gas only on this quote",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        `1. Remove existing heater.\n2. Set Navien ${t.model}; gas, water, PVC vent, condensate.\n3. Commission and train owner.`,
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosElec: { gal: number; sku: string; model: string; price: number; mat: number; hours: number }[] = [
    { gal: 30, sku: "AOS-E-30", model: "Signature Electric 30", price: 1380, mat: 420, hours: 2.5 },
    { gal: 40, sku: "AOS-E-40", model: "Signature Electric 40", price: 1499, mat: 490, hours: 2.75 },
    { gal: 50, sku: "AOS-E-50", model: "Signature Electric 50", price: 1649, mat: 560, hours: 3 },
    { gal: 80, sku: "AOS-E-80", model: "Signature Electric 80", price: 1980, mat: 720, hours: 3.25 },
  ];
  for (const t of aosElec) {
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: `A. O. Smith ${t.model} Gallon Electric Tank`,
      sku: t.sku,
      category: "Water heating · AO Smith",
      description:
        `A. O. Smith ${t.gal}-gallon electric storage tank. No venting. 240V. Not a heat pump.`,
      unitPrice: t.price,
      unit: "each",
      materialCost: t.mat,
      laborHours: t.hours,
      familyId: "water_heater",
      tier: 1,
      tierLabel: `${t.gal} gal electric`,
      capacityValue: t.gal,
      equipmentKind: "other",
      matchKey: `wh-elec-${t.gal}`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "tank",
      installEcosystem: "none",
      installCommunicating: false,
      benefits: [
        `${t.gal}-gallon electric storage`,
        "No flue — electric elements",
        "240V dedicated circuit",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm 240V circuit and tank path.\n" +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set electric tank; water, power, T&P, strap.\n" +
        "4. Set temperature; owner orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosTl: {
    sku: string;
    model: string;
    klass: number;
    price: number;
    mat: number;
    hours: number;
    line: string;
  }[] = [
    { sku: "AOS-ADAPT-160", model: "Adapt+ 160", klass: 160, price: 2890, mat: 1320, hours: 5, line: "ProLine XE Adapt+" },
    { sku: "AOS-ADAPT-180", model: "Adapt+ 180", klass: 180, price: 3180, mat: 1480, hours: 5, line: "ProLine XE Adapt+" },
    { sku: "AOS-ADAPT-199", model: "Adapt+ 199", klass: 199, price: 3480, mat: 1680, hours: 5.25, line: "ProLine XE Adapt+" },
    { sku: "AOS-SIG-TL-160", model: "Signature 160", klass: 160, price: 3040, mat: 1420, hours: 5, line: "Signature tankless" },
    { sku: "AOS-SIG-TL-180", model: "Signature 180", klass: 180, price: 3340, mat: 1580, hours: 5, line: "Signature tankless" },
    { sku: "AOS-SIG-TL-199", model: "Signature 199", klass: 199, price: 3640, mat: 1780, hours: 5.25, line: "Signature tankless" },
  ];
  for (const t of aosTl) {
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: `A. O. Smith ${t.model} Tankless Water Heater`,
      sku: t.sku,
      category: `Water heating · AO Smith ${t.line}`,
      description:
        `A. O. Smith ${t.line} condensing tankless, ${t.klass}k class. UEF 0.95. PVC vent. Natural gas only. No LP.`,
      unitPrice: t.price,
      unit: "each",
      materialCost: t.mat,
      laborHours: t.hours,
      familyId: "water_heater",
      tier: t.klass >= 199 ? 3 : 2,
      tierLabel: `${t.line} · ${t.klass}k`,
      capacityValue: t.klass,
      equipmentKind: "other",
      matchKey: "wh-aos-tl",
      installFuel: "gas",
      installPower: "plug_nearby",
      installMount: "wall",
      installFootprint: "tankless",
      installEcosystem: "none",
      installCommunicating: false,
      ventStyle: "direct_vent",
      dimensions: navienNpe2Dims(),
      benefits: [
        `A. O. Smith ${t.model} — ${t.klass}k class`,
        `${t.line} · PVC vent / condensate`,
        "Natural gas only on this quote",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        `1. Remove existing heater.\n2. Set A. O. Smith ${t.model}; gas, water, PVC vent, condensate.\n3. Commission and train owner.`,
      createdAt: now,
      updatedAt: now,
    });
  }

  const sandenSplits: {
    gal: number;
    sku: string;
    tank: string;
    price: number;
    mat: number;
    hours: number;
    fhr: number;
    uef: string;
  }[] = [
    { gal: 43, sku: "SAN-GS5-43", tank: "ECO-43SSAQB", price: 8920, mat: 6025, hours: 10, fhr: 69, uef: "3.66" },
    { gal: 83, sku: "SAN-GS5-83", tank: "ECO-83SSAQB", price: 9780, mat: 6550, hours: 11, fhr: 121, uef: "3.80" },
    { gal: 119, sku: "SAN-GS5-119", tank: "SAN-119GLBK", price: 10940, mat: 7390, hours: 12, fhr: 134, uef: "3.72" },
  ];
  for (const s of sandenSplits) {
    out.push({
      id: "prod_" + s.sku.toLowerCase(),
      name: `Sanden SANCO2 ${s.gal} gal split heat pump water heater`,
      sku: s.sku,
      category: "Water heating · Sanden SANCO2",
      description:
        `Sanden SANCO2 split: GS5 outdoor CO2 heat pump + ${s.gal}-gal tank (${s.tank}). ` +
        `Water lines (not refrigerant) between outdoor unit and tank. 15A 208–230V at outdoor only.`,
      unitPrice: s.price,
      unit: "each",
      materialCost: s.mat,
      laborHours: s.hours,
      familyId: "water_heater",
      tier: 3,
      tierLabel: `Sanden ${s.gal} gal`,
      capacityValue: s.gal,
      equipmentKind: "other",
      matchKey: `wh-sanden-${s.gal}`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "hpwh",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: hpwhDims(s.gal),
      soundDb: 37,
      benefits: [
        `Sanden SANCO2 · ${s.gal} gal tank + outdoor unit`,
        `UEF ${s.uef} · first hour ~${s.fhr} gal · ~37 dBA`,
        "CO2 refrigerant · works in cold weather · no backup element",
        "Wi-Fi / app control included with this generation",
        "Bigger tank holds more hot water and recovers faster for the home",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Set outdoor SANCO2 heat pump on pad (or approved mount); 15A 208–230V circuit.\n" +
        "2. Set storage tank (closet OK — no tank airflow).\n" +
        "3. Run insulated 1/2\" water lines tank ↔ outdoor (stay within 66 ft / 23 ft vertical / 6 bends).\n" +
        "4. Thermistor cable, mixing valve, T&P, seismic as required; commission.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosVoltex: { gal: number; sku: string; model: string; price: number; mat: number; hours: number }[] = [
    { gal: 40, sku: "AOS-VOLTEX-40", model: "ProLine XE Voltex 40", price: 3780, mat: 1720, hours: 5.75 },
    { gal: 50, sku: "AOS-VOLTEX-50", model: "ProLine XE Voltex 50", price: 3980, mat: 1860, hours: 6 },
    { gal: 66, sku: "AOS-VOLTEX-66", model: "ProLine XE Voltex 66", price: 4340, mat: 2060, hours: 6.25 },
    { gal: 80, sku: "AOS-VOLTEX-80", model: "ProLine XE Voltex 80", price: 4720, mat: 2260, hours: 6.5 },
  ];
  for (const h of aosVoltex) {
    out.push({
      id: "prod_" + h.sku.toLowerCase(),
      name: `A. O. Smith ${h.model} Heat Pump Water Heater`,
      sku: h.sku,
      category: "Water heating · AO Smith Voltex",
      description:
        `A. O. Smith Voltex ${h.gal}-gallon hybrid heat pump water heater (trade / ProLine XE). ` +
        `240V dedicated circuit. West Coast / CA incentive path. Not Sanden. Not 120V.`,
      unitPrice: h.price,
      unit: "each",
      materialCost: h.mat,
      laborHours: h.hours,
      familyId: "aos-hpwh",
      tier: 2,
      tierLabel: `Voltex ${h.gal} gal`,
      capacityValue: h.gal,
      equipmentKind: "other",
      matchKey: `wh-hpwh-${h.gal}`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "hpwh",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: hpwhDims(h.gal),
      soundDb: 49,
      benefits: [
        `A. O. Smith Voltex · ${h.gal} gallon · 240V`,
        h.gal >= 80
          ? "UEF ~3.7 · first-hour ~100 gal class · ~50 dBA"
          : h.gal >= 66
            ? "UEF ~3.5 · first-hour ~90 gal class · ~49 dBA"
            : "UEF ~3.5 · first-hour ~70 gal class · ~49 dBA",
        "Trade Voltex line — hybrid / boost modes",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm 240V circuit, condensate, and airflow clearances for A. O. Smith Voltex.\n" +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set Voltex hybrid tank; water, electrical, condensate, seismic strap.\n" +
        "4. Commission modes; set temperature; homeowner recovery orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const aosSig: { gal: number; sku: string; model: string; price: number; mat: number; hours: number }[] = [
    { gal: 40, sku: "AOS-HPWH-40", model: "Signature 900 40", price: 3920, mat: 1840, hours: 6 },
    { gal: 50, sku: "AOS-HPWH-50", model: "Signature 900 50", price: 4120, mat: 1980, hours: 6.25 },
    { gal: 66, sku: "AOS-HPWH-66", model: "Signature 900 66", price: 4480, mat: 2180, hours: 6.5 },
    { gal: 80, sku: "AOS-HPWH-80", model: "Signature 900 80", price: 4890, mat: 2380, hours: 6.75 },
  ];
  for (const h of aosSig) {
    out.push({
      id: "prod_" + h.sku.toLowerCase(),
      name: `A. O. Smith ${h.model} Heat Pump Water Heater`,
      sku: h.sku,
      category: "Water heating · AO Smith Signature 900",
      description:
        `A. O. Smith Signature 900 ${h.gal}-gallon smart hybrid heat pump water heater. ` +
        `Leak detection. 240V dedicated circuit. West Coast / CA incentive path. Not Sanden. Not 120V.`,
      unitPrice: h.price,
      unit: "each",
      materialCost: h.mat,
      laborHours: h.hours,
      familyId: "aos-hpwh",
      tier: 3,
      tierLabel: `Signature 900 · ${h.gal} gal`,
      capacityValue: h.gal,
      equipmentKind: "other",
      matchKey: `wh-hpwh-${h.gal}`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "hpwh",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: hpwhDims(h.gal),
      soundDb: 49,
      benefits: [
        `A. O. Smith Signature 900 · ${h.gal} gallon · 240V`,
        h.gal >= 80
          ? "UEF ~3.7 · first-hour ~100 gal class · ~50 dBA"
          : h.gal >= 66
            ? "UEF ~3.5 · first-hour ~90 gal class · ~49 dBA"
            : "UEF ~3.5 · first-hour ~70 gal class · ~49 dBA",
        "Leak detection and auto shut-off",
        "Hybrid / boost modes",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm 240V circuit, condensate, and airflow clearances for A. O. Smith Signature 900.\n" +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set Signature 900 hybrid tank; water, electrical, condensate, seismic strap.\n" +
        "4. Commission modes; set temperature; homeowner recovery orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  const navienHpwh: { gal: number; sku: string; model: string; price: number; mat: number; hours: number; uef: string; fhr: string }[] = [
    { gal: 50, sku: "NAV-NWP-50", model: "NWP500-50", price: 4290, mat: 2120, hours: 6.25, uef: "3.85", fhr: "65" },
    { gal: 65, sku: "NAV-NWP-65", model: "NWP500-65", price: 4590, mat: 2320, hours: 6.5, uef: "4.03", fhr: "80" },
    { gal: 80, sku: "NAV-NWP-80", model: "NWP500-80", price: 4990, mat: 2520, hours: 6.75, uef: "4.05", fhr: "85" },
  ];
  for (const h of navienHpwh) {
    out.push({
      id: "prod_" + h.sku.toLowerCase(),
      name: `Navien ${h.model} Heat Pump Water Heater`,
      sku: h.sku,
      category: "Water heating · Navien NWP500",
      description:
        `Navien NWP500 ${h.gal}-gallon stainless-steel hybrid heat pump water heater. ` +
        `208–240V / 30A. Built-in Wi-Fi. Not Sanden. Not 120V.`,
      unitPrice: h.price,
      unit: "each",
      materialCost: h.mat,
      laborHours: h.hours,
      familyId: "water_heater",
      tier: 3,
      tierLabel: `NWP500 · ${h.gal} gal`,
      capacityValue: h.gal,
      equipmentKind: "other",
      matchKey: `wh-hpwh-${h.gal}`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "either",
      installFootprint: "hpwh",
      installCommunicating: false,
      dimensions: navienNwpDims(h.gal),
      soundDb: 45,
      benefits: [
        `Navien ${h.model} · ${h.gal} gallon · 240V`,
        `UEF ${h.uef} · first-hour ${h.fhr} gal · stainless tank`,
        "Built-in Wi-Fi / EcoPort",
        "Hybrid and electric modes",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        `1. Confirm 240V / 30A circuit, condensate, and airflow for Navien ${h.model}.\n` +
        "2. Remove existing heater; haul / recycle as included.\n" +
        "3. Set Navien hybrid tank; water, electrical, condensate, seismic strap.\n" +
        "4. Commission modes; set temperature; homeowner recovery orientation.",
      createdAt: now,
      updatedAt: now,
    });
  }

  // —— Mitsubishi Electric US residential ——
  // Ductless M-Series (ductless measure). Communicating FAU SVZ/SUZ + PVA/PUZ
  // (heat pump + air handler measures, Communicating FAU path only).
  const mitsuDuctlessWall: {
    sku: string;
    model: string;
    ton: number;
    price: number;
    mat: number;
    hours: number;
    hyper: boolean;
    w: number;
    d: number;
    h: number;
  }[] = [
    { sku: "MIT-MSZ-GS-2", model: "MSZ-GS24NA", ton: 2, price: 5480, mat: 2680, hours: 5.25, hyper: false, w: 33.06, d: 13, h: 34.63 },
    { sku: "MIT-MSZ-FS-2", model: "MSZ-FS24NA + MUZ-FS24NAH", ton: 2, price: 6680, mat: 3420, hours: 5.75, hyper: true, w: 33.06, d: 13, h: 34.63 },
  ];
  for (const d of mitsuDuctlessWall) {
    const tLabel = String(d.ton);
    out.push({
      id: "prod_" + d.sku.toLowerCase(),
      name: d.hyper
        ? `Mitsubishi ${d.model} Hyper-Heating Wall (${tLabel} ton)`
        : `Mitsubishi ${d.model} Ductless Wall (${tLabel} ton)`,
      sku: d.sku,
      category: "Ductless · Mitsubishi M-Series",
      description:
        `Mitsubishi Electric M-Series high-wall ductless heat pump, ${tLabel} ton class. ` +
        (d.hyper
          ? "H2i Hyper-Heating outdoor — holds capacity in cold weather. "
          : "Standard M-Series inverter wall. ") +
        "Outdoor-powered indoor (communicating interconnect). Not a 24-volt split.",
      unitPrice: d.price,
      unit: "system",
      materialCost: d.mat,
      laborHours: d.hours,
      familyId: "mitsu-ductless-wall",
      tier: d.hyper ? 2 : 1,
      tierLabel: (d.hyper ? "M-Series Hyper-Heating wall" : "M-Series wall") + ` · ${tLabel} ton`,
      equipmentKind: "ductless",
      matchKey: `${tLabel}ton-hp`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "pad",
      installFootprint: "mini_outdoor",
      installEcosystem: "none",
      installCommunicating: true,
      dimensions: { widthIn: d.w, depthIn: d.d, heightIn: d.h },
      seer2: d.hyper ? 21.0 : 18.0,
      hspf2: d.hyper ? 10.0 : 8.8,
      soundDb: d.hyper ? 52 : 54,
      benefits: [
        "M-Series high-wall — no ductwork required",
        d.hyper ? "H2i Hyper-Heating — strong heat when it is cold" : "Inverter heat and cool",
        "Indoor is powered from the outdoor (communicating interconnect)",
        "Quiet bedroom / living-room head",
        `${tLabel}-ton capacity class`,
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Mount Mitsubishi indoor head; route line set, interconnect, and condensate.\n" +
        "2. Set outdoor on pad; flare or braze per Mitsubishi procedure.\n" +
        "3. Vacuum, charge, and commission heat/cool.\n" +
        "4. Pair remote / kumo cloud if used; owner orientation.",
      productInfoUrl: "https://www.mitsubishicomfort.com/products",
      createdAt: now,
      updatedAt: now,
    });
  }

  const mxz: {
    sku: string;
    zones: number;
    ton: number;
    price: number;
    mat: number;
    hours: number;
    w: number;
    d: number;
    h: number;
  }[] = [
    { sku: "MIT-MXZ-2Z", zones: 2, ton: 2, price: 8420, mat: 4280, hours: 8, w: 33.06, d: 13, h: 28 },
    { sku: "MIT-MXZ-3Z", zones: 3, ton: 3, price: 9980, mat: 5180, hours: 10, w: 37.4, d: 13, h: 31.34 },
    { sku: "MIT-MXZ-4Z", zones: 4, ton: 3.5, price: 11640, mat: 6120, hours: 12, w: 37.4, d: 13, h: 52.69 },
    { sku: "MIT-MXZ-5Z", zones: 5, ton: 4, price: 13480, mat: 7180, hours: 14, w: 37.4, d: 13, h: 52.69 },
  ];
  for (const z of mxz) {
    const tLabel = String(z.ton);
    out.push({
      id: "prod_" + z.sku.toLowerCase(),
      name: `Mitsubishi MXZ ${z.zones}-Zone Ductless System`,
      sku: z.sku,
      category: "Ductless · Mitsubishi multi-zone",
      description:
        `Mitsubishi Electric MXZ multi-zone outdoor for up to ${z.zones} indoor heads ` +
        `(~${tLabel} ton combined). M-Series heads (wall, cassette, slim duct). ` +
        "List each head location on the measure. Communicating interconnect — not 24-volt.",
      unitPrice: z.price,
      unit: "system",
      materialCost: z.mat,
      laborHours: z.hours,
      familyId: "mitsu-ductless-mxz",
      tier: 2,
      tierLabel: `MXZ ${z.zones}-zone · ~${tLabel} ton`,
      equipmentKind: "ductless",
      matchKey: `${tLabel}ton-hp`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "pad",
      installFootprint: "mini_outdoor",
      installEcosystem: "none",
      installCommunicating: true,
      dimensions: { widthIn: z.w, depthIn: z.d, heightIn: z.h },
      seer2: 19.0,
      hspf2: 9.4,
      soundDb: 54,
      benefits: [
        `One outdoor serves up to ${z.zones} indoor heads`,
        "Room-by-room comfort — M-Series mix of wall / cassette / slim duct",
        "Communicating interconnect — outdoor powers the heads",
        "List each head location on this measure",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Confirm MXZ design and each indoor head location with the homeowner.\n" +
        "2. Mount heads; route branch line sets, interconnect, and drains.\n" +
        "3. Set MXZ outdoor on pad; vacuum and charge per Mitsubishi multi-zone procedure.\n" +
        "4. Commission every zone; label controllers; owner walk-through.\n" +
        "INDOOR HEAD LOCATIONS: (comfort advisor lists rooms on this measure)",
      productInfoUrl: "https://www.mitsubishicomfort.com/products",
      createdAt: now,
      updatedAt: now,
    });
  }

  // Communicating FAU — SVZ + SUZ (2–3 ton) and PVA + PUZ (3.5–5 nearest)
  const fauPairs: {
    ton: number;
    odSku: string;
    odModel: string;
    odPrice: number;
    odMat: number;
    odHours: number;
    ahSku: string;
    ahModel: string;
    ahPrice: number;
    ahMat: number;
    ahHours: number;
    line: "SVZ" | "PVA";
    odW: number;
    odD: number;
    odH: number;
    ahW: number;
    ahD: number;
    ahH: number;
  }[] = [
    {
      ton: 2,
      odSku: "MIT-SUZ-2",
      odModel: "SUZ-KA24NAHZ",
      odPrice: 6280,
      odMat: 3180,
      odHours: 4.2,
      ahSku: "MIT-SVZ-2",
      ahModel: "SVZ-KP24NA",
      ahPrice: 3480,
      ahMat: 1680,
      ahHours: 3.4,
      line: "SVZ",
      odW: 37.4,
      odD: 13,
      odH: 37.13,
      ahW: 17,
      ahD: 21.63,
      ahH: 39.75,
    },
    {
      ton: 2.5,
      odSku: "MIT-SUZ-2P5",
      odModel: "SUZ-KA30NAHZ",
      odPrice: 6780,
      odMat: 3420,
      odHours: 4.4,
      ahSku: "MIT-SVZ-2P5",
      ahModel: "SVZ-KP30NA",
      ahPrice: 3720,
      ahMat: 1780,
      ahHours: 3.5,
      line: "SVZ",
      odW: 37.4,
      odD: 13,
      odH: 37.13,
      ahW: 17,
      ahD: 21.63,
      ahH: 43.75,
    },
    {
      ton: 3,
      odSku: "MIT-SUZ-3",
      odModel: "SUZ-KA36NAHZ",
      odPrice: 7320,
      odMat: 3680,
      odHours: 4.6,
      ahSku: "MIT-SVZ-3",
      ahModel: "SVZ-KP36NA",
      ahPrice: 3980,
      ahMat: 1920,
      ahHours: 3.7,
      line: "SVZ",
      odW: 37.4,
      odD: 13,
      odH: 37.13,
      ahW: 17,
      ahD: 21.63,
      ahH: 47.63,
    },
    {
      ton: 3.5,
      odSku: "MIT-PUZ-3P5",
      odModel: "PUZ-HA36NHA",
      odPrice: 8120,
      odMat: 4120,
      odHours: 4.8,
      ahSku: "MIT-PVA-3P5",
      ahModel: "PVA-A36AA",
      ahPrice: 4280,
      ahMat: 2080,
      ahHours: 3.9,
      line: "PVA",
      odW: 37.4,
      odD: 13,
      odH: 37.13,
      ahW: 21,
      ahD: 21.63,
      ahH: 54.25,
    },
    {
      ton: 4,
      odSku: "MIT-PUZ-4",
      odModel: "PUZ-HA42NHA",
      odPrice: 8780,
      odMat: 4480,
      odHours: 5.1,
      ahSku: "MIT-PVA-4",
      ahModel: "PVA-A42AA",
      ahPrice: 4620,
      ahMat: 2240,
      ahHours: 4.1,
      line: "PVA",
      odW: 41.38,
      odD: 14.19,
      odH: 52.69,
      ahW: 25,
      ahD: 21.63,
      ahH: 59.5,
    },
    {
      ton: 5,
      odSku: "MIT-PUZ-5",
      odModel: "PUZ-HA42NHA (nearest 4-ton class)",
      odPrice: 9180,
      odMat: 4680,
      odHours: 5.3,
      ahSku: "MIT-PVA-5",
      ahModel: "PVA-A42AA (nearest 4-ton class)",
      ahPrice: 4780,
      ahMat: 2320,
      ahHours: 4.2,
      line: "PVA",
      odW: 41.38,
      odD: 14.19,
      odH: 52.69,
      ahW: 25,
      ahD: 21.63,
      ahH: 59.5,
    },
  ];
  for (const r of fauPairs) {
    const tLabel = String(r.ton);
    const slug = String(r.ton).replace(".", "p");
    const series = r.line === "SVZ" ? "M-Series SVZ / SUZ" : "P-Series PVA / PUZ";
    out.push({
      id: "prod_" + r.odSku.toLowerCase(),
      name: `Mitsubishi ${r.odModel} Heat Pump (${tLabel} ton)`,
      sku: r.odSku,
      category: "Heat pump · Mitsubishi",
      description:
        `${tLabel}-ton Mitsubishi Electric ${series} outdoor. ` +
        `Communicating FAU — outdoor powers the indoor air handler (interconnect). ` +
        `Not a 24-volt American split. Pair with matched ${r.ahModel}.`,
      unitPrice: r.odPrice,
      unit: "each",
      materialCost: r.odMat,
      laborHours: r.odHours,
      familyId: "mitsu-fau-hp-" + slug,
      tier: r.line === "PVA" ? 3 : 2,
      tierLabel: `${series} outdoor · ${tLabel} ton`,
      equipmentKind: "heat_pump",
      matchKey: `${tLabel}ton-hp`,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "pad",
      installFootprint: r.line === "SVZ" ? "mini_outdoor" : "side_discharge",
      installEcosystem: "none",
      installCommunicating: true,
      dimensions: { widthIn: r.odW, depthIn: r.odD, heightIn: r.odH },
      seer2: r.line === "SVZ" ? 18.0 : 17.5,
      hspf2: 9.6,
      soundDb: r.line === "SVZ" ? 54 : 52,
      benefits: [
        `${series} communicating outdoor — side-discharge (not a cube condenser)`,
        "Indoor air handler is powered from this outdoor (not 24-volt)",
        "H2i-class cold-weather heat",
        `Pair with Mitsubishi ${r.ahModel} air handler`,
        `${tLabel}-ton capacity class`,
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Recover existing refrigerant if replacing; set Mitsubishi outdoor on pad.\n" +
        "2. Run line set + interconnect to the matched SVZ / PVA air handler.\n" +
        "3. Vacuum, charge, and commission per Mitsubishi procedure.\n" +
        "4. Owner orientation on communicating FAU heat pump.",
      productInfoUrl: "https://www.mitsubishicomfort.com/products",
      createdAt: now,
      updatedAt: now,
    });
    out.push({
      id: "prod_" + r.ahSku.toLowerCase(),
      name: `Mitsubishi ${r.ahModel} Air Handler (${tLabel} ton)`,
      sku: r.ahSku,
      category: "Air handler · Mitsubishi",
      description:
        `${tLabel}-ton Mitsubishi Electric ${r.ahModel} multi-position air handler. ` +
        `Communicating FAU — powered from the matched outdoor (${r.odModel}). ` +
        `Not a 24-volt fan coil. Fits existing duct systems.`,
      unitPrice: r.ahPrice,
      unit: "each",
      materialCost: r.ahMat,
      laborHours: r.ahHours,
      familyId: "mitsu-fau-ah-" + slug,
      tier: r.line === "PVA" ? 3 : 2,
      tierLabel: `${r.line} air handler · ${tLabel} ton`,
      equipmentKind: "air_handler",
      matchKey: `${tLabel}ton-ah`,
      installFuel: "n/a",
      installPower: "from_outdoor_shared",
      installMount: "either",
      installFootprint: "side_discharge",
      installEcosystem: "none",
      installCommunicating: true,
      dimensions: { widthIn: r.ahW, depthIn: r.ahD, heightIn: r.ahH },
      benefits: [
        "Communicating FAU — outdoor powers this air handler",
        `Matched to Mitsubishi ${r.odModel}`,
        "Multi-position — attic, closet, or basement ducts",
        "Not a 24-volt American air handler",
        `${tLabel}-ton airflow class`,
      ],
      options: [],
      imageUrl: ART,
      workScope:
        "1. Set Mitsubishi air handler in the sold location; transitions and condensate.\n" +
        "2. Connect line set and interconnect from the matched outdoor.\n" +
        "3. Commission airflow with outdoor; no separate indoor circuit if outdoor-powered.\n" +
        "4. Owner orientation on filter access.",
      productInfoUrl: "https://www.mitsubishicomfort.com/products",
      createdAt: now,
      updatedAt: now,
    });
  }

  const smalls: {
    sku: string;
    name: string;
    category: string;
    familyId: string;
    price: number;
    mat: number;
    hours: number;
    desc: string;
    benefits: string[];
    scope: string;
    url?: string;
    img?: string;
    dims?: { widthIn: number; depthIn: number; heightIn: number };
  }[] = [
    {
      sku: "HUM-HW-HE240",
      name: "Honeywell HE240A Bypass Humidifier (to 3,000 sq ft)",
      category: "Humidifier · Honeywell",
      familyId: "humidifier",
      price: 980,
      mat: 220,
      hours: 3.5,
      desc: "Honeywell Home HE240A flow-through bypass humidifier. Home Depot stocked class. Homes to ~3,000 sq ft.",
      benefits: [
        "Bypass whole-home humidifier — uses furnace airflow",
        "Sized to about 3,000 sq ft",
        "Home Depot / trade stocked pad and parts",
        "Automatic humidistat",
      ],
      scope:
        "1. Mount Honeywell HE240A on supply or return plenum per listing.\n2. Tap water, saddle valve or saddle-free kit, and drain.\n3. Wire humidistat; set winter humidity; owner orientation.",
      url: "https://www.honeywellhome.com/",
    },
    {
      sku: "HUM-HW-HE360",
      name: "Honeywell HE360D Powered Humidifier (to 4,500 sq ft)",
      category: "Humidifier · Honeywell",
      familyId: "humidifier",
      price: 1280,
      mat: 340,
      hours: 4,
      desc: "Honeywell Home HE360D fan-powered flow-through humidifier with digital humidistat. Home Depot HE360D1075 class.",
      benefits: [
        "Fan-powered — better output than bypass on milder heat calls",
        "Sized to about 4,500 sq ft",
        "Digital humidistat included on this class",
        "Home Depot stocked",
      ],
      scope:
        "1. Mount HE360D on the plenum; 120V to the unit.\n2. Water and drain; digital humidistat.\n3. Commission output; pad-change orientation.",
      url: "https://www.homedepot.com/p/HE360D-18-Gal-Powered-Flow-Through-Whole-House-Humidifier-and-Digital-Humidistat-HE360D1075-U/326513984",
    },
    {
      sku: "HUM-HW-HM506",
      name: "Honeywell TrueSTEAM HM506 (6 gal)",
      category: "Humidifier · Honeywell",
      familyId: "humidifier",
      price: 1980,
      mat: 680,
      hours: 5,
      desc: "Honeywell TrueSTEAM electrode steam humidifier, 6 gallons/day. Independent of furnace heat call.",
      benefits: [
        "Steam — humidifies even when the furnace is not running long",
        "6 gallons/day class",
        "Automatic flush / drain",
      ],
      scope:
        "1. Mount TrueSTEAM; 120V and water per listing.\n2. Steam nozzle into the supply; drain to approved receptor.\n3. Control and flush cycle; owner orientation.",
    },
    {
      sku: "HUM-HW-HM512",
      name: "Honeywell TrueSTEAM HM512 (12 gal)",
      category: "Humidifier · Honeywell",
      familyId: "humidifier",
      price: 2480,
      mat: 920,
      hours: 5.5,
      desc: "Honeywell TrueSTEAM 12 gallons/day — larger homes.",
      benefits: [
        "Steam humidifier — 12 gallons/day class",
        "Independent of furnace run time",
        "Automatic flush",
      ],
      scope:
        "1. Mount TrueSTEAM HM512; electrical and water.\n2. Steam into supply; drain.\n3. Commission and owner orientation.",
    },
    {
      sku: "DH-HW-DR65",
      name: "Honeywell TrueDRY DR65 (65 pint)",
      category: "Dehumidifier · Honeywell",
      familyId: "dehumidifier",
      price: 3480,
      mat: 980,
      hours: 6,
      desc: "Honeywell Home TrueDRY DR65. About 65 pints/day. Homes to ~1,800 sq ft, condos, crawl spaces.",
      benefits: [
        "Whole-home dehumidification — not a portable bucket",
        "Sized to about 1,800 sq ft",
        "MERV 11 filtration on this class",
        "Ties into existing ducts or a dedicated return",
      ],
      scope:
        "1. Set Honeywell TrueDRY DR65 at the agreed location.\n2. Duct into the system or a dedicated return as scoped.\n3. 120V and condensate drain; set humidity; owner orientation.",
      url: "https://www.honeywellhome.com/collections/dehumidifiers",
    },
    {
      sku: "DH-HW-DR90",
      name: "Honeywell TrueDRY DR90 (90 pint)",
      category: "Dehumidifier · Honeywell",
      familyId: "dehumidifier",
      price: 4180,
      mat: 1280,
      hours: 7,
      desc: "Honeywell Home TrueDRY DR90. About 90 pints/day. Typical single-family to ~2,800 sq ft.",
      benefits: [
        "Whole-home dehumidification — 90 pint class",
        "Sized to about 2,800 sq ft",
        "MERV 11 filtration on this class",
        "Ties into existing ducts or a dedicated return",
      ],
      scope:
        "1. Set Honeywell TrueDRY DR90 at the agreed location.\n2. Duct into the system or a dedicated return as scoped.\n3. 120V and condensate drain; set humidity; owner orientation.",
      url: "https://www.honeywellhome.com/collections/dehumidifiers",
    },
    {
      sku: "DH-HW-DR120",
      name: "Honeywell TrueDRY DR120 (120 pint)",
      category: "Dehumidifier · Honeywell",
      familyId: "dehumidifier",
      price: 4980,
      mat: 1580,
      hours: 8,
      desc: "Honeywell Home TrueDRY DR120. About 120 pints/day. Larger homes and wet basements.",
      benefits: [
        "Whole-home dehumidification — 120 pint class",
        "For larger homes and wet basements",
        "MERV 11 filtration on this class",
        "Ties into existing ducts or a dedicated return",
      ],
      scope:
        "1. Set Honeywell TrueDRY DR120 at the agreed location.\n2. Duct into the system or a dedicated return as scoped.\n3. 120V and condensate drain; set humidity; owner orientation.",
      url: "https://www.honeywellhome.com/collections/dehumidifiers",
    },
    {
      sku: "ERV-HW-70",
      name: "Honeywell TrueFRESH energy recovery ventilator · 70 CFM class",
      category: "Ventilation · Honeywell ERV",
      familyId: "hrv",
      price: 3050,
      mat: 1080,
      hours: 8,
      desc: "Fresh air with heat and moisture recovery — the Bay Area unit. Condos and smaller homes.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors and chemicals — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new energy recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH energy recovery ventilator · 70 CFM class",
      url: "https://www.honeywellhome.com/blogs/support/truefresh-ventilation-systems-2",
    },
    {
      sku: "ERV-HW-150",
      name: "Honeywell TrueFRESH energy recovery ventilator · 150 CFM class",
      category: "Ventilation · Honeywell ERV",
      familyId: "hrv",
      price: 3720,
      mat: 1420,
      hours: 9,
      desc: "Fresh air with heat and moisture recovery for a typical Bay Area house.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors and chemicals — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new energy recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH energy recovery ventilator · 150 CFM class",
    },
    {
      sku: "ERV-HW-200",
      name: "Honeywell TrueFRESH energy recovery ventilator · 200 CFM class",
      category: "Ventilation · Honeywell ERV",
      familyId: "hrv",
      price: 4280,
      mat: 1680,
      hours: 10,
      desc: "Larger Honeywell TrueFRESH ERV for a bigger Bay Area house.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors and chemicals — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new energy recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH energy recovery ventilator · 200 CFM class",
    },
    {
      sku: "HRV-HW-70",
      name: "Honeywell TrueFRESH heat recovery ventilator · 70 CFM class",
      category: "Ventilation · Honeywell HRV",
      familyId: "hrv",
      price: 2980,
      mat: 1040,
      hours: 8,
      desc: "Fresh air with heat recovery — moisture leaves. Condos and smaller homes.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors, chemicals, and extra moisture — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new heat recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH heat recovery ventilator · 70 CFM class",
    },
    {
      sku: "HRV-HW-150",
      name: "Honeywell TrueFRESH heat recovery ventilator · 150 CFM class",
      category: "Ventilation · Honeywell HRV",
      familyId: "hrv",
      price: 3640,
      mat: 1380,
      hours: 9,
      desc: "Fresh air with heat recovery for a typical house that needs moisture to leave.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors, chemicals, and extra moisture — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new heat recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH heat recovery ventilator · 150 CFM class",
    },
    {
      sku: "HRV-HW-200",
      name: "Honeywell TrueFRESH heat recovery ventilator · 200 CFM class",
      category: "Ventilation · Honeywell HRV",
      familyId: "hrv",
      price: 4180,
      mat: 1620,
      hours: 10,
      desc: "Larger Honeywell TrueFRESH HRV for a bigger house.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors, chemicals, and extra moisture — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new heat recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH heat recovery ventilator · 200 CFM class",
    },
    {
      sku: "HRV-HW-150-PRO",
      name: "Honeywell TrueFRESH heat recovery ventilator · 150 CFM large-home",
      category: "Ventilation · Honeywell HRV",
      familyId: "hrv",
      price: 4480,
      mat: 1720,
      hours: 10,
      desc: "TrueFRESH 6150-class HRV — same 150 CFM family, built for longer duct runs on a larger home.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors, chemicals, and extra moisture — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new heat recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH heat recovery ventilator · 150 CFM large-home class",
    },
    {
      sku: "HRV-HW-200-PRO",
      name: "Honeywell TrueFRESH heat recovery ventilator · 200 CFM large-home",
      category: "Ventilation · Honeywell HRV",
      familyId: "hrv",
      price: 5120,
      mat: 1980,
      hours: 11,
      desc: "TrueFRESH 6200-class HRV — 200 CFM for a large home with long dedicated ducts.",
      benefits: [
        "Sized to this home so fresh air matches the living space.",
        "Honeywell TrueFRESH recovers heat so you are not throwing conditioned air outside.",
        "Stale indoor air — odors, chemicals, and extra moisture — leaves the house.",
        "Honeywell limited parts warranty. Acme HVAC 3-year labor on the install.",
      ],
      scope:
        "Acme HVAC will install a new heat recovery ventilator to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nHoneywell TrueFRESH heat recovery ventilator · 200 CFM large-home class",
    },
    {
      sku: "LAD-WRN-AH2210B",
      name: "Werner AH2210B Aluminum Attic Ladder (22.5 × 54, 8–10 ft)",
      category: "Access · Home Depot",
      familyId: "attic_ladder",
      price: 890,
      mat: 189,
      hours: 3.5,
      desc: "Werner AH2210B aluminum pull-down attic ladder. Home Depot stocked. 375 lb. Fits 22.5 × 54 opening, 8–10 ft ceilings.",
      benefits: [
        "Home Depot stocked Werner aluminum ladder",
        "375 lb duty rating",
        "Standard 22.5 × 54 rough opening",
      ],
      scope:
        "1. Confirm joist layout and ceiling height for AH2210B.\n2. Frame opening if needed; set ladder; finish trim.\n3. Adjust springs; owner demo.",
      url: "https://www.homedepot.com/p/Werner-8-ft-10-ft-22-5-in-x-54-in-Aluminum-Attic-Ladder-with-375-lb-Maximum-Load-Capacity-AH2210B/203009107",
    },
    {
      sku: "LAD-WRN-AH2510B",
      name: "Werner AH2510B Extra-Wide Attic Ladder (25 × 54, 8–10 ft)",
      category: "Access · Home Depot",
      familyId: "attic_ladder",
      price: 980,
      mat: 229,
      hours: 3.75,
      desc: "Werner AH2510B extra-wide aluminum attic ladder. Home Depot. 25 × 54 opening.",
      benefits: [
        "Extra-wide 25 × 54 opening — easier equipment path",
        "375 lb aluminum",
        "Home Depot stocked",
      ],
      scope:
        "1. Frame 25 × 54 opening; set AH2510B.\n2. Trim and spring adjust; owner demo.",
      url: "https://www.homedepot.com/p/Werner-8-ft-10-ft-25-in-x-54-in-Aluminum-Attic-Ladder-with-375-lb-Maximum-Load-Capacity-AH2510B/203009110",
    },
    {
      sku: "PLAT-ATTIC-4X8",
      name: "Elevated attic service platform (4 × 8)",
      category: "Access · Attic platform",
      familyId: "attic_platform",
      price: 980,
      mat: 220,
      hours: 4.5,
      desc: "Plywood service platform spanning joists at the equipment. Safer future visits; protects ceiling drywall.",
      benefits: [
        "Standing area at the air handler / furnace",
        "Protects drywall under the work path",
        "Sized to this equipment footprint",
      ],
      scope:
        "1. Span joists with framed platform under / beside equipment.\n2. Secure 3/4\" plywood; walk boards from access.\n3. Photo-document for the homeowner.",
    },
    {
      sku: "PLAT-ATTIC-WALK",
      name: "Attic walk boards to equipment",
      category: "Access · Attic platform",
      familyId: "attic_platform",
      price: 720,
      mat: 160,
      hours: 3,
      desc: "Walk boards from attic access to equipment when a full platform is not needed.",
      benefits: [
        "Safe path from hatch to equipment",
        "Faster than a full platform",
      ],
      scope:
        "1. Run fastened walk boards from access to equipment.\n2. Secure; leave path clear.",
    },
    {
      sku: "EV-CP-FLEX",
      name: "ChargePoint Home Flex Level 2 (up to 50A)",
      category: "Electrical · EV charger",
      familyId: "ev_charger",
      price: 2480,
      mat: 699,
      hours: 7,
      desc: "ChargePoint Home Flex hardwired Level 2 EVSE, field-set up to 50A. Permit and circuit included in this quote class.",
      benefits: [
        "Level 2 home charging",
        "Hardwired up to 50A (set to panel capacity)",
        "App scheduling",
      ],
      scope:
        "1. Confirm panel capacity and parking location.\n2. Pull dedicated circuit; mount Home Flex; permit as required.\n3. Commission amperage; owner app setup.",
    },
    {
      sku: "EV-1450",
      name: "NEMA 14-50 receptacle for portable EVSE",
      category: "Electrical · EV charger",
      familyId: "ev_charger",
      price: 890,
      mat: 85,
      hours: 3.5,
      desc: "New 50A 14-50 receptacle for owner-supplied portable charger. Circuit and box included.",
      benefits: [
        "Works with most portable Level 2 cords",
        "Owner supplies the portable EVSE",
      ],
      scope:
        "1. Dedicated 50A circuit to parking location.\n2. Install NEMA 14-50; label; test.",
    },
    {
      sku: "FLUE-BV-4",
      name: "Type B vent flue — 4 inch",
      category: "Vent · Type B",
      familyId: "flue",
      price: 920,
      mat: 180,
      hours: 3.5,
      desc: "Type B double-wall gas vent, 4 inch. AmeriVent / Hart & Cooley class. Natural-gas appliances only.",
      benefits: [
        "Type B double-wall gas vent",
        "4-inch class — water heaters / small furnaces",
        "Listed fittings and termination",
      ],
      scope:
        "1. Size and route 4\" Type B per appliance listing and code.\n2. Support, firestop, and terminate with listed cap.\n3. Draft check.",
    },
    {
      sku: "FLUE-BV-5",
      name: "Type B vent flue — 5 inch",
      category: "Vent · Type B",
      familyId: "flue",
      price: 1080,
      mat: 240,
      hours: 4,
      desc: "Type B gas vent, 5 inch.",
      benefits: ["Type B 5-inch class", "Listed fittings and cap"],
      scope:
        "1. Route 5\" Type B; firestop and terminate.\n2. Draft check.",
    },
    {
      sku: "FLUE-BV-6",
      name: "Type B vent flue — 6 inch",
      category: "Vent · Type B",
      familyId: "flue",
      price: 1280,
      mat: 310,
      hours: 4.5,
      desc: "Type B gas vent, 6 inch — larger furnaces / water heaters.",
      benefits: ["Type B 6-inch class", "Listed fittings and cap"],
      scope:
        "1. Route 6\" Type B; firestop and terminate.\n2. Draft check.",
    },
    {
      sku: "HOOD-OWNER",
      name: "Range hood installation — hood supplied by owner",
      category: "Kitchen · Hood",
      familyId: "range_hood",
      price: 980,
      mat: 85,
      hours: 4.5,
      desc: "Install owner-supplied range hood. Duct, damper, and makeup-air note as required. Hood itself is not in this price.",
      benefits: [
        "You buy the hood — we install it",
        "Duct to outdoors with damper",
        "Makeup air called out if the hood requires it",
      ],
      scope:
        "1. Confirm owner hood model, width, and duct size before install day.\n2. Hang hood; duct to exterior with backdraft damper.\n3. Electrical connection; test. Makeup air by others unless added.",
    },
    {
      sku: "VENT-SOFFIT",
      name: "Attic ventilation — soffit + ridge package",
      category: "Attic · Ventilation",
      familyId: "attic_vent",
      price: 980,
      mat: 220,
      hours: 4,
      desc: "Balanced soffit intake and ridge exhaust for the attic. Passive — no power vent.",
      benefits: [
        "Balanced intake and exhaust",
        "No powered fan to fail",
        "Helps attic temperature and moisture",
      ],
      scope:
        "1. Calculate net-free area; add soffit and ridge vents.\n2. Baffle insulation at eaves.\n3. Owner orientation.",
    },
    {
      sku: "VENT-GABLE",
      name: "Broan 35316-class powered gable attic vent",
      category: "Attic · Ventilation",
      familyId: "attic_vent",
      price: 920,
      mat: 280,
      hours: 3.5,
      desc: "Powered gable-mount attic ventilator, Broan 35316 class. Thermostat control.",
      benefits: [
        "Powered attic exhaust",
        "Broan trade / Ferguson class",
        "Thermostat cycling",
      ],
      scope:
        "1. Cut gable opening; mount fan and shutter.\n2. Thermostat / humidistat; 120V.\n3. Confirm intake path exists.",
    },
    {
      sku: "FAN-PANA-VKS3",
      name: "Panasonic WhisperGreen Select 50–110 CFM bath fan",
      category: "Bath · Panasonic",
      familyId: "bath_fan",
      price: 890,
      mat: 198,
      hours: 2.75,
      url: "https://iaq.na.panasonic.com/ventilation/fans",
      img: "/product-photos/fan-pana-vks3.png",
      dims: { widthIn: 10.25, depthIn: 10.25, heightIn: 7.375 },
      desc: "Panasonic WhisperGreen Select. Set 50, 80, or 110 CFM. Modular — moisture, motion, Wi-Fi, and multi-speed plug in. ENERGY STAR DC motor.",
      benefits: [
        "Set the airflow for this bathroom — 50, 80, or 110 CFM",
        "Add a moisture or motion module later if you want it",
        "Whisper-quiet ENERGY STAR DC motor",
        "Panasonic 6-year DC motor / 3-year parts warranty",
        "Acme HVAC 3-year labor warranty",
      ],
      scope:
        "1. Remove the existing fan as needed.\n2. Install the new WhisperGreen Select to manufacturer and local code requirements.\n3. Set the airflow, connect the duct and damper, test airflow.",
    },
    {
      sku: "FAN-PANA-VKSL3",
      name: "Panasonic WhisperGreen Select LED 50–110 CFM bath fan",
      category: "Bath · Panasonic",
      familyId: "bath_fan",
      price: 1040,
      mat: 258,
      hours: 3,
      url: "https://iaq.na.panasonic.com/ventilation/fans",
      img: "/product-photos/fan-pana-vksl3.png",
      dims: { widthIn: 10.25, depthIn: 10.25, heightIn: 7.375 },
      desc: "WhisperGreen Select with integrated LED (selectable color). Set 50, 80, or 110 CFM. Light is built in — not a plug-in module.",
      benefits: [
        "Set the airflow for this bathroom — 50, 80, or 110 CFM — plus a built-in LED",
        "Selectable LED color to match the vanity light",
        "Light is in the fan — no extra can in the ceiling",
        "Whisper-quiet ENERGY STAR DC motor",
        "Panasonic 6-year DC motor / 3-year parts warranty",
        "Acme HVAC 3-year labor warranty",
      ],
      scope:
        "1. Remove the existing fan as needed.\n2. Install the new WhisperGreen Select LED to manufacturer and local code requirements.\n3. Set CFM and light, connect duct and damper, test airflow and light.",
    },
    {
      sku: "FAN-PANA-WC80",
      name: "Panasonic WhisperCeiling 80 CFM bath fan",
      category: "Bath · Panasonic",
      familyId: "bath_fan",
      price: 780,
      mat: 162,
      hours: 2.5,
      url: "https://iaq.na.panasonic.com/ventilation/fans",
      img: "/product-photos/fan-pana-wc80.png",
      dims: { widthIn: 10.25, depthIn: 10.25, heightIn: 7.375 },
      desc: "Panasonic WhisperCeiling 80 CFM. Clean, quiet hall-bath fan. Features are built in — no plug-in modules.",
      benefits: [
        "Quiet 80 CFM — right-sized for a typical hall bath",
        "Simple one-speed fan — no sensors to set or sell",
        "ENERGY STAR DC motor",
        "Panasonic 3-year parts warranty",
        "Acme HVAC 3-year labor warranty",
      ],
      scope:
        "1. Remove the existing fan as needed.\n2. Install the new WhisperCeiling 80 CFM to manufacturer and local code requirements.\n3. Connect duct and damper; test airflow.",
    },
    {
      sku: "FAN-PANA-WC110L",
      name: "Panasonic WhisperCeiling LED 110 CFM bath fan",
      category: "Bath · Panasonic",
      familyId: "bath_fan",
      price: 960,
      mat: 228,
      hours: 2.75,
      url: "https://iaq.na.panasonic.com/ventilation/fans",
      img: "/product-photos/fan-pana-wc110l.png",
      dims: { widthIn: 10.25, depthIn: 10.25, heightIn: 7.375 },
      desc: "WhisperCeiling 110 CFM with integrated LED. Larger baths. Features built in — no plug-in modules.",
      benefits: [
        "110 CFM — larger baths and higher ceilings",
        "Built-in LED light — one unit for air and light",
        "Very quiet ENERGY STAR DC motor",
        "Panasonic 3-year parts warranty",
        "Acme HVAC 3-year labor warranty",
      ],
      scope:
        "1. Remove the existing fan as needed.\n2. Install the new WhisperCeiling LED 110 CFM to manufacturer and local code requirements.\n3. Connect duct, damper, and light; test.",
    },
    {
      sku: "FAN-PANA-SENSE",
      name: "Panasonic WhisperSense 80–110 CFM bath fan",
      category: "Bath · Panasonic",
      familyId: "bath_fan",
      price: 1180,
      mat: 295,
      hours: 3,
      url: "https://iaq.na.panasonic.com/ventilation/fans",
      img: "/product-photos/fan-pana-sense.png",
      dims: { widthIn: 10.25, depthIn: 10.25, heightIn: 7.375 },
      desc: "WhisperSense with built-in moisture and motion sensing. Dual-speed. No plug-in modules — sensors are in the unit.",
      benefits: [
        "Built-in moisture and motion — runs when the room is used or wet",
        "Dual-speed 80 / 110 CFM — no modules to buy later",
        "Whisper-quiet ENERGY STAR DC motor",
        "Panasonic 6-year DC motor / 3-year parts warranty",
        "Acme HVAC 3-year labor warranty",
      ],
      scope:
        "1. Remove the existing fan as needed.\n2. Install the new WhisperSense to manufacturer and local code requirements.\n3. Set speeds and sensors, connect duct and damper, test auto and manual operation.",
    },
    {
      sku: "PKG-CAR-GE-36",
      name: "Carrier 3-ton gas/electric package (placeholder)",
      category: "Package · Carrier",
      familyId: "package_unit",
      price: 14880,
      mat: 6200,
      hours: 14,
      desc: "3-ton class gas heat / electric cool rooftop or grade package. Confirm model and curb before we go live.",
      benefits: [
        "One outdoor cabinet — heat and cool",
        "Typical 3-ton residential / light commercial",
        "Confirm curb, gas, and crane on site",
      ],
      scope:
        "1. Set the Carrier 3-ton gas/electric package on the agreed curb or pad.\n2. Connect ducts, gas, condensate, and power.\n3. Start, check, and set heat and cool.",
    },
    {
      sku: "PKG-CAR-GE-48",
      name: "Carrier 4-ton gas/electric package (placeholder)",
      category: "Package · Carrier",
      familyId: "package_unit",
      price: 16880,
      mat: 7100,
      hours: 15,
      desc: "4-ton class gas/electric package. Confirm model and curb before we go live.",
      benefits: [
        "One outdoor cabinet — heat and cool",
        "Typical 4-ton residential / light commercial",
        "Confirm curb, gas, and crane on site",
      ],
      scope:
        "1. Set the Carrier 4-ton gas/electric package on the agreed curb or pad.\n2. Connect ducts, gas, condensate, and power.\n3. Start, check, and set heat and cool.",
    },
    {
      sku: "PKG-CAR-HP-36",
      name: "Carrier 3-ton heat pump package (placeholder)",
      category: "Package · Carrier",
      familyId: "package_unit",
      price: 15880,
      mat: 6800,
      hours: 14,
      desc: "3-ton heat pump package. Confirm model, curb, and backup heat before we go live.",
      benefits: [
        "One outdoor cabinet — heat pump",
        "Typical 3-ton",
        "Confirm curb, electric heat, and crane on site",
      ],
      scope:
        "1. Set the Carrier 3-ton heat pump package on the agreed curb or pad.\n2. Connect ducts, condensate, and power.\n3. Start, check, and set heat and cool.",
    },
    {
      sku: "EQV-NQV-34",
      name: "Northridge QuakeValve 3/4 inch (Ferguson)",
      category: "Gas · Seismic",
      familyId: "seismic_valve",
      price: 620,
      mat: 185,
      hours: 2,
      desc: "Northridge QuakeValve 3/4\" automatic seismic gas shutoff. Ferguson stocked. Natural gas.",
      benefits: [
        "Shuts gas in a qualifying quake",
        "3/4 inch — typical residential meter/branch",
        "Ferguson stocked",
      ],
      scope:
        "1. Install QuakeValve on the gas service / branch per listing and local seismic rules.\n2. Leak-test; reset orientation for the homeowner.",
    },
    {
      sku: "EQV-NQV-1",
      name: "Northridge QuakeValve 1 inch (Ferguson)",
      category: "Gas · Seismic",
      familyId: "seismic_valve",
      price: 720,
      mat: 245,
      hours: 2.25,
      desc: "Northridge QuakeValve 1\" seismic gas shutoff. Ferguson.",
      benefits: [
        "1 inch seismic shutoff",
        "Ferguson stocked",
        "Natural gas",
      ],
      scope:
        "1. Install 1\" QuakeValve per listing.\n2. Leak-test; owner reset orientation.",
    },
    {
      sku: "EQV-LFF-34",
      name: "Little Firefighter 3/4 inch excess-flow valve (Ferguson)",
      category: "Gas · Seismic",
      familyId: "seismic_valve",
      price: 480,
      mat: 95,
      hours: 1.75,
      desc: "Little Firefighter 3/4\" excess-flow gas shutoff. Ferguson stocked. Shuts on a broken line / high flow — not a seismic sensor.",
      benefits: [
        "Shuts on a broken or blown-off line",
        "3/4 inch Ferguson stock",
        "Not a seismic sensor — different job than QuakeValve",
      ],
      scope:
        "1. Install excess-flow valve per listing.\n2. Leak-test; explain reset to the homeowner.",
    },
  ];

  for (const s of smalls) {
    out.push({
      id: "prod_" + s.sku.toLowerCase(),
      name: s.name,
      sku: s.sku,
      category: s.category,
      description: s.desc,
      unitPrice: s.price,
      unit: "each",
      materialCost: s.mat,
      laborHours: s.hours,
      familyId: s.familyId,
      tier: 1,
      tierLabel: s.name,
      equipmentKind: "other",
      installFuel: s.familyId === "seismic_valve" || s.familyId === "flue" ? "gas" : "n/a",
      installPower:
        s.familyId === "ev_charger" ||
        s.familyId === "hrv" ||
        s.familyId === "dehumidifier" ||
        s.sku.startsWith("HUM-HW-HE360") ||
        s.sku.startsWith("HUM-HW-HM") ||
        s.familyId === "bath_fan" ||
        s.sku.startsWith("VENT-GABLE")
          ? "dedicated_circuit"
          : "none",
      installMount: "either",
      installEcosystem: "none",
      installCommunicating: false,
      benefits: s.benefits,
      options: [],
      imageUrl: s.img || ART,
      dimensions: s.dims || null,
      workScope: s.scope,
      productInfoUrl: s.url,
      createdAt: now,
      updatedAt: now,
    });
  }

  const honeywellStats: {
    sku: string;
    model: string;
    name: string;
    street: number;
    hours: number;
    tier: number;
    stages: string;
    wifi: boolean;
    benefits: string[];
    url: string;
  }[] = [
    {
      sku: "STAT-HW-T4",
      model: "TH4110U2005",
      name: "Honeywell T4 Pro Programmable Thermostat",
      street: 78,
      hours: 1,
      tier: 1,
      stages: "1H/1C",
      wifi: false,
      benefits: [
        "Ferguson-stocked T4 Pro — simple 7-day programmable",
        "1 heat / 1 cool conventional",
        "Backlit display · no Wi-Fi to set up",
        "UWP wall plate — fast swap on change-outs",
      ],
      url: "https://www.resideo.com/us/en/pro/products/air/thermostats/",
    },
    {
      sku: "STAT-HW-T6",
      model: "TH6220U2000",
      name: "Honeywell T6 Pro Programmable Thermostat",
      street: 112,
      hours: 1,
      tier: 2,
      stages: "2H/2C",
      wifi: false,
      benefits: [
        "Ferguson workhorse — T6 Pro 2 heat / 2 cool",
        "Heat pump or conventional",
        "7-day programmable · contractor installer setup",
        "UWP mounting system",
      ],
      url: "https://www.resideo.com/us/en/pro/products/air/thermostats/",
    },
    {
      sku: "STAT-HW-T6HP",
      model: "TH6320U2008",
      name: "Honeywell T6 Pro Heat Pump Thermostat",
      street: 128,
      hours: 1.1,
      tier: 3,
      stages: "3H/2C",
      wifi: false,
      benefits: [
        "T6 Pro sized for heat pump + aux — 3 heat / 2 cool",
        "Ferguson-stocked Resideo T-series",
        "No Wi-Fi — reliable for clients who do not want an app",
        "UWP wall plate",
      ],
      url: "https://www.resideo.com/us/en/pro/products/air/thermostats/",
    },
    {
      sku: "STAT-HW-T6S",
      model: "TH6320WF2003",
      name: "Honeywell T6 Pro Smart Thermostat",
      street: 189,
      hours: 1.25,
      tier: 4,
      stages: "3H/2C",
      wifi: true,
      benefits: [
        "T6 Pro Smart — Ferguson’s connected T-series",
        "3 heat / 2 cool heat pump or 2H/2C conventional",
        "App + geofencing · Resideo Pro App setup",
        "UWP mounting system",
      ],
      url: "https://www.ferguson.com/product/honeywell-home-t6-pro-smart-3h%2F2c%2C-2h%2F2c-programmable-thermostat-hth6320wf2003/7190554.html",
    },
    {
      sku: "STAT-HW-T9",
      model: "RCHT9510WFW2001",
      name: "Honeywell T9 Smart Thermostat with Sensor",
      street: 219,
      hours: 1.25,
      tier: 5,
      stages: "3H/2C",
      wifi: true,
      benefits: [
        "T9 Smart + Smart Room Sensor included",
        "Focus heat/cool on the room that is occupied",
        "Ferguson-stocked Honeywell Home",
        "App control and flexible scheduling",
      ],
      url: "https://www.honeywellhome.com/us/en/products/air/thermostats/",
    },
    {
      sku: "STAT-HW-T10",
      model: "THX321WF2003W",
      name: "Honeywell T10 Pro Smart Thermostat",
      street: 268,
      hours: 1.35,
      tier: 6,
      stages: "3H/2C",
      wifi: true,
      benefits: [
        "T10 Pro — premium Resideo smart stat",
        "RedLINK room sensor compatible",
        "Ferguson Pro line for communicating-capable jobs",
        "Resideo Pro App configuration",
      ],
      url: "https://www.resideo.com/us/en/pro/products/air/thermostats/",
    },
  ];
  for (const t of honeywellStats) {
    const laborSell = Math.round(t.hours * 145);
    out.push({
      id: "prod_" + t.sku.toLowerCase(),
      name: t.name,
      sku: t.sku,
      category: "Controls · Honeywell",
      description:
        `${t.name} (${t.model}). ${t.stages}. ` +
        `Honeywell Home / Resideo T-series — standard Ferguson stock. ` +
        (t.wifi ? "Wi-Fi / app." : "No Wi-Fi."),
      unitPrice: Math.round(t.street * 1.35 + laborSell),
      unit: "each",
      materialCost: t.street,
      laborHours: t.hours,
      familyId: "thermostat",
      tier: t.tier,
      tierLabel: `${t.model} · ${t.stages}`,
      equipmentKind: "other",
      matchKey: "thermostat",
      installFuel: "n/a",
      installPower: t.wifi ? "plug_nearby" : "none",
      installMount: "wall",
      installEcosystem: "none",
      installCommunicating: false,
      benefits: t.benefits,
      options: [],
      imageUrl: ART,
      workScope:
        `1. Remove existing thermostat; label wires; photo the wall plate.\n` +
        `2. Install Honeywell ${t.model} on UWP / compatible plate; C-wire if required.\n` +
        `3. Configure ${t.stages} equipment type` +
        (t.wifi ? "; connect Wi-Fi and Resideo app.\n" : ".\n") +
        "4. Verify heat / cool / fan; owner orientation.",
      productInfoUrl: t.url,
      createdAt: now,
      updatedAt: now,
    });
  }

  const iqair: {
    sku: string;
    model: string;
    tons: number;
    street: number;
    hours: number;
    w: number;
    d: number;
    h: number;
    cfm: number;
    filterSku: string;
  }[] = [
    {
      sku: "IQ-P16-3T",
      model: "Perfect 16 ID-2225",
      tons: 3,
      street: 2895,
      hours: 3.5,
      w: 25.25,
      d: 21.25,
      h: 21.25,
      cfm: 1200,
      filterSku: "202 11 30 02",
    },
    {
      sku: "IQ-P16-5T",
      model: "Perfect 16 ID-2530",
      tons: 5,
      street: 3395,
      hours: 4,
      w: 29.25,
      d: 25.25,
      h: 21.25,
      cfm: 2000,
      filterSku: "202 11 30 03",
    },
  ];
  for (const q of iqair) {
    const laborSell = Math.round(q.hours * 145);
    out.push({
      id: "prod_" + q.sku.toLowerCase(),
      name: `IQAir Perfect 16 ${q.tons}-Ton Whole-House Filter`,
      sku: q.sku,
      category: "Indoor air quality · IQAir",
      description:
        `IQAir Perfect 16 ${q.model} for ${q.tons}-ton systems (up to ${q.cfm.toLocaleString()} CFM). ` +
        `MERV 16 medical-grade whole-house filtration in the return. ` +
        `Cabinet ~${q.w}" × ${q.d}" × ${q.h}". Replacement filters ${q.filterSku}.`,
      unitPrice: Math.round(q.street * 1.18 + laborSell),
      unit: "each",
      materialCost: q.street,
      laborHours: q.hours,
      familyId: "air_cleaner",
      tier: q.tons >= 5 ? 2 : 1,
      tierLabel: `${q.tons}-ton · MERV 16`,
      equipmentKind: "other",
      matchKey: "iaq-iqair",
      installFuel: "n/a",
      installPower: "none",
      installMount: "either",
      installFootprint: null,
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: { widthIn: q.w, depthIn: q.d, heightIn: q.h },
      benefits: [
        `Sized for ${q.tons}-ton systems · up to ${q.cfm.toLocaleString()} CFM`,
        "MERV 16 — hospital-grade particle capture through the whole house",
        "Deep-bed media — far more surface area than a 1\" furnace filter",
        "Typical filter life up to 3 years at 50% duty (change with usage)",
        "Sealed cabinet so dirty air cannot bypass the media",
        `Advisor fit: ${q.w}" × ${q.d}" × ${q.h}" · ${q.model}`,
      ],
      options: [
        {
          id: `opt-${q.sku.toLowerCase()}-spare`,
          title: "Spare Perfect 16 filter set",
          body: `Leave a genuine IQAir ${q.model} replacement set (${q.filterSku}) on site.`,
          kind: "accessory",
          materialCost: q.tons >= 5 ? 420 : 360,
          laborHours: 0.15,
          priceDelta: Math.round((q.tons >= 5 ? 420 : 360) * 1.4 + 25),
          defaultSelected: false,
        },
      ],
      imageUrl: "/product-photos/filter-iqair.svg",
      workScope:
        `1. Confirm system tonnage/CFM and return-bay space for IQAir ${q.model} (${q.tons}-ton).\n` +
        "2. Install sealed Perfect 16 cabinet so all return air passes through the media.\n" +
        "3. Transition, seal, and check static pressure after install.\n" +
        "4. Orient owner on filter life and replacement part number.",
      productInfoUrl: "https://www.iqair.com/products/air-purifiers/perfectpro-series",
      createdAt: now,
      updatedAt: now,
    });
  }

  const coilTons = [2, 2.5, 3, 3.5, 4, 5] as const;
  for (const t of coilTons) {
    const tLabel = String(t);
    const skuT = t === 2.5 ? "2P5" : String(t);
    out.push({
      id: `prod_car_coil_${skuT.toLowerCase()}`,
      name: `Carrier Comfort™ Cased Coil (${tLabel} ton)`,
      sku: `CAR-COIL-${skuT}-COM`,
      category: "Indoor · Cased coil",
      description: `Cased evaporator coil for a ${tLabel}-ton outdoor unit on an existing furnace. Not an air handler.`,
      unitPrice: 980 + t * 180,
      unit: "each",
      materialCost: 420 + t * 80,
      laborHours: 2.5,
      familyId: "coil",
      tier: 1,
      tierLabel: `${tLabel} ton cased coil`,
      capacityValue: t,
      equipmentKind: "other",
      matchKey: `coil-${tLabel}`,
      installFuel: "electric",
      installPower: "none",
      installMount: "either",
      installEcosystem: "none",
      installCommunicating: false,
      benefits: [
        `${tLabel}-ton cased coil`,
        "Sits on the existing furnace",
        "Match to the outdoor heat pump or AC",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        `1. Confirm furnace cabinet and ${tLabel}-ton outdoor match.\n` +
        "2. Set cased coil; transition, drain, and refrigerant connections.\n" +
        "3. Leak check, evacuate, charge with the outdoor unit.",
      createdAt: now,
      updatedAt: now,
    });
    out.push({
      id: `prod_car_coil_inf_${skuT.toLowerCase()}`,
      name: `Carrier Infinity® Cased Coil (${tLabel} ton)`,
      sku: `CAR-COIL-${skuT}-INF`,
      category: "Indoor · Cased coil",
      description: `Infinity-class cased evaporator coil for a ${tLabel}-ton communicating outdoor unit on an existing furnace.`,
      unitPrice: 1280 + t * 220,
      unit: "each",
      materialCost: 560 + t * 95,
      laborHours: 2.75,
      familyId: "coil",
      tier: 3,
      tierLabel: `${tLabel} ton Infinity coil`,
      capacityValue: t,
      equipmentKind: "other",
      matchKey: `coil-${tLabel}`,
      installFuel: "electric",
      installPower: "none",
      installMount: "either",
      installEcosystem: "carrier_infinity",
      installCommunicating: true,
      benefits: [
        `${tLabel}-ton Infinity cased coil`,
        "Communicating outdoor match",
        "Sits on the existing furnace",
      ],
      options: [],
      imageUrl: ART,
      workScope:
        `1. Confirm furnace cabinet and ${tLabel}-ton Infinity outdoor match.\n` +
        "2. Set cased coil; transition, drain, communicating wiring, refrigerant.\n" +
        "3. Leak check, evacuate, charge; verify Infinity pairing.",
      createdAt: now,
      updatedAt: now,
    });
  }

  return out.map((p) =>
    stampLockedBenefits(stampOfficialPhoto(stampEnergyStar(p))),
  );
}
