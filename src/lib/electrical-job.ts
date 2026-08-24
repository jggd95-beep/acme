import type { ProductCircuit } from "./product-circuit";

export type ElecJobId =
  | "c120"
  | "c240"
  | "gfi"
  | "light"
  | "sub"
  | "custom";

export type ElecLightKind = "both" | "light_only" | "switch_only";

type ElecInst = {
  scopeAnswers?: Record<string, unknown> | null;
};

export const ELEC_JOB_OPTIONS: {
  id: ElecJobId;
  label: string;
  img: string;
  sku: string;
  productId: string;
}[] = [
  {
    id: "c120",
    label: "120-volt circuit",
    img: "/elec/c120.svg",
    sku: "ELEC-120",
    productId: "prod_elec_120",
  },
  {
    id: "c240",
    label: "240-volt circuit",
    img: "/elec/c240.svg",
    sku: "ELEC-240",
    productId: "prod_elec_240",
  },
  {
    id: "gfi",
    label: "GFCI",
    img: "/elec/gfi.svg",
    sku: "ELEC-GFI",
    productId: "prod_elec_gfi",
  },
  {
    id: "light",
    label: "Light / switch",
    img: "/elec/light.svg",
    sku: "ELEC-LIGHT",
    productId: "prod_elec_light",
  },
  {
    id: "sub",
    label: "Sub panel",
    img: "/elec/sub.svg",
    sku: "ELEC-SUB",
    productId: "prod_elec_sub",
  },
  {
    id: "custom",
    label: "Custom",
    img: "/elec/custom.svg",
    sku: "ELEC-CUSTOM",
    productId: "prod_elec_custom",
  },
];

export const ELEC_LIGHT_KIND_OPTIONS: {
  id: ElecLightKind;
  label: string;
  img: string;
}[] = [
  { id: "both", label: "Light and switch", img: "/elec/light.svg" },
  { id: "light_only", label: "Light only", img: "/elec/light-only.svg" },
  { id: "switch_only", label: "Switch only", img: "/elec/switch-only.svg" },
];

export function elecJobId(inst: ElecInst): ElecJobId | null {
  const raw = String(inst.scopeAnswers?.ejob || "");
  return ELEC_JOB_OPTIONS.some((o) => o.id === raw)
    ? (raw as ElecJobId)
    : null;
}

export function elecLightKind(inst: ElecInst): ElecLightKind | null {
  const raw = String(inst.scopeAnswers?.ejob_light_kind || "");
  return ELEC_LIGHT_KIND_OPTIONS.some((o) => o.id === raw)
    ? (raw as ElecLightKind)
    : null;
}

export function elecJobOption(id: ElecJobId | null) {
  return ELEC_JOB_OPTIONS.find((o) => o.id === id) || null;
}

export function electricalJobTitle(inst: ElecInst): string {
  const job = elecJobId(inst);
  const custom = String(inst.scopeAnswers?.ejob_custom || "").trim();
  if (job === "custom" && custom) return custom;
  const load = String(inst.scopeAnswers?.ejob_240_load || "");
  if (job === "c240") {
    if (load === "dryer") return "New 30-amp dryer circuit";
    if (load === "range") return "New 40-amp range circuit";
    if (load === "ev") return "New 50-amp car-charger circuit";
    return "New 240-volt circuit";
  }
  if (job === "c120") return "New 120-volt circuit";
  if (job === "gfi") return "GFCI receptacle";
  if (job === "light") {
    const kind = elecLightKind(inst);
    if (kind === "light_only") return "New light";
    if (kind === "switch_only") return "New wall switch";
    return "Light and wall switch";
  }
  if (job === "sub") return "Sub panel";
  if (job === "custom") return "Electrical work";
  return "Electrical";
}

export function electricalCircuitOverride(inst: ElecInst): ProductCircuit | null {
  const job = elecJobId(inst);
  const load = String(inst.scopeAnswers?.ejob_240_load || "");
  if (job === "c240") {
    const amps = load === "ev" ? 50 : load === "range" ? 40 : 30;
    return {
      volts: 240,
      voltId: "v220",
      breakerAmps: amps,
      ampId: amps >= 45 ? "a45_50" : amps >= 35 ? "a35_40" : "a25_30",
      label: `240V · ${amps}A`,
      detail: "From the electrical job — not a heat pump",
      needsDedicated: true,
    };
  }
  if (job === "c120" || job === "gfi" || job === "light") {
    return {
      volts: 120,
      voltId: "v110",
      breakerAmps: 20,
      ampId: "a15_20",
      label: "120V · 15/20A",
      detail: "15/20-amp branch. Not a 50-amp feeder.",
      needsDedicated: job === "c120",
    };
  }
  if (job === "sub") {
    return {
      volts: 240,
      voltId: "v220",
      breakerAmps: 60,
      ampId: "a45_50",
      label: "240V · feeder",
      detail: "Sub-panel feeder. Size on site to the loads.",
      needsDedicated: true,
    };
  }
  return null;
}

export function electricalJobHelp(): string {
  return "Sets the electrical job we price. Light / switch splits on the next screen. Two jobs = add another Electrical.";
}
