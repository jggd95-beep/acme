/**
 * Points that must be true on the LIVE quote before an update counts.
 * Code on disk is not enough — the running preview + saved catalog
 * have to actually contain these, or Mike sees the old tool.
 */
import { BUILD_SAVE } from "./build-save-meta";

/** Matching indoor/outdoor SKUs that have already burned us when missing. */
export const REQUIRED_LIVE_SKUS = [
  "BOS-IDS-3",
  "BOS-BVA-3",
  "NAV-NAZ-3",
  "NAV-NAS-S-3",
  "NAV-NAS-V-3",
  "CAR-HP-3-COM",
  "CAR-AH-3-COM",
  "MIT-MS-12",
  "CAR-MS-INF-12",
] as const;

/** Strings that must be in the modules the preview is actually serving. */
export const REQUIRED_LIVE_MARKERS: {
  file: string;
  needle: string;
  why: string;
}[] = [
  {
    file: "/src/lib/build-save-meta.ts",
    needle: BUILD_SAVE.tag,
    why: "Quotes home stamp must be this save, not an old session",
  },
  {
    file: "/src/lib/quote-wizard.ts",
    needle: "sisterFillEligible",
    why: "Bosch / Navien indoor must follow the outdoor",
  },
  {
    file: "/src/lib/quote-wizard.ts",
    needle: "toggleMeasureBrand",
    why: "Both brands stay on for packages",
  },
  {
    file: "/src/components/ducted-filter-picker.tsx",
    needle: "filter-select-",
    why: "Filter first tap must stay on the filter question",
  },
  {
    file: "/src/lib/owner-settings.ts",
    needle: "contractorMarkupPct",
    why: "Owner can change asbestos/crane markup without Build",
  },
  {
    file: "/src/components/product-catalog.tsx",
    needle: "Shows on this measure",
    why: "New products must pick a measure or the walk will skip them",
  },
  {
    file: "/src/lib/domain/pricing-pipeline.ts",
    needle: "resolveOptionSellPrice",
    why: "Option dollars stay independent of the main GP pool",
  },
  {
    file: "/src/lib/ductless-materials.ts",
    needle: "ductlessCapacityBadge",
    why: "Ductless outdoor cards show Ideal · 100% / 75% · minimum, not a pile of Ideal fit",
  },
  {
    file: "/src/components/present-view.tsx",
    needle: "present-packet",
    why: "Present is the real packet, not an outline carousel",
  },
  {
    file: "/src/lib/equipment-scope-lead.ts",
    needle: "Sanden SANCO2",
    why: "Sanden must show as Sanden on the packet",
  },
];

export function missingRequiredSkus(
  products: { sku?: string | null }[],
): string[] {
  const have = new Set(
    products.map((p) => (p.sku || "").trim().toUpperCase()).filter(Boolean),
  );
  return REQUIRED_LIVE_SKUS.filter((s) => !have.has(s.toUpperCase()));
}
