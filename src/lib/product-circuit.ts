import type { Product } from "./proposal-types";
import { estimateMcaMocp } from "./session-filters";

export type AmpBucket = "a15_20" | "a25_30" | "a35_40" | "a45_50";

export type ProductCircuit = {
  volts: 120 | 240;
  voltId: "v110" | "v220";
  breakerAmps: number;
  ampId: AmpBucket;
  mca?: number;
  mocp?: number;
  label: string;
  detail: string;
  needsDedicated: boolean;
};

export function productIsNavienASeries(p?: Product | null): boolean {
  if (!p) return false;
  const blob = `${p.name} ${p.sku || ""} ${p.tierLabel || ""}`.toLowerCase();
  return /npe-?\d*a\d|npe-\d+a|a-series|navi-?circ/.test(blob);
}

export function ampBucket(amps: number): AmpBucket {
  if (amps <= 20) return "a15_20";
  if (amps <= 30) return "a25_30";
  if (amps <= 40) return "a35_40";
  return "a45_50";
}

function typicalOutdoorBreaker(tons: number): number {
  if (tons <= 2) return 20;
  if (tons <= 2.5) return 25;
  if (tons <= 3) return 30;
  if (tons <= 4) return 40;
  return 50;
}

function blobOf(p: Product): string {
  return `${p.name} ${p.sku || ""} ${p.tierLabel || ""} ${p.category || ""} ${p.familyId || ""}`.toLowerCase();
}

export function resolveProductCircuit(
  product: Product | null | undefined,
  familyId?: string | null,
  tonnage?: number,
): ProductCircuit | null {
  if (!product) return null;
  const family = familyId || product.familyId || product.equipmentKind || "";
  const power = product.installPower;
  const blob = blobOf(product);

  if (power === "from_outdoor_shared") {
    return {
      volts: 240,
      voltId: "v220",
      breakerAmps: 0,
      ampId: "a15_20",
      label: "Powered from the outdoor unit",
      detail: "No indoor dedicated circuit. Electrical is on the outdoor measure.",
      needsDedicated: false,
    };
  }
  if (power === "none") {
    return {
      volts: 120,
      voltId: "v110",
      breakerAmps: 0,
      ampId: "a15_20",
      label: "No dedicated circuit",
      detail: "This equipment does not need a new branch circuit.",
      needsDedicated: false,
    };
  }

  const outdoor =
    product.equipmentKind === "heat_pump" ||
    product.equipmentKind === "ac" ||
    product.equipmentKind === "ductless" ||
    family === "heat_pump" ||
    family === "ac" ||
    family === "ductless";

  if (outdoor) {
    const tons = Math.max(1.5, tonnage || product.capacityValue || 3);
    const el = estimateMcaMocp(product, tons);
    const mocp = el?.mocp || typicalOutdoorBreaker(tons);
    return {
      volts: 240,
      voltId: "v220",
      breakerAmps: mocp,
      ampId: ampBucket(mocp),
      mca: el?.mca,
      mocp,
      label: `240V · ${mocp}A breaker`,
      detail: el
        ? `MCA ${el.mca}A · max fuse ${el.mocp}A · from this unit`
        : `Typical ${tons} ton class · confirm on the nameplate`,
      needsDedicated: true,
    };
  }

  if (family === "ev_charger" || /ev.?charg|car.?charg/i.test(blob)) {
    return {
      volts: 240,
      voltId: "v220",
      breakerAmps: 50,
      ampId: "a45_50",
      label: "240V · 50A breaker",
      detail: "Typical Level 2 charger. Confirm the listing.",
      needsDedicated: true,
    };
  }

  const plug120 =
    family === "bath_fan" ||
    family === "attic_vent" ||
    family === "hrv" ||
    family === "range_hood" ||
    family === "humidifier" ||
    /bath.?fan|gable|whisper|humidifier|hrv|erv|range.?hood/i.test(blob);

  if (family === "electrical" || /^elec-/i.test(product.sku || "")) {
    if (/elec-240|elec-sub/i.test(product.sku || "") || /240|sub panel/i.test(blob)) {
      const amps = /sub/i.test(blob) ? 60 : 30;
      return {
        volts: 240,
        voltId: "v220",
        breakerAmps: amps,
        ampId: ampBucket(amps),
        label: `240V · ${amps}A`,
        detail: "Electrical job — confirm the load on the measure.",
        needsDedicated: true,
      };
    }
    return {
      volts: 120,
      voltId: "v110",
      breakerAmps: 20,
      ampId: "a15_20",
      label: "120V · 15/20A",
      detail: "Electrical job. Not a heat-pump circuit.",
      needsDedicated: /elec-120/i.test(product.sku || ""),
    };
  }

  if (plug120) {
    return {
      volts: 120,
      voltId: "v110",
      breakerAmps: 20,
      ampId: "a15_20",
      label: "120V · 15/20A",
      detail: "Bath / plug-in / 120-volt branch. Not a heat-pump circuit.",
      needsDedicated: power === "dedicated_circuit",
    };
  }

  if (family === "water_heater" || product.installFootprint === "tank" || product.installFootprint === "hpwh") {
    const hybrid =
      product.installFootprint === "hpwh" ||
      /hpwh|hybrid|heat.?pump water/i.test(blob);
    const electric =
      hybrid ||
      product.installFuel === "electric" ||
      /electric tank|electric water/i.test(blob);

    if (electric) {
      const br = hybrid ? 30 : 30;
      return {
        volts: 240,
        voltId: "v220",
        breakerAmps: br,
        ampId: ampBucket(br),
        label: `240V · ${br}A breaker`,
        detail: hybrid
          ? "Hybrid heat pump water heater — dedicated 240V"
          : "Electric tank — dedicated 240V",
        needsDedicated: true,
      };
    }

    const dedicated = power === "dedicated_circuit";
    return {
      volts: 120,
      voltId: "v110",
      breakerAmps: 15,
      ampId: "a15_20",
      label: dedicated ? "120V · 15A dedicated" : "120V · nearby receptacle",
      detail: dedicated
        ? "Tankless / power-vent electronics"
        : "Gas tank — nearby 120V if the unit needs it",
      needsDedicated: dedicated,
    };
  }

  if (power === "dedicated_circuit") {
    return {
      volts: 240,
      voltId: "v220",
      breakerAmps: 30,
      ampId: "a25_30",
      label: "240V · 30A breaker",
      detail: "Dedicated circuit for this equipment",
      needsDedicated: true,
    };
  }
  if (power === "plug_nearby") {
    return {
      volts: 120,
      voltId: "v110",
      breakerAmps: 15,
      ampId: "a15_20",
      label: "120V · nearby receptacle",
      detail: "Plug within reach of the equipment",
      needsDedicated: false,
    };
  }
  return null;
}

export function circuitScopePhrase(c: ProductCircuit): string {
  if (!c.needsDedicated || !c.breakerAmps) {
    return c.volts === 240 ? "240V" : "120V";
  }
  return `${c.volts}V ${c.breakerAmps}A`;
}
