/**
 * Ducted-job companions: one Ductwork measure + highlighted filter chip.
 * Seeded when a furnace or air handler is on the job.
 */
import type { Product } from "./proposal-types";
import type {
  MeasureFamilyId,
  MeasureInstance,
  WizardAnswers,
} from "./quote-wizard";

export const DUCTWORK_SKU = "SVC-DUCT";
export const NEW_DUCTS_OPTION_ID = "opt_new_ducts";

export function isDuctedEquipmentHost(id: string | undefined): boolean {
  return id === "furnace" || id === "air_handler";
}

export function jobHasDuctedEquipmentHost(a: WizardAnswers): boolean {
  return (a.measureInstances || []).some((m) =>
    isDuctedEquipmentHost(m.familyId),
  );
}

function rid() {
  return `mi_${Math.random().toString(36).slice(2, 9)}`;
}

function syncFamilies(list: MeasureInstance[], extra: MeasureFamilyId[] = []) {
  const set = new Set<MeasureFamilyId>();
  for (const m of list) set.add(m.familyId);
  for (const e of extra) set.add(e);
  return Array.from(set);
}

function jobHasHrvDedicated(a: WizardAnswers): boolean {
  return false;
}

function isAutoEmptyDuct(m: MeasureInstance): boolean {
  if (m.familyId !== "ductwork") return false;
  const host = String(m.scopeAnswers?.autoFromHost || "");
  if (host !== "1" && host !== "hrv") return false;
  const keys = Object.keys(m.scopeAnswers || {}).filter(
    (k) => k !== "autoFromHost",
  );
  return keys.length === 0;
}

function seedDuctInstance(product: Product): MeasureInstance {
  return {
    id: rid(),
    familyId: "ductwork",
    label: "Ductwork",
    productId: product.id,
    role: "included",
    packetTitle: product.name,
    benefits: product.benefits ? [...product.benefits] : undefined,
    workScope: "",
    description: product.description,
    equipmentConfirmed: true,
    accessoriesConfirmed: true,
    advisorReopen: "site",
    scopeAnswers: { autoFromHost: "1" },
  };
}

/**
 * @param seedDuctwork  true when a furnace / air handler was just added
 */
export function ensureDuctedCompanionsOnQuote(
  a: WizardAnswers,
  products: Product[],
  seedDuctwork = false,
): Partial<WizardAnswers> {
  const hostOn = jobHasDuctedEquipmentHost(a);
  const hrvDedicated = jobHasHrvDedicated(a);
  let list = [...(a.measureInstances || [])];
  const families = new Set<MeasureFamilyId>(
    a.selectedMeasureFamilies || syncFamilies(list),
  );

  if (hostOn) {
    families.add("air_cleaner");
    families.add("ductwork");
    const hasDuct = list.some((m) => m.familyId === "ductwork");
    if (families.has("ductwork") && !hasDuct) {
      const prod = products.find(
        (p) => (p.sku || "").toUpperCase() === DUCTWORK_SKU,
      );
      if (prod) list.push(seedDuctInstance(prod));
    }
  } else if (hrvDedicated) {
    families.add("ductwork");
    const hasDuct = list.some((m) => m.familyId === "ductwork");
    if (!hasDuct) {
      const prod = products.find(
        (p) => (p.sku || "").toUpperCase() === DUCTWORK_SKU,
      );
      if (prod) {
        const inst = seedDuctInstance(prod);
        inst.scopeAnswers = { autoFromHost: "hrv" };
        list.push(inst);
      }
    }
  } else {
    const before = list.length;
    list = list.filter((m) => !isAutoEmptyDuct(m));
    if (list.length !== before && !list.some((m) => m.familyId === "ductwork")) {
      families.delete("ductwork");
    }
  }

  const nextFams = Array.from(families);
  const sameInst =
    list.length === (a.measureInstances || []).length &&
    list.every((m, i) => m === (a.measureInstances || [])[i]);
  const sameFam =
    nextFams.length === (a.selectedMeasureFamilies || []).length &&
    nextFams.every((f) => (a.selectedMeasureFamilies || []).includes(f));
  if (sameInst && sameFam) return {};

  return {
    measureInstances: list,
    selectedMeasureFamilies: nextFams,
  };
}

export function withNewDuctsOption(
  a: WizardAnswers,
  instanceId: string,
  offer: boolean,
): Partial<WizardAnswers> {
  const selected = new Set(a.optionSelections?.[instanceId] || []);
  if (offer) selected.add(NEW_DUCTS_OPTION_ID);
  else selected.delete(NEW_DUCTS_OPTION_ID);
  return {
    optionSelections: {
      ...(a.optionSelections || {}),
      [instanceId]: Array.from(selected),
    },
  };
}
