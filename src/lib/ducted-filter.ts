/**
 * Filter choice on furnace / air handler.
 * Reuse stays on the host. AprilAire / IQAir can be Select and/or Option
 * at the same time — one included, as many options as they want.
 */
import type { Product } from "./proposal-types";
import type { MeasureFamilyId, MeasureInstance, WizardAnswers } from "./quote-wizard";
import { equipmentLeadLines } from "./equipment-scope-lead";

export const REUSE_FILTER_LINE =
  "Reuse the existing filter system. It meets manufacturer requirements to protect the new equipment.";

export type FilterLane = "merv13" | "merv16" | "iqair";
export type FilterRole = "included" | "optional";

const LANE_ORDER: FilterLane[] = ["merv13", "merv16", "iqair"];

export function isDuctedHostFamily(id: string): boolean {
  return id === "furnace" || id === "air_handler";
}

export function jobHasDuctedHost(answers: WizardAnswers): boolean {
  return (answers.measureInstances || []).some((m) =>
    isDuctedHostFamily(m.familyId),
  );
}

export function withDuctedFilterChip(
  families: string[] | undefined,
  instances: MeasureInstance[],
): MeasureFamilyId[] {
  const set = new Set((families || []) as MeasureFamilyId[]);
  if (instances.some((m) => isDuctedHostFamily(m.familyId))) {
    set.add("air_cleaner");
  }
  return Array.from(set);
}

export function spawnedFilterInstances(
  answers: WizardAnswers,
  hostId: string,
): MeasureInstance[] {
  return (answers.measureInstances || []).filter(
    (m) =>
      m.familyId === "air_cleaner" &&
      String(m.scopeAnswers?.spawnedBy || "") === hostId,
  );
}

export function hostReusesFilter(host: MeasureInstance): boolean {
  return String(host.scopeAnswers?.ducted_filter_reuse || "") === "1";
}

export function hostFilterDecided(
  inst: MeasureInstance,
  answers?: WizardAnswers,
): boolean {
  if (!isDuctedHostFamily(inst.familyId)) return true;
  if (inst.furnaceEffStyle === "navien_npf") return true;
  if (
    inst.hpInstallPath === "mini-split" ||
    inst.hpInstallPath === "mini" ||
    inst.hpInstallPath === "interconnect"
  )
    return true;
  if (hostReusesFilter(inst)) return true;
  if (String(inst.scopeAnswers?.ducted_filter || "") === "reuse") return true;
  if (answers && spawnedFilterInstances(answers, inst.id).length > 0)
    return true;
  return false;
}

/** They picked at least one filter AND tapped Done. Next stage waits for this. */
export function hostFilterStageDone(
  inst: MeasureInstance,
  answers?: WizardAnswers,
): boolean {
  if (!isDuctedHostFamily(inst.familyId)) return true;
  // Navien NPF is hydronic — AprilAire / reuse-filter is not this path.
  if (inst.furnaceEffStyle === "navien_npf") return true;
  if (
    inst.hpInstallPath === "mini-split" ||
    inst.hpInstallPath === "mini" ||
    inst.hpInstallPath === "interconnect"
  )
    return true;
  // Already past this stage on an older draft
  if (inst.accessoriesConfirmed) return true;
  if (String(inst.scopeAnswers?.ducted_filter_done || "") !== "1") return false;
  return hostFilterDecided(inst, answers);
}

export function setHostFilterDone(
  answers: WizardAnswers,
  host: MeasureInstance,
  done: boolean,
): Partial<WizardAnswers> {
  return {
    measureInstances: (answers.measureInstances || []).map((m) =>
      m.id === host.id
        ? {
            ...m,
            scopeAnswers: {
              ...(m.scopeAnswers || {}),
              ducted_filter_done: done ? "1" : "",
            },
          }
        : m,
    ),
  };
}

export function filterRecapLabel(
  inst: MeasureInstance,
  answers: WizardAnswers,
): string {
  const bits: string[] = [];
  if (hostReusesFilter(inst) || inst.scopeAnswers?.ducted_filter === "reuse") {
    bits.push("Keep theirs");
  }
  for (const m of spawnedFilterInstances(answers, inst.id)) {
    const lane = String(m.scopeAnswers?.filter_lane || "") as FilterLane;
    const name =
      lane === "merv13"
        ? "AprilAire MERV 13"
        : lane === "merv16"
          ? "AprilAire MERV 16"
          : m.label || "IQAir";
    bits.push(m.role === "optional" ? `${name} (option)` : name);
  }
  return bits.join(" · ") || "Filter";
}

export function laneRoleOnHost(
  answers: WizardAnswers,
  hostId: string,
  lane: FilterLane,
): FilterRole | null {
  const inst = spawnedFilterInstances(answers, hostId).find(
    (m) => String(m.scopeAnswers?.filter_lane || "") === lane,
  );
  if (!inst) return null;
  return inst.role === "optional" ? "optional" : "included";
}

function tonsFromProduct(p: Product | null | undefined): number {
  const n = Number(p?.capacityValue);
  if (Number.isFinite(n) && n > 0 && n <= 8) return n;
  const m = `${p?.name || ""} ${p?.tierLabel || ""}`.match(
    /(\d+(?:\.\d+)?)\s*-?\s*ton/i,
  );
  return m ? Number(m[1]) : 3;
}

function isAprilaire(p: Product): boolean {
  return /aprilaire|AA-/i.test(`${p.name} ${p.sku} ${p.familyId || ""}`);
}

function isIqair(p: Product): boolean {
  return /iqair|perfect 16/i.test(`${p.name} ${p.sku}`);
}

export function filterProductsForHost(
  catalog: Product[],
  host: Product | null | undefined,
): { lane: FilterLane; product: Product }[] {
  const tons = tonsFromProduct(host);
  const out: { lane: FilterLane; product: Product }[] = [];
  const april = catalog.filter((p) => isAprilaire(p));
  const pickApril = (want: "13" | "16") => {
    const sized =
      tons >= 4
        ? april.find((p) => /1610|2410|1510/.test(p.sku || p.name))
        : april.find((p) => /1410|2410|1310/.test(p.sku || p.name)) || april[0];
    if (!sized) return;
    out.push({
      lane: want === "16" ? "merv16" : "merv13",
      product: sized,
    });
  };
  pickApril("13");
  pickApril("16");
  const iq = catalog.filter((p) => isIqair(p));
  const iqPick =
    tons >= 4
      ? iq.find((p) => /5/.test(`${p.name} ${p.sku}`)) || iq[1] || iq[0]
      : iq.find((p) => /3/.test(`${p.name} ${p.sku}`)) || iq[0];
  if (iqPick) out.push({ lane: "iqair", product: iqPick });
  const seen = new Set<string>();
  return out.filter((row) => {
    const key = row.lane;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterLaneLabel(lane: FilterLane, p: Product): string {
  if (lane === "merv13") return "AprilAire MERV 13";
  if (lane === "merv16") return "AprilAire MERV 16";
  return p.name.replace(/^IQAir\s+/i, "IQAir ");
}

function rid() {
  return `mi_${Math.random().toString(36).slice(2, 9)}`;
}

function filterWorkScope(product: Product, lane: FilterLane): string {
  const lead = equipmentLeadLines(product, "air_cleaner");
  const media =
    lane === "merv13"
      ? "Install genuine AprilAire MERV 13 Healthy Home media in the cabinet."
      : lane === "merv16"
        ? "Install genuine AprilAire MERV 16 Allergy & Asthma media in the cabinet."
        : "";
  const rest = (product.workScope || "")
    .split("\n")
    .map((l) => l.replace(/^\d+[\.)]\s*/, "").trim())
    .filter(Boolean)
    .filter((l) => !/Install genuine AprilAire media/i.test(l));
  if (media) rest.splice(Math.min(3, rest.length), 0, media);
  return [...lead, ...rest.map((l, i) => `${i + 1}. ${l}`)].join("\n");
}

function placeSpawnedAfterHost(
  list: MeasureInstance[],
  hostId: string,
): MeasureInstance[] {
  const spawned = list.filter(
    (m) =>
      m.familyId === "air_cleaner" &&
      String(m.scopeAnswers?.spawnedBy || "") === hostId,
  );
  if (!spawned.length) return list;
  const rest = list.filter((m) => !spawned.includes(m));
  spawned.sort(
    (a, b) =>
      LANE_ORDER.indexOf(String(a.scopeAnswers?.filter_lane || "") as FilterLane) -
      LANE_ORDER.indexOf(String(b.scopeAnswers?.filter_lane || "") as FilterLane),
  );
  const at = rest.findIndex((m) => m.id === hostId);
  const next = [...rest];
  next.splice(at >= 0 ? at + 1 : next.length, 0, ...spawned);
  return next;
}

function familiesFrom(list: MeasureInstance[], extra?: MeasureFamilyId[]) {
  const families = new Set<MeasureFamilyId>();
  for (const m of list) families.add(m.familyId);
  for (const e of extra || []) families.add(e);
  return Array.from(families);
}

export function applyDuctedFilterChoice(
  answers: WizardAnswers,
  host: MeasureInstance,
  catalog: Product[],
  choice:
    | { kind: "reuse" }
    | { kind: "clear" }
    | {
        kind: "sell";
        productId: string;
        lane: FilterLane;
        role: FilterRole;
      },
): Partial<WizardAnswers> {
  const liveHost =
    (answers.measureInstances || []).find((m) => m.id === host.id) || host;
  let list = [...(answers.measureInstances || [])];

  if (choice.kind === "clear") {
    list = list.filter(
      (m) =>
        !(
          m.familyId === "air_cleaner" &&
          String(m.scopeAnswers?.spawnedBy || "") === host.id
        ),
    );
    list = list.map((m) =>
      m.id === host.id
        ? {
            ...m,
            scopeAnswers: {
              ...(m.scopeAnswers || {}),
              ducted_filter_reuse: "",
              ducted_filter: "",
              ducted_filter_role: "",
            },
          }
        : m,
    );
    return {
      measureInstances: list,
      selectedMeasureFamilies: familiesFrom(list),
    };
  }

  if (choice.kind === "reuse") {
    const on = !hostReusesFilter(liveHost);
    list = list.map((m) => {
      if (m.id === host.id) {
        return {
          ...m,
          scopeAnswers: {
            ...(m.scopeAnswers || {}),
            ducted_filter_reuse: on ? "1" : "",
            ducted_filter: on ? "reuse" : "",
          },
        };
      }
      if (
        on &&
        m.familyId === "air_cleaner" &&
        String(m.scopeAnswers?.spawnedBy || "") === host.id &&
        m.role === "included"
      ) {
        return { ...m, role: "optional" as const };
      }
      return m;
    });
    return {
      measureInstances: placeSpawnedAfterHost(list, host.id),
      selectedMeasureFamilies: familiesFrom(list, ["air_cleaner"]),
    };
  }

  const existing = list.find(
    (m) =>
      m.familyId === "air_cleaner" &&
      String(m.scopeAnswers?.spawnedBy || "") === host.id &&
      String(m.scopeAnswers?.filter_lane || "") === choice.lane,
  );

  // Same button again = turn that lane off. Other lanes stay.
  if (existing && existing.role === choice.role) {
    list = list.filter((m) => m.id !== existing.id);
    return {
      measureInstances: list,
      selectedMeasureFamilies: familiesFrom(list, ["air_cleaner"]),
    };
  }

  const product = catalog.find((p) => p.id === choice.productId);
  if (!product) return { measureInstances: list };

  const inst: MeasureInstance = {
    id: existing?.id || rid(),
    familyId: "air_cleaner",
    label: filterLaneLabel(choice.lane, product),
    productId: product.id,
    role: choice.role,
    packetTitle: filterLaneLabel(choice.lane, product),
    benefits: product.benefits ? [...product.benefits] : undefined,
    workScope: filterWorkScope(product, choice.lane),
    equipmentConfirmed: true,
    accessoriesConfirmed: true,
    scopeAnswers: {
      spawnedBy: host.id,
      filter_lane: choice.lane,
    },
  };

  list = list.filter((m) => m.id !== inst.id);
  // One included filter at a time — other Selects become Options
  if (choice.role === "included") {
    list = list.map((m) => {
      if (
        m.familyId === "air_cleaner" &&
        String(m.scopeAnswers?.spawnedBy || "") === host.id &&
        m.role === "included"
      ) {
        return { ...m, role: "optional" as const };
      }
      if (m.id === host.id) {
        return {
          ...m,
          scopeAnswers: {
            ...(m.scopeAnswers || {}),
            ducted_filter_reuse: "",
            ducted_filter: choice.lane,
          },
        };
      }
      return m;
    });
  }

  const at = list.findIndex((m) => m.id === host.id);
  list.splice(at >= 0 ? at + 1 : list.length, 0, inst);

  return {
    measureInstances: placeSpawnedAfterHost(list, host.id),
    selectedMeasureFamilies: familiesFrom(list, ["air_cleaner"]),
  };
}

export function filterFitDims(p: Product): string {
  const d = p.dimensions;
  if (!d) return "";
  return `${d.widthIn}" W × ${d.depthIn}" D × ${d.heightIn}" H`;
}
