/**
 * Package builder foundation — comparison packages A/B, either/or groups,
 * sticky view totals. Hub stays flat until packages exist or advisor opens builder.
 */
import type { Product } from "./proposal-types";
import type {
  MeasureFamilyId,
  MeasureInstance,
  WizardAnswers,
} from "./quote-wizard";
import { buildLineItems, familyLabel } from "./quote-wizard";
import { lineCountsInTotal } from "./domain/optional-rules";

export type QuotePackageDef = {
  id: string;
  /** Customer-facing short label e.g. "Package A" */
  label: string;
  letter: string;
  kind: "main" | "comparison";
  /** Major + assigned measures in this package */
  measureInstanceIds: string[];
};

export type EitherOrGroupDef = {
  id: string;
  label: string;
  familyId: MeasureFamilyId;
  /** Same foundation + location key (placement or family index) */
  locationKey: string;
  measureInstanceIds: string[];
};

export type PackageBuilderState = {
  /** Advisor opened builder or auto packages were created */
  enabled: boolean;
  packages: QuotePackageDef[];
  eitherOrGroups: EitherOrGroupDef[];
  /** Sticky chip filter: everything | package id */
  activeView: "everything" | string;
};

export const EMPTY_PACKAGE_BUILDER: PackageBuilderState = {
  enabled: false,
  packages: [],
  eitherOrGroups: [],
  activeView: "everything",
};

/** Dependents that inherit onto every comparison package by default */
export const SHARED_DEPENDENT_FAMILIES: MeasureFamilyId[] = [
  "ductwork",
  "permits",
  "hers",
  "install",
  "load_calc",
];

const MAJOR_COMPARE_FAMILIES: MeasureFamilyId[] = [
  "heat_pump",
  "ductless",
  "furnace",
  "ac",
  "air_handler",
  "water_heater",
  "wall_heater",
  "thermostat",
  "zoning",
  "ductwork",
  "air_cleaner",
];

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function locationKey(inst: MeasureInstance): string {
  const place =
    (inst.installLocationLabel || "").trim() ||
    (inst.installLocationPreset || "").trim() ||
    "default";
  return `${inst.familyId}::${place.toLowerCase()}`;
}

function pathBucket(inst: MeasureInstance): string {
  if (inst.hpInstallPath === "mini-split") return "mini";
  if (inst.hpInstallPath === "conventional") return "24v";
  if (inst.wallVentStyle) return `wall:${inst.wallVentStyle}`;
  if (inst.waterHeaterStyle) return `wh:${inst.waterHeaterStyle}`;
  if (inst.furnaceEffStyle) return `furn:${inst.furnaceEffStyle}`;
  return "default";
}

function compareFamily(id: MeasureFamilyId): string {
  if (id === "ductless" || id === "heat_pump") return "heat_pump";
  return id;
}

/**
 * Two+ different types on the same family (the type picker: wall vent,
 * water-heater style, 24V vs communicating, 80 vs 90 furnace…) means
 * packages. Same type twice is just two measures — not a package fight.
 */
export function detectForcedComparison(
  instances: MeasureInstance[],
): { buckets: Map<string, MeasureInstance[]>; reason: string } | null {
  const majors = (instances || []).filter((i) =>
    MAJOR_COMPARE_FAMILIES.includes(i.familyId),
  );
  if (majors.length < 2) return null;

  const byFamily = new Map<string, MeasureInstance[]>();
  for (const m of majors) {
    const fam = compareFamily(m.familyId);
    const list = byFamily.get(fam) || [];
    list.push(m);
    byFamily.set(fam, list);
  }

  for (const [fam, list] of byFamily) {
    if (list.length < 2) continue;
    const buckets = new Map<string, MeasureInstance[]>();
    for (const m of list) {
      const b = pathBucket(m);
      if (b === "default") continue;
      const row = buckets.get(b) || [];
      row.push(m);
      buckets.set(b, row);
    }
    if (buckets.size >= 2) {
      return {
        buckets,
        reason: `Different ${fam.replace(/_/g, " ")} types on this job — comparison packages created.`,
      };
    }
  }

  return null;
}

export function detectEitherOrGroups(
  instances: MeasureInstance[],
): EitherOrGroupDef[] {
  const groups: EitherOrGroupDef[] = [];
  const eitherFamilies: MeasureFamilyId[] = [
    "water_heater",
    "thermostat",
    "ductwork",
    "wall_heater",
  ];
  const byLoc = new Map<string, MeasureInstance[]>();
  for (const inst of instances || []) {
    if (!eitherFamilies.includes(inst.familyId)) continue;
    if (!inst.productId && inst.familyId !== "custom") continue;
    const key = locationKey(inst);
    const list = byLoc.get(key) || [];
    list.push(inst);
    byLoc.set(key, list);
  }
  for (const [key, list] of byLoc) {
    if (list.length < 2) continue;
    const paths = new Set(
      list.map((m) => pathBucket(m)).filter((b) => b !== "default"),
    );
    if (paths.size >= 2) continue;
    const fam = list[0].familyId;
    const place =
      list[0].installLocationLabel ||
      list[0].installLocationPreset ||
      "this location";
    groups.push({
      id: rid("eor"),
      label: `Choose one · ${familyLabel(fam)} · ${place}`,
      familyId: fam,
      locationKey: key,
      measureInstanceIds: list.map((i) => i.id),
    });
  }
  return groups;
}

export function buildAutoPackages(
  answers: WizardAnswers,
): PackageBuilderState | null {
  const instances = answers.measureInstances || [];
  const forced = detectForcedComparison(instances);
  if (!forced) return null;

  const letters = "ABCDEFGH";
  const packages: QuotePackageDef[] = [];
  let i = 0;
  const shared = instances
    .filter((inst) => SHARED_DEPENDENT_FAMILIES.includes(inst.familyId))
    .map((inst) => inst.id);

  for (const [, bucketInsts] of forced.buckets) {
    const letter = letters[i] || String(i + 1);
    const majorIds = bucketInsts.map((m) => m.id);
    // Partner indoor units: same path bucket if set, else all air handlers
    const partners = instances
      .filter(
        (inst) =>
          !majorIds.includes(inst.id) &&
          !shared.includes(inst.id) &&
          (inst.familyId === "air_handler" ||
            inst.familyId === "furnace" ||
            inst.familyId === "zoning"),
      )
      .filter((inst) => {
        const b = pathBucket(inst);
        if (b === "default") return i === 0; // first package gets unbucketed partners
        return majorIds.some((id) => {
          const maj = instances.find((x) => x.id === id);
          return maj && pathBucket(maj) === b;
        });
      })
      .map((inst) => inst.id);

    packages.push({
      id: rid("pkg"),
      letter,
      label: `Package ${letter}`,
      kind: i === 0 ? "main" : "comparison",
      measureInstanceIds: Array.from(
        new Set([...majorIds, ...partners, ...shared]),
      ),
    });
    i += 1;
  }

  if (packages.length < 2) return null;

  return {
    enabled: true,
    packages,
    eitherOrGroups: detectEitherOrGroups(instances),
    activeView: "everything",
  };
}

/** Manual open: seed either/or groups + empty packages ready to assign */
export function openPackageBuilder(
  answers: WizardAnswers,
): PackageBuilderState {
  const existing = answers.packageBuilder;
  if (existing?.enabled && existing.packages.length) {
    return { ...existing, enabled: true };
  }
  const auto = buildAutoPackages(answers);
  if (auto) return auto;
  return {
    enabled: true,
    packages: [
      {
        id: rid("pkg"),
        letter: "A",
        label: "Package A",
        kind: "main",
        measureInstanceIds: (answers.measureInstances || []).map((m) => m.id),
      },
    ],
    eitherOrGroups: detectEitherOrGroups(answers.measureInstances || []),
    activeView: "everything",
  };
}

export function addComparisonPackage(
  state: PackageBuilderState,
  answers: WizardAnswers,
): PackageBuilderState {
  const used = new Set(state.packages.map((p) => p.letter));
  const letters = "ABCDEFGH";
  const letter = letters.split("").find((l) => !used.has(l)) || "X";
  const shared = (answers.measureInstances || [])
    .filter((inst) => SHARED_DEPENDENT_FAMILIES.includes(inst.familyId))
    .map((inst) => inst.id);
  return {
    ...state,
    enabled: true,
    packages: [
      ...state.packages,
      {
        id: rid("pkg"),
        letter,
        label: `Package ${letter}`,
        kind: "comparison",
        measureInstanceIds: [...shared],
      },
    ],
  };
}

export function toggleMeasureInPackage(
  state: PackageBuilderState,
  packageId: string,
  measureId: string,
  on: boolean,
): PackageBuilderState {
  return {
    ...state,
    packages: state.packages.map((p) => {
      if (p.id !== packageId) return p;
      const set = new Set(p.measureInstanceIds);
      if (on) set.add(measureId);
      else set.delete(measureId);
      return { ...p, measureInstanceIds: Array.from(set) };
    }),
  };
}

export function measureVisibleInView(
  measureId: string,
  state: PackageBuilderState | null | undefined,
): boolean {
  if (!state?.enabled || !state.packages.length) return true;
  if (state.activeView === "everything") return true;
  const pkg = state.packages.find((p) => p.id === state.activeView);
  if (!pkg) return true;
  return pkg.measureInstanceIds.includes(measureId);
}

export function packageCustomerTotal(
  answers: WizardAnswers,
  products: Product[],
  packageId: "everything" | string,
): number {
  const lines = buildLineItems(answers, products);
  const pb = answers.packageBuilder;
  let allowed: Set<string> | null = null;
  if (packageId !== "everything" && pb?.packages?.length) {
    const pkg = pb.packages.find((p) => p.id === packageId);
    if (pkg) {
      // Line ids are li_${instanceId}
      allowed = new Set(pkg.measureInstanceIds.map((id) => `li_${id}`));
    }
  }
  let sell = 0;
  for (const li of lines) {
    if (allowed && !allowed.has(li.id)) continue;
    if (!lineCountsInTotal(li)) continue;
    sell += (li.unitPrice || 0) * (li.quantity || 1);
    for (const o of li.options || []) {
      if (!(li.selectedOptionIds || []).includes(o.id)) continue;
      sell += o.priceDelta || 0;
    }
  }
  return Math.round(sell * 100) / 100;
}

/** Unfinished majors — hold off customer send until models picked */
export function unfinishedMeasureIds(answers: WizardAnswers): string[] {
  const out: string[] = [];
  for (const inst of answers.measureInstances || []) {
    if (inst.familyId === "custom") continue;
    if (SHARED_DEPENDENT_FAMILIES.includes(inst.familyId)) continue;
    if (!MAJOR_COMPARE_FAMILIES.includes(inst.familyId)) continue;
    if (!inst.productId) out.push(inst.id);
  }
  return out;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
