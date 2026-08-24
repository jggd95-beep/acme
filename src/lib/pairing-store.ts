/**
 * Owner-controlled indoor/outdoor match groups.
 * Same group + same size = legal auto-pair. Different group = never auto-pick.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/lib/proposal-types";
import { productBrand } from "@/lib/session-filters";

export type PairingSeries = "comfort" | "performance" | "infinity" | "other";
export type PairingControl = "24v" | "communicating";

export type PairingGroup = {
  id: string;
  label: string;
  brand: string;
  series: PairingSeries;
  control: PairingControl;
  productIds: string[];
};

const PAIRABLE = new Set(["heat_pump", "air_handler", "ac", "furnace"]);

export function isPairableProduct(p: Product): boolean {
  const kind = p.equipmentKind || "";
  if (PAIRABLE.has(kind)) return true;
  return /heat pump|air handler|fan coil|furnace|\bac\b|condenser/i.test(
    `${p.name} ${p.category || ""}`,
  );
}

export function inferPairingSeries(p: Product): PairingSeries {
  const blob = `${p.name} ${p.tierLabel || ""} ${p.sku || ""}`.toLowerCase();
  if (p.tier === 3 || /infinity|greenspeed/.test(blob)) return "infinity";
  if (p.tier === 2 || /performance/.test(blob)) return "performance";
  if (p.tier === 1 || /comfort/.test(blob)) return "comfort";
  return "other";
}

export function inferPairingControl(p: Product): PairingControl {
  if (p.installCommunicating === true) return "communicating";
  if (p.installEcosystem === "carrier_infinity") return "communicating";
  const blob = `${p.name} ${p.tierLabel || ""} ${p.sku || ""} ${p.description || ""}`.toLowerCase();
  if (
    /infinity|greenspeed|communicat|m-?series|hyper.?heat|mini.?split|suz-|puz-|svz-|pva-/.test(
      blob,
    )
  ) {
    return "communicating";
  }
  if (p.installCommunicating === false) return "24v";
  return "24v";
}

export function pairingGroupKey(
  brand: string,
  series: PairingSeries,
  control: PairingControl,
): string {
  return `${brand.toLowerCase()}|${series}|${control}`;
}

export function defaultPairingLabel(
  brand: string,
  series: PairingSeries,
  control: PairingControl,
): string {
  const s =
    series === "comfort"
      ? "Comfort"
      : series === "performance"
        ? "Performance"
        : series === "infinity"
          ? "Infinity"
          : "Other";
  const c = control === "communicating" ? "Communicating" : "24-volt";
  return `${brand} ${s} · ${c}`;
}

export function seedPairingGroups(products: Product[]): PairingGroup[] {
  const map = new Map<string, PairingGroup>();
  for (const p of products) {
    if (!isPairableProduct(p)) continue;
    const brand = productBrand(p) || "Other";
    const series = inferPairingSeries(p);
    const control = inferPairingControl(p);
    const id = pairingGroupKey(brand, series, control);
    const g = map.get(id) || {
      id,
      label: defaultPairingLabel(brand, series, control),
      brand,
      series,
      control,
      productIds: [],
    };
    if (!g.productIds.includes(p.id)) g.productIds.push(p.id);
    map.set(id, g);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Drop new catalog SKUs into their default group without wiping owner edits. */
export function absorbNewPairableProducts(
  groups: PairingGroup[],
  products: Product[],
): PairingGroup[] {
  const assigned = new Set(groups.flatMap((g) => g.productIds));
  let next = groups.map((g) => ({ ...g, productIds: [...g.productIds] }));
  let changed = false;
  for (const p of products) {
    if (!isPairableProduct(p) || assigned.has(p.id)) continue;
    const brand = productBrand(p) || "Other";
    const series = inferPairingSeries(p);
    const control = inferPairingControl(p);
    const id = pairingGroupKey(brand, series, control);
    let g = next.find((x) => x.id === id);
    if (!g) {
      g = {
        id,
        label: defaultPairingLabel(brand, series, control),
        brand,
        series,
        control,
        productIds: [],
      };
      next = [...next, g];
    }
    if (!g.productIds.includes(p.id)) {
      g.productIds.push(p.id);
      changed = true;
    }
  }
  return changed ? next : groups;
}

type State = {
  groups: PairingGroup[];
  seeded: boolean;
  setGroups: (groups: PairingGroup[]) => void;
  ensureSeeded: (products: Product[]) => void;
  upsertGroup: (group: PairingGroup) => void;
  removeGroup: (id: string) => void;
  assignProduct: (productId: string, groupId: string | null) => void;
};

export const usePairingStore = create<State>()(
  persist(
    (set, get) => ({
      groups: [],
      seeded: false,
      setGroups: (groups) => set({ groups }),
      ensureSeeded: (products) => {
        if (!get().seeded || !get().groups.length) {
          set({ groups: seedPairingGroups(products), seeded: true });
          return;
        }
        const next = absorbNewPairableProducts(get().groups, products);
        if (next !== get().groups) set({ groups: next });
      },
      upsertGroup: (group) => {
        const list = get().groups.filter((g) => g.id !== group.id);
        set({ groups: [...list, group], seeded: true });
      },
      removeGroup: (id) =>
        set({ groups: get().groups.filter((g) => g.id !== id) }),
      assignProduct: (productId, groupId) => {
        const groups = get().groups.map((g) => ({
          ...g,
          productIds: g.productIds.filter((id) => id !== productId),
        }));
        if (groupId) {
          const i = groups.findIndex((g) => g.id === groupId);
          if (i >= 0) {
            groups[i] = {
              ...groups[i]!,
              productIds: [...groups[i]!.productIds, productId],
            };
          }
        }
        set({ groups, seeded: true });
      },
    }),
    {
      name: "aarvaks_pairing_groups_v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function pairingGroupForProduct(productId: string): PairingGroup | null {
  return (
    usePairingStore.getState().groups.find((g) =>
      g.productIds.includes(productId),
    ) || null
  );
}

export function productsInSamePairingGroup(
  productId: string,
): string[] | null {
  const g = pairingGroupForProduct(productId);
  return g ? g.productIds : null;
}
