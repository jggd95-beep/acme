import {
  createBlankProposal,
  productToLine,
  applyStandardMeasureOrder,
  type Product,
  type ProductOption,
  type Proposal,
  type ProposalQA,
  type QuoteLine,
  calcTotals,
  normalizeLine,
  LABOR_HOURS_BY_SKU,
  MATERIAL_COST_BY_SKU,
  buildTierUpgradeOptions,
  applyHomeSizingBenefit,
} from "./proposal-types";
import { isLockableEquipment, lockedEquipmentBenefits } from "./locked-benefits";
import {
  productMatchesTonnage,
  isDuctlessProduct,
  enforceSinglePadOnLines,
  isPadOption,
  isOutdoorPadHost,
  pickPadOwnerProductId,
  getPadMaterial,
  getPadLabor,
  getPadSell,
  padCustomerPrice,
  customConcretePadBody,
  getCustomConcretePadTitle,
  withLivePadCopy,
  makeConcretePadOption,
  foldStandalonePadIntoOwner,
} from "./equipment-catalog";
import {
  metricForFamily,
  productMatchesCapacity,
} from "./capacity-filter";
import { buildProposalWarrantyPage, rewriteBrandInText } from "./warranty";
import { buildAdvisorAuditReport } from "./advisor-audit";
import { getRebatesCatalogForProposal } from "./rebates-store";
import { applyRebateOverrides } from "./rebate-eligibility";
import { defaultExecutiveSummary } from "./brand-story";
import { packetPackagesForProposal } from "./packet-packages";
import {
  applyCompiledBenefits,
  collapsePadScopeLines,
  compileScopeAnswers,
  estimateScopeExtraSell,
  questionnaireForFamily,
  jobHasHybridHeat,
  DUCT_BUILD_QUESTION_IDS,
  isDuctOfferBuild,
  type ScopeAnswers,
} from "./scope-wizard";
import { resolveProductCircuit } from "./product-circuit";
import { resolveManufacturerLinks } from "./manufacturer-links";
import { customerInstallBlurb, customerInstallName, equipmentCloseLine, equipmentLeadLines, familyGetsEquipmentLead, familyInstallNoun, packetFaceTitle } from "./equipment-scope-lead";
import { inferZoneMfr, zoningPacketBenefits, collapseZoningScopeLines } from "./zoning-scope";
import { fanHasSelectableCfm } from "./bath-fan-sizing";
import { electricalJobTitle, electricalCircuitOverride } from "./electrical-job";
import { jobPathCompileExcludeIds } from "./job-path";
import { accessoriesForInstance, offeredFollowUpQuestionIds, offeredOptionQuestionIds, padModeFromInstance, PAD_FOLLOW_UP_IDS } from "./accessories";
import { resolveProductPhotoUrl, shouldShowProductPhoto } from "./product-photos";
import { sameDuctlessOneToOneSize, isDuctlessOneToOneZones, DUCTLESS_HEAD_ROOMS } from "./ductless-materials";
import {
  contractorSellFromCost,
  getOwnerPricingSnapshot,
} from "./owner-settings";
import {
  ensureDuctedCompanionsOnQuote,
  isDuctedEquipmentHost,
  withNewDuctsOption,
  NEW_DUCTS_OPTION_ID,
} from "./ductwork";
import {
  HP_CONVERSION_GUIDE_SKU,
  HPWH_EXPECT_SKU,
  preferredSkusForHeatingPath,
  type HeatingPath,

  HEATING_PATH_OPTIONS,
} from "./heating-path";
import {
  DEFAULT_LABOR_RATE,
  DEFAULT_LABOR_DIVISOR,
  DEFAULT_MATERIAL_DIVISOR,
  autoUnitPrice,
} from "./pricing";
import {
  resolveMeasureSellPrice,
  resolveOptionSellPrice,
  clampAdditive,
  alternateLiveDelta,
} from "./domain/pricing-pipeline";
import { formatMeasureTitle } from "./title-case";
import { composeInstallPlacement } from "./install-placement";
import {
  DEFAULT_DOC_REQUESTS,
  defaultMeasureLanguage,
  productBrand,
  canonicalizeBrand,
  matchesHpInstallPath,
  sameInstallFoundation,
  detectWaterHeaterStyle,
  detectHumidifierKind,
  detectWhVentKind,
  detectFurnaceEffStyle,
  isExcludedWaterHeaterProduct,
  productCapacityValue,
} from "./session-filters";
import { productsInSamePairingGroup } from "./pairing-store";
import {
  effectiveStaging,
  filterProductsByPartnerStaging,
  filterTierUpgradesForPartners,
  matchingTierUpgradeId,
  partnerFamiliesFor,
  productStaging,
  stagingLabel,
  type EquipmentStaging,
} from "./equipment-staging";

export type MeasurePickRole = "included" | "optional";

export type MeasureFamilyId =
  | "heat_pump"
  | "air_handler"
  | "coil"
  | "furnace"
  | "ac"
  | "ductless"
  | "package_unit"
  | "air_filter"
  | "air_cleaner"
  | "humidifier"
  | "dehumidifier"
  | "water_heater"
  | "wall_heater"
  | "permits"
  | "hers"
  /** Retired walk family — stripped on hydrate. Incentives are a wizard page. */
  | "rebates"
  | "load_calc"
  | "thermostat"
  | "ductwork"
  | "zoning"
  | "install"
  | "maintenance"
  | "conversion_guide"
  | "hpwh_guide"
  | "custom"
  /** Odds & ends — small one-offs */
  | "gas_line"
  | "single_duct"
  | "flue"
  | "electrical_disconnect"
  | "electrical"
  | "condensate"
  | "sheet_metal"
  | "hrv"
  | "attic_ladder"
  | "attic_platform"
  | "ev_charger"
  | "range_hood"
  | "attic_vent"
  | "bath_fan"
  | "seismic_valve"
  | "sub_asbestos"
  | "sub_crane";

export type MeasureInstance = {
  id: string;
  familyId: MeasureFamilyId;
  label: string;
  productId: string | null;
  role: MeasurePickRole;
  packetTitle?: string;
  benefits?: string[];
  workScope?: string;
  /** Advisor edited the live compiled scope — do not overwrite. */
  workScopeTouched?: boolean;
  description?: string;
  /** Custom measure: base material cost (advisor sets) */
  customMaterialCost?: number;
  /** Custom measure: base labor hours (advisor sets) */
  customLaborHours?: number;
  /**
   * Multi-zone / mini-split indoor head locations (one line per head).
   * Printed on the customer packet work scope.
   */
  headLocations?: string[];
  /**
   * Where large equipment is sold to be installed (session UX → MASTER).
   * Drives measure title + packet wording.
   */
  installLocationPreset?: string | null;
  installLocationDetail?: string;
  /** Cached composed placement string for title/packet */
  installLocationLabel?: string;
  /**
   * Session UX (2026-08-09/10): per-measure size chips (multi-select).
   * Tons / kBTU / gallons depending on family metric.
   */
  selectedCapacities?: number[];
  /** Manufacturer multi-select — every tapped brand is offered as a package. */
  selectedBrands?: string[];
  /** When true, show all brands in current size band */
  allBrandsInSize?: boolean;
  /**
   * Water heater path filter: gas-tank | electric-tank | hybrid | tankless | null (all)
   */
  waterHeaterStyle?: string | null;
  /** Honeywell humidifier path: flow-through (bypass/powered) vs steam vs both as options */
  humidifierKind?: "flow" | "steam" | "both" | null;
  /** Water heater only — like-for-like / full pack / relocate / all new */
  whJobType?:
    | "like_for_like"
    | "full_pack"
    | "relocate_5"
    | "relocate"
    | "all_new"
    | null;
  /** Gas equipment: natural gas (default) or propane. Background — not a path question. */
  gasFuel?: "ng" | "lp" | null;
  /**
   * Heat pump / outdoor path (session UX): conventional 24V vs mini/multi-split.
   * Options stay on the same path; other path = comparison package.
   */
  hpInstallPath?: "conventional" | "mini-split" | null;
  /** Ductless path: "1" one-to-one · "2"–"5" multi · "8" Mitsubishi hub */
  ductlessZones?: string | null;
  ductlessHeadKbtus?: number[] | null;
  /** Per-brand indoor kBTU when both Carrier and Mitsubishi are on the job. */
  ductlessHeadKbtusMitsubishi?: number[] | null;
  ductlessHeadKbtusCarrier?: number[] | null;
  /** Room id per head — so Head 1 stays “Living” after they leave the page. */
  ductlessHeadRooms?: string[] | null;
  /** Custom room names when the chip is Custom. */
  ductlessHeadRoomNames?: (string | null)[] | null;
  /** high_wall / low_wall / one_way / slim_duct per head */
  ductlessHeadStyles?: string[] | null;
  /** Which indoor card Previous reopened. Values stay. */
  ductlessHeadEdit?: number | null;
  /** Show outdoor units sized for a future extra head. */
  ductlessShowLarger?: boolean | null;
  jobPath?: "replace" | "new_location" | "contractor" | null;
  /** Bath fan — CFM after the room-size helper (50 / 80 / 110). */
  bathCfm?: number | null;
  bathCfmSkipped?: boolean;
  bathLengthFt?: number | null;
  bathWidthFt?: number | null;
  bathHeightFt?: number | null;
  /** Zoning — 2 through 8, picked before the catalog. */
  zoneCount?: number | null;
  /** HRV / ERV sizer — before the catalog. */
  hrvKind?: "erv" | "hrv" | null;
  hrvSqft?: number | null;
  hrvBeds?: number | null;
  /** Optional kit cards (drain pan, stand, DV ext…) — confirmed after location */
  accessoryPicks?: string[];
  /** Upgrade cards offered on the packet (after core units) — not in the sold scope. */
  accessoryOffers?: string[];
  accessoriesConfirmed?: boolean;
  /**
   * Unit picked, then Continue — location / job type / questions stay hidden
   * until the advisor confirms this unit.
   */
  equipmentConfirmed?: boolean;
  /**
   * Package-seeded path link (heat pump + air handler from same job package).
   * Same id → path changes sync. +Add measure leaves this null.
   */
  pathLinkGroupId?: string | null;
  /** Advisor overrode path on this measure — stop syncing. */
  pathLinkUnlinked?: boolean;
  /** Williams wall heater vent path */
  wallVentStyle?: "top_vent" | "direct_vent" | "counterflow" | "rinnai" | null;
  /** Furnace efficiency path: 80% / 90%+ / ULN / Navien NPF */
  furnaceEffStyle?:
    | "standard_80"
    | "high_eff"
    | "uln_80"
    | "uln_high"
    | "navien_npf"
    | null;
  /** Navien NPF cabinet — upflow / downflow / horizontal L or R */
  furnaceCabinetStyle?:
    | "upflow"
    | "downflow"
    | "horizontal_left"
    | "horizontal_right"
    | null;
  /** Customer-facing measure language (edit + preview) */
  measureLanguage?: string;
  /** Extra labor lines */
  laborLines?: { id: string; label: string; hours: number; notes: string }[];
  /** Output document request flags */
  documentRequests?: { id: string; label: string; requested: boolean }[];
  scopeAnswers?: import("./scope-wizard").ScopeAnswers;
  /**
   * Field hold — advisor paused mid-path (phone call / missing answer).
   */
  fieldHold?: boolean;
  fieldHoldNote?: string;
  /**
   * Site-question chrome only. v2 = Previous, no green stack, last tap leaves.
   * Same questions, products, and customer packet as classic. Never printed.
   */
  advisorFlow?: "classic" | "v2";
  /**
   * Reopen a finished walk stage (Back / rail). Answers stay.
   * Later stages are not wiped — Continue either returns to
   * `advisorResume` (no change) or walks only what the change broke.
   */
  advisorReopen?:
    | "style"
    | "zones"
    | "brand"
    | "heads"
    | "head_room"
    | "head_site"
    | "size"
    | "unit"
    | "location"
    | "filter"
    | "extras"
    | "path"
    | "demo"
    | "cabinet"
    | "site"
    | null;
  /**
   * Where they were when they started backing up. Continue after an
   * unchanged earlier page jumps here instead of re-walking the quote.
   */
  advisorResume?: {
    stage: NonNullable<MeasureInstance["advisorReopen"]>;
    siteQid?: string;
    headEdit?: number | null;
  } | null;
  /** Advisor override sell price for this quote (null = catalog). */
  priceOverride?: number | null;
  /** Advisor override labor hours for this quote (null = catalog). */
  laborHoursOverride?: number | null;
  /** Flat extra sell dollars added on top of catalog + site extras. */
  extraSell?: number | null;
  /**
   * Package mark for field UX:
   * gold = optional package-eligible · red = forced package split · none
   */
  packageMark?: "none" | "gold" | "red";
  /** Field photos from Work mode / the ask stamp. Stay on the quote. */
  workShots?: { id: string; dataUrl: string; label: string; at: number }[];
};

export type PackageRule = "none" | "eligible" | "forced";

/** Catalog / name fallback when owner hasn't set packageRule. */
export function inferPackageRule(
  p: Pick<Product, "name" | "sku" | "familyId" | "packageRule" | "requiresTpValve">,
): PackageRule {
  if (p.packageRule === "forced" || p.packageRule === "eligible" || p.packageRule === "none") {
    return p.packageRule;
  }
  if (p.requiresTpValve) return "forced";
  const blob = `${p.name} ${p.sku || ""} ${p.familyId || ""}`.toLowerCase();
  if (
    /nav-npf|npf700|navien-npf|nav-nhb|nav-nfb|navien-boiler/.test(blob)
  ) {
    return "forced";
  }
  return "none";
}

/** In-card Option is illegal when one unit is a forced split and the other isn't. */
export function canOfferAsInCardOption(
  main: Parameters<typeof inferPackageRule>[0],
  other: Parameters<typeof inferPackageRule>[0],
): boolean {
  const a = inferPackageRule(main);
  const b = inferPackageRule(other);
  if (a === "forced" && b !== "forced") return false;
  if (b === "forced" && a !== "forced") return false;
  return true;
}

export type MeasureFamilyDef = {
  id: MeasureFamilyId;
  label: string;
  blurb: string;
  live: boolean;
  defaultOn?: boolean;
  /** When this measure is on the job, auto-add the Permits line. */
  requiresPermit?: boolean;
};

export const MEASURE_FAMILIES: MeasureFamilyDef[] = [
  { id: "heat_pump", label: "Heat pump (ducted)", blurb: "Carrier / Bosch outdoor heat pumps — not mini-splits", live: true, requiresPermit: true },
  { id: "air_handler", label: "Air handler / fan coil", blurb: "Indoor match for ducted heat pumps — coil is already in this unit", live: true, requiresPermit: true },
  { id: "coil", label: "Coil", blurb: "Cased coil on a furnace — not an air handler", live: true, requiresPermit: true },
  { id: "furnace", label: "Furnace", blurb: "Gas furnace equipment", live: true, defaultOn: true, requiresPermit: true },
  { id: "ac", label: "Air conditioner", blurb: "Cooling-only outdoor units", live: true, defaultOn: true, requiresPermit: true },
  { id: "ductless", label: "Ductless / mini-split", blurb: "Carrier + Mitsubishi ductless · single & multi-zone", live: true, requiresPermit: true },
  { id: "package_unit", label: "Package unit", blurb: "Roof / grade package — foundation started, stays dark", live: false, requiresPermit: true },
  { id: "air_cleaner", label: "Air filter / media", blurb: "AprilAire media air cleaners & filters", live: true },
  { id: "humidifier", label: "Humidifier", blurb: "Honeywell whole-home humidifiers", live: true },
  { id: "dehumidifier", label: "Dehumidifier", blurb: "Honeywell TrueDRY whole-home", live: true },
  { id: "water_heater", label: "Water heater", blurb: "Tankless & storage", live: true },
  { id: "wall_heater", label: "Wall heaters", blurb: "Top-vent · direct-vent · counterflow — NG", live: true },
  { id: "load_calc", label: "Load calculation", blurb: "Manual J / sizing technology", live: true, defaultOn: true },
  { id: "thermostat", label: "Thermostat", blurb: "Controls & smart stats", live: true },
  { id: "ductwork", label: "Ductwork", blurb: "Reconnect, tune-up, or replace — HERS / required CFM", live: true },
  { id: "zoning", label: "Zoning", blurb: "Honeywell 3–4 zone · Carrier Infinity 2–8 zone", live: true },
  { id: "install", label: "Installation & startup", blurb: "Labor package line — retired; hours live on each measure", live: false },
  { id: "permits", label: "Permits", blurb: "City / county permit package", live: true, defaultOn: true },
  { id: "hers", label: "HERS testing", blurb: "Bay Area Title 24 duct & refrigerant tests", live: true },
  { id: "maintenance", label: "Maintenance plan", blurb: "Service agreements", live: true },
  { id: "conversion_guide", label: "Heat pump conversion language", blurb: "Free expectation language — not a priced measure", live: true },
  { id: "hpwh_guide", label: "Heat pump water heater language", blurb: "Recovery & expectation language when HPWH is on the job", live: true },
  { id: "sub_asbestos", label: "Asbestos removal", blurb: "Licensed abatement — we hire them, enter what they charge us", live: true },
  { id: "sub_crane", label: "Crane / lift", blurb: "Independent crane company — enter what they charge us", live: true },
  { id: "custom", label: "Custom measure", blurb: "Write your own title, benefits, scope + labor/materials", live: true },
  // Odds & ends — not auto-bundled with majors
  { id: "gas_line", label: "Gas line", blurb: "New or extended gas piping for furnace, WH, or range — sized to code", live: true },
  { id: "single_duct", label: "Single duct run", blurb: "One supply or return run — not full-home duct redesign", live: true },
  { id: "flue", label: "Flue / vent work", blurb: "Flue pipe, B-vent, or vent modifications for gas appliances", live: true },
  { id: "electrical_disconnect", label: "Electrical disconnect", blurb: "Outdoor disconnect / whip for condenser or heat pump", live: true },
  { id: "electrical", label: "Electrical", blurb: "New circuit, GFCI, light and switch, or sub panel — not the outdoor disconnect", live: true },
  { id: "condensate", label: "Condensate drain", blurb: "Primary/secondary drain, pump, or line set drainage", live: true },
  { id: "sheet_metal", label: "Sheet metal / plenum", blurb: "Plenum, transition, or small fab for the install", live: true },
  { id: "hrv", label: "Heat / energy recovery", blurb: "Honeywell TrueFRESH HRV or ERV — fresh air for the house", live: true },
  { id: "attic_ladder", label: "Pull-down attic ladder", blurb: "Werner — Home Depot stocked", live: true },
  { id: "attic_platform", label: "Elevated attic platform", blurb: "Service platform / walk boards at equipment", live: true },
  { id: "ev_charger", label: "Car charger", blurb: "Level 2 EV charger or 14-50 receptacle", live: true },
  { id: "range_hood", label: "Range hood install", blurb: "Hood supplied by owner — we install & duct", live: true },
  { id: "attic_vent", label: "Attic ventilation", blurb: "Soffit / ridge / powered gable", live: true },
  { id: "bath_fan", label: "Bath fan", blurb: "Panasonic Whisper — Select, Ceiling, Sense", live: true },
  { id: "seismic_valve", label: "Earthquake shutoff", blurb: "QuakeValve / excess-flow — Ferguson stock", live: true },
];


/** Majors that passed packet + live click (zones/brand/units/back). */
export const STAMPED_READY_FAMILY_IDS: MeasureFamilyId[] = [
  "heat_pump",
  "air_handler",
  "ductless",
  "furnace",
  "ac",
  "water_heater",
  "wall_heater",
];

export function isMeasureStampedReady(id: MeasureFamilyId): boolean {
  return STAMPED_READY_FAMILY_IDS.includes(id);
}

/** Large equipment / primary sellables — big buttons */
export const MAJOR_MEASURE_IDS: MeasureFamilyId[] = [
  "heat_pump",
  "air_handler",
  "coil",
  "furnace",
  "ac",
  "ductless",
  "water_heater",
  "wall_heater",
  "hrv",
  "package_unit",
];

/** Everyday smalls — chips always visible */
export const SMALL_MEASURE_IDS: MeasureFamilyId[] = [
  "thermostat",
  "air_cleaner",
  "humidifier",
  "dehumidifier",
  "ductwork",
  "zoning",
  "load_calc",
  "permits",
  "hers",
  "maintenance",
  "conversion_guide",
  "hpwh_guide",
  "custom",
  "electrical",
  "sub_asbestos",
  "sub_crane",
];

/** True odds & ends — collapsed by default, not in your face */
export const ODDS_ENDS_MEASURE_IDS: MeasureFamilyId[] = [
  "gas_line",
  "single_duct",
  "flue",
  "electrical_disconnect",
  "condensate",
  "sheet_metal",
  "attic_ladder",
  "attic_platform",
  "ev_charger",
  "range_hood",
  "attic_vent",
  "bath_fan",
  "seismic_valve",
];

/** Not work-scope. On the quote — permit, load, HERS, packet language. */
export const QUOTE_RELATED_IDS: MeasureFamilyId[] = [
  "permits",
  "load_calc",
  "hers",
  "conversion_guide",
  "hpwh_guide",
];

/** Independent companies we hire. Advisor enters what they charge us. */
export const CONTRACTOR_SUPPLIED_IDS: MeasureFamilyId[] = [
  "sub_asbestos",
  "sub_crane",
];

export function isQuoteRelatedFamily(
  id: string | null | undefined,
): boolean {
  return QUOTE_RELATED_IDS.includes(id as MeasureFamilyId);
}

export function isContractorSuppliedFamily(
  id: string | null | undefined,
): boolean {
  return CONTRACTOR_SUPPLIED_IDS.includes(id as MeasureFamilyId);
}

export function contractorPacketCopy(family: MeasureFamilyId): {
  title: string;
  description: string;
  benefits: string[];
  workScope: string;
} {
  if (family === "sub_asbestos") {
    return {
      title: "Asbestos abatement (licensed contractor)",
      description:
        "A licensed asbestos contractor removes the material so our crew can work safely.",
      benefits: [
        "Licensed abatement — a separate trade, not our install crew",
        "Scheduled so the rest of the job can proceed",
      ],
      workScope:
        "A licensed asbestos contractor removes the material so our crew can work safely. This is a separate licensed trade, scheduled with your install.",
    };
  }
  return {
    title: "Crane / lift (independent company)",
    description:
      "A licensed crane company sets the equipment. We schedule and coordinate the lift.",
    benefits: [
      "Independent crane company",
      "We schedule and coordinate with your install day",
    ],
    workScope:
      "A licensed crane company sets the equipment. We schedule and coordinate the lift with your install day.",
  };
}

export function measureFamilyGroup(
  id: MeasureFamilyId,
): "major" | "small" | "odds" | "other" {
  if (MAJOR_MEASURE_IDS.includes(id)) return "major";
  if (ODDS_ENDS_MEASURE_IDS.includes(id)) return "odds";
  if (SMALL_MEASURE_IDS.includes(id)) return "small";
  return "other";
}

export function jobHasMajorOnJob(
  answers?: WizardAnswers | null,
): boolean {
  return (answers?.measureInstances || []).some((m) =>
    MAJOR_MEASURE_IDS.includes(m.familyId),
  );
}

export type WizardStepId =
  | "deal"
  | "situation"
  | "measure_types"
  | "package"
  | "commercials"
  | "story"
  | "order"
  | "incentives"
  | "review";

export const WIZARD_STEPS: { id: WizardStepId; title: string; blurb: string; effort: string }[] = [
  { id: "deal", title: "Customer", blurb: "Who + job context", effort: "~45 sec" },
  { id: "situation", title: "Job builder", blurb: "Packages + extra measures", effort: "~1 min" },
  { id: "measure_types", title: "Measures", blurb: "List, optional, open to build", effort: "~30 sec" },
  { id: "package", title: "Equipment", blurb: "Models, optional, options", effort: "~3 min" },
  { id: "commercials", title: "Commercials", blurb: "Start, payment, discounts", effort: "~1 min" },
  {
    id: "order",
    title: "Order",
    blurb: "Arrange measures top → bottom on the packet",
    effort: "~30 sec",
  },
  {
    id: "incentives",
    title: "Rebates & discounts",
    blurb: "Buybacks and programs for this job — nothing is on until you tap",
    effort: "~30 sec",
  },
  { id: "story", title: "Intro", blurb: "Opening language for the packet — edit if you want", effort: "~1 min" },
  { id: "review", title: "Review", blurb: "Prices, PDF, packet preview", effort: "preview" },
];

/**
 * Field hub pills — always the same seven stops so the advisor can jump
 * to Measures, Rebates, and Intro from any quote.
 */
export const WIZARD_HUB_PILLS: {
  label: string;
  stepIds: WizardStepId[];
}[] = [
  { label: "Customer", stepIds: ["deal"] },
  { label: "Build", stepIds: ["situation"] },
  { label: "Measures", stepIds: ["measure_types"] },
  { label: "Walk", stepIds: ["package"] },
  { label: "Rebates", stepIds: ["incentives"] },
  { label: "Intro", stepIds: ["story"] },
  { label: "Preview", stepIds: ["review", "order", "commercials"] },
];

export function hubIndexForStepId(
  stepId: WizardStepId,
  pills: typeof WIZARD_HUB_PILLS = WIZARD_HUB_PILLS,
): number {
  const i = pills.findIndex((h) => h.stepIds.includes(stepId));
  return i < 0 ? 0 : i;
}

export function stepIdxForHub(
  hubIdx: number,
  pills: typeof WIZARD_HUB_PILLS = WIZARD_HUB_PILLS,
): number {
  const hub = pills[hubIdx];
  if (!hub) return 0;
  const prefer =
    hub.label === "Preview" || hub.label === "Present" ? "review" : hub.stepIds[0];
  const id = hub.stepIds.includes(prefer) ? prefer : hub.stepIds[0];
  const i = WIZARD_STEPS.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

export function hubPillsFor(_answers?: WizardAnswers): typeof WIZARD_HUB_PILLS {
  return WIZARD_HUB_PILLS;
}

export function familyRequiresPermit(id: string): boolean {
  const factory = Boolean(
    MEASURE_FAMILIES.find((f) => f.id === id)?.requiresPermit,
  );
  if (typeof window === "undefined") return factory;
  try {
    const raw = window.localStorage.getItem("aarvaks_measure_families_v1");
    if (!raw) return factory;
    const parsed = JSON.parse(raw) as {
      state?: { overrides?: Record<string, { requiresPermit?: boolean }> };
    };
    const ov = parsed.state?.overrides?.[id]?.requiresPermit;
    if (typeof ov === "boolean") return ov;
  } catch {
    /* factory */
  }
  return factory;
}

export const PROPERTY_OPTIONS = [
  { id: "single_family", label: "Single family" },
  { id: "townhome", label: "Townhome" },
  { id: "condo", label: "Condo" },
  { id: "multi", label: "Multi-unit" },
];
export const SIZE_OPTIONS = [
  { id: "under_1200", label: "Under 1,200 sf" },
  { id: "1200_1800", label: "1,200–1,800 sf" },
  { id: "1800_2500", label: "1,800–2,500 sf" },
  { id: "2500_3500", label: "2,500–3,500 sf" },
  { id: "over_3500", label: "Over 3,500 sf" },
];
export const GOAL_OPTIONS = [
  { id: "replace_ac", label: "Replace AC" },
  { id: "replace_furnace", label: "Replace furnace" },
  { id: "heat_pump", label: "Heat pump" },
  { id: "hp_conversion", label: "Gas → heat pump" },
  { id: "ductless", label: "Ductless / mini-split" },
  { id: "iaq", label: "Indoor air quality" },
  { id: "water_heater", label: "Water heater" },
  { id: "wall_heater", label: "Wall heaters" },
  { id: "custom", label: "Custom measure" },
  { id: "comfort_club", label: "Maintenance plan" },
];
export const URGENCY_OPTIONS = [
  { id: "emergency", label: "Down now" },
  { id: "soon", label: "This month" },
  { id: "planning", label: "Planning" },
  { id: "bid", label: "Comparing bids" },
];
export const ISSUE_OPTIONS = [
  { id: "no_cool", label: "No cooling" },
  { id: "no_heat", label: "No heat" },
  { id: "high_bills", label: "High bills" },
  { id: "noise", label: "Noise" },
  { id: "age", label: "Old equipment" },
  { id: "comfort", label: "Uneven comfort" },
  { id: "iaq", label: "Dust / air quality" },
];
export const BUDGET_OPTIONS = [
  { id: "unknown", label: "Unknown" },
  { id: "value", label: "Value" },
  { id: "mid", label: "Mid" },
  { id: "premium", label: "Premium" },
  { id: "open", label: "Open" },
];
export const DECISION_OPTIONS = [
  { id: "homeowner", label: "Homeowner" },
  { id: "couple", label: "Couple / partners" },
  { id: "landlord", label: "Landlord" },
  { id: "other", label: "Other" },
];
export const START_OPTIONS = [
  { id: "asap", label: "ASAP" },
  { id: "2_weeks", label: "Within 2 weeks" },
  { id: "month", label: "This month" },
  { id: "flexible", label: "Flexible" },
];
export const PAYMENT_OPTIONS = [
  { id: "check", label: "Check / cash" },
  { id: "card", label: "Card" },
  { id: "financing", label: "Financing" },
  { id: "pace", label: "PACE" },
];

export type FaqItem = {
  id: string;
  question: string;
  answer: (a: WizardAnswers) => string;
};

export const FAQ_BANK: FaqItem[] = [
  {
    id: "faq_timeline",
    question: "How long does install take?",
    answer: () =>
      "Most change-outs are 1–2 days after equipment arrives and permits are ready.",
  },
  {
    id: "faq_permit",
    question: "Do you pull permits?",
    answer: () =>
      "Yes — Acme HVAC handles city/county mechanical permits for the Included measures.",
  },
  {
    id: "faq_warranty",
    question: "What about warranty?",
    answer: () =>
      "Manufacturer parts warranties (e.g. Carrier 10-year) plus Acme HVAC labor — 3 years on major equipment, 2 years on thermostats, 1 year on wall heaters. Full detail is on the warranty page of this packet. In California, registration is not required.",
  },
];

export type WizardAnswers = {
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  clientPhone?: string;
  propertyStreet?: string;
  propertyCity?: string;
  propertyZip?: string;
  propertyCounty?: string;
  /** Customer-facing quote version (V1, V2…) — not the storage schema. */
  quoteVersion?: number;
  propertyType: string;
  homeSize: string;
  goals: string[];
  urgency: string;
  issues: string[];
  budgetBand: string;
  decisionMakers: string;
  customNotes: string;
  heatingPath: HeatingPath;
  selectedMeasureFamilies: MeasureFamilyId[];
  measureInstances: MeasureInstance[];
  coreProductIds: string[];
  optionalProductIds: string[];
  optionalPreselectedIds: string[];
  optionSelections: Record<string, string[]>;
  /** Custom concrete pad: off | included in package | optional for customer */
  padMode?: "off" | "included" | "optional";
  measureAdjustments: Record<
    string,
    { extraLaborHours: number; extraMaterialCost: number }
  >;
  systemTonnage: number;
  /**
   * Capacity chips (BTU / gallons) — parallel to systemTonnage for non-ton equipment.
   * Wall heaters + furnaces use systemBtu; water heaters use systemGallons.
   * CAPACITY FILTER — do not remove without owner approval (see capacity-filter.ts).
   */
  systemBtu?: number | null;
  systemGallons?: number | null;
  /**
   * Exclusive Job goal chip id (Situation step). Independent of goals[] so
   * clear/unselect always works. Null = none selected.
   */
  activeJobGoalId?: string | null;
  startWindow: string;
  paymentTerms: string;
  /** Pay-by-check post-cost % (deferred; default 2) */
  checkDiscountPercent: number;
  discountPercent: number;
  /**
   * Rebates selected for this quote (from Backend catalog, location-filtered).
   * Advisor picks before finish; overrides adjust $ for buybacks etc.
   */
  selectedRebateIds?: string[];
  /** Per-rebate amount override (fixed $ or percent value) */
  rebateAmountOverrides?: Record<string, number>;
  /** Show line $ on packet vs "Included" for package measures */
  showMeasurePrices: boolean;
  /**
   * Customer packet measure order (measure instance ids).
   * Holds until sales reorders or measures are added/removed (new ones append).
   */
  measureOrder?: string[];
  /**
   * Scroll/focus target on Equipment step when a measure is added mid-quote.
   * Cleared after the UI jumps to the card.
   */
  focusMeasureId?: string | null;
  /**
   * Comparison packages A/B + either/or groups (Package builder foundation).
   * Flat hub until enabled; sticky totals only when packages exist.
   */
  packageBuilder?: import("./package-builder").PackageBuilderState;
  /** True = classic measure list, no snapshot. Ignored on forced comparison. */
  hideQuoteSnapshot?: boolean;
  /** Customer-chosen package outdoor SKU from the compare board. */
  selectedPackageKey?: string | null;
  /**
   * Advisor turned HERS off. Do not auto-add it back on later toggles.
   * Tapping HERS on clears this.
   */
  hersAdvisorOff?: boolean;
  /** Whole connected duct system is under 40 linear feet. */
  hersShortSystem?: boolean | null;
  /** Verifiable asbestos in the existing ducts. */
  hersAsbestos?: boolean | null;
  includeTax: boolean;
  taxRate: number;
  executiveSummary: string;
  scope: string;
  timeline: string;
  includedFaqIds: string[];
};

function tonnageFromHomeSize(size: string): number {
  if (size === "under_1200") return 2;
  if (size === "1200_1800") return 2.5;
  if (size === "1800_2500") return 3;
  if (size === "2500_3500") return 3.5;
  if (size === "over_3500") return 4;
  return 3;
}

function ridInst() {
  return `mi_${Math.random().toString(36).slice(2, 10)}`;
}

export function familyLabel(family: MeasureFamilyId): string {
  return MEASURE_FAMILIES.find((f) => f.id === family)?.label || family;
}

/** Advisor-facing name — never brand-prefix the family (e.g. not “Williams wall heaters”). */
export function publicMeasureLabel(inst: {
  familyId: string;
  label?: string | null;
}): string {
  const raw = (inst.label || "").trim();
  if (inst.familyId === "wall_heater") {
    const stripped = raw.replace(/^Williams\s+/i, "").trim();
    if (!stripped || /^wall heaters?(\s+\d+)?$/i.test(stripped)) {
      return "Wall heaters";
    }
    return stripped.replace(/^wall heaters?/i, "Wall heaters").trim();
  }
  return raw || familyLabel(inst.familyId as MeasureFamilyId);
}

export function labelForInstance(
  family: MeasureFamilyId,
  index1Based: number,
  placementLabel?: string | null,
): string {
  const base = familyLabel(family)
    .replace(/\s*\(ducted\)/i, "")
    .replace(/\s*\/\s*mini-split/i, "")
    .trim();
  // Prefer clean "Wall heater" when only one of that family (no trailing " 1")
  const core = index1Based <= 1 ? base : `${base} ${index1Based}`;
  const place = (placementLabel || "").trim();
  return place ? `${core} · ${place}` : core;
}

/** UI helper — drop trailing " 1" when this is the sole instance of its family. */
export function cleanMeasureDisplayLabel(
  label: string | null | undefined,
  soleOfFamily: boolean,
): string {
  const t = (label || "").trim();
  if (!t) return t;
  if (soleOfFamily) return t.replace(/\s+1$/, "").trim();
  return t;
}

export function waterHeaterPathName(
  style: string | null | undefined,
): string {
  if (style === "hybrid") return "Heat pump water heater";
  if (style === "sanden-split") return "Sanden water heater";
  if (style === "tankless") return "Tankless water heater";
  if (style === "he-gas") return "High-efficiency gas water heater";
  if (style === "electric-tank") return "Electric tank water heater";
  if (style === "gas-tank") return "Gas tank water heater";
  return "Water heater";
}

export function measureShortName(inst: {
  familyId: string;
  label?: string | null;
  waterHeaterStyle?: string | null;
}): string {
  if (inst.familyId === "water_heater") {
    return waterHeaterPathName(inst.waterHeaterStyle);
  }
  const fromLabel = cleanMeasureDisplayLabel(inst.label, true);
  const noPlace = (fromLabel || "").replace(/\s*·\s*.+$/, "").trim();
  const raw = (noPlace || familyLabel(inst.familyId as MeasureFamilyId))
    .replace(/\s*\(ducted\)/i, "")
    .replace(/\s*\/\s*mini-split/i, "")
    .replace(/heaters$/i, "heater")
    .trim();
  return raw || "This measure";
}

export function measureStageEyebrow(
  inst: { familyId: string; label?: string | null },
  stage: string,
): string {
  const name = measureShortName(inst).toUpperCase();
  if (!stage || stage === "Measure" || stage === "Job") return name;
  return `${name} · ${stage}`.toUpperCase();
}

/** Advisor-facing title on On this job / Continue. */
export function fieldMeasureTitle(inst: MeasureInstance): string {
  if (inst.familyId === "water_heater" && inst.waterHeaterStyle === "hybrid") {
    return "Heat pump water heater";
  }
  if (inst.familyId === "electrical") {
    return electricalJobTitle(inst);
  }
  return (
    inst.label ||
    MEASURE_FAMILIES.find((f) => f.id === inst.familyId)?.label ||
    inst.familyId
  );
}

export const MULTI_INSTANCE_FAMILIES = new Set<MeasureFamilyId>([
  "bath_fan",
  "furnace",
  "water_heater",
  "wall_heater",
  "heat_pump",
  "ac",
  "air_handler",
  "ductless",
  "electrical",
  "humidifier",
]);

export function familyAllowsMultiple(family: MeasureFamilyId): boolean {
  return MULTI_INSTANCE_FAMILIES.has(family);
}

export const LINE_SET_QUESTION_IDS = [
  "line_set",
  "line_set_roll",
  "line_set_diff",
  "line_set_run",
  "line_set_pen",
  "line_set_pen_qty",
  "line_set_pen_qty_wood",
  "line_set_pen_qty_stucco",
  "line_set_pen_qty_brick",
  "line_set_holes",
  "line_set_cover",
] as const;

export function siblingOwnsLineSet(
  inst: MeasureInstance,
  answers?: WizardAnswers | null,
): boolean {
  if (inst.familyId !== "air_handler" && inst.familyId !== "furnace")
    return false;
  return (answers?.measureInstances || []).some(
    (m) =>
      m.id !== inst.id &&
      (m.familyId === "heat_pump" ||
        m.familyId === "ac" ||
        m.familyId === "ductless"),
  );
}

/** Heat pump, ductless, furnace, AC, water heater — New vs Classic side by side. */
export const FLOW_COMPARE_FAMILY_IDS: MeasureFamilyId[] = [
  "heat_pump",
  "ductless",
  "furnace",
  "ac",
  "water_heater",
];

export type AdvisorQuestionFlow = "classic" | "v2";

export function instanceAdvisorFlow(
  inst: Pick<MeasureInstance, "advisorFlow" | "familyId"> | null | undefined,
): AdvisorQuestionFlow {
  return "v2";
}

export function isV2AdvisorFlow(
  inst: Pick<MeasureInstance, "advisorFlow" | "familyId"> | null | undefined,
): boolean {
  return true;
}

/** Only the new walk. Classic compare chips are gone. */
export function jobUsesNewWalk(answers: WizardAnswers): boolean {
  return true;
}

export function flowCompareChipLabel(
  family: MeasureFamilyId,
  flow: AdvisorQuestionFlow,
): string {
  const base =
    family === "ductless"
      ? "Ductless"
      : family === "heat_pump"
        ? "Heat pump"
        : family === "water_heater"
          ? "Water heater"
          : family === "ac"
            ? "AC"
            : family === "furnace"
              ? "Furnace"
              : familyLabel(family);
  return flow === "v2" ? `${base} · new` : `${base} · old`;
}

export function instancesForFamilyFlow(
  instances: MeasureInstance[] | null | undefined,
  family: MeasureFamilyId,
  flow: AdvisorQuestionFlow,
): MeasureInstance[] {
  return (instances || []).filter(
    (i) => i.familyId === family && instanceAdvisorFlow(i) === flow,
  );
}

export function jobHasFamilyFlow(
  a: Pick<WizardAnswers, "measureInstances">,
  family: MeasureFamilyId,
  flow: AdvisorQuestionFlow,
): boolean {
  return instancesForFamilyFlow(a.measureInstances, family, flow).length > 0;
}

export function instancesForFamily(
  instances: MeasureInstance[],
  family: MeasureFamilyId,
): MeasureInstance[] {
  return (instances || []).filter((i) => i.familyId === family);
}

export function syncIdsFromInstances(instances: MeasureInstance[]): {
  coreProductIds: string[];
  optionalProductIds: string[];
  selectedMeasureFamilies: MeasureFamilyId[];
} {
  const core: string[] = [];
  const optional: string[] = [];
  const families = new Set<MeasureFamilyId>();
  for (const inst of instances || []) {
    families.add(inst.familyId);
    if (!inst.productId) continue;
    if (inst.role === "included") core.push(inst.productId);
    else optional.push(inst.productId);
  }
  return {
    coreProductIds: core,
    optionalProductIds: optional,
    selectedMeasureFamilies: Array.from(families),
  };
}

/**
 * Packet language / always-on services — stay after equipment in the list.
 * New equipment inserts just before this tail.
 */
export const LANGUAGE_TAIL_FAMILIES: MeasureFamilyId[] = [
  "load_calc",
  "conversion_guide",
  "hpwh_guide",
  "install",
  "maintenance",
  "permits",
  "hers",
  "sub_asbestos",
  "sub_crane",
];

/** Never open these as an equipment picker — they live on On this job. */
export const FILL_IN_SKIP_FAMILIES = new Set<string>([
  "hpwh_guide",
  "conversion_guide",
  "load_calc",
  "permits",
  "install",
  "hers",
  "maintenance",
  "sub_asbestos",
  "sub_crane",
  "rebates",
]);

export function isLanguageTailFamily(familyId: string | null | undefined): boolean {
  return LANGUAGE_TAIL_FAMILIES.includes(familyId as MeasureFamilyId);
}

/** Move a newly added instance just above install/permits (not to the visual "top"). */
export function placeNewInstanceBeforeLanguageTail(
  instances: MeasureInstance[],
  newId: string,
): MeasureInstance[] {
  const list = [...(instances || [])];
  const idx = list.findIndex((m) => m.id === newId);
  if (idx < 0) return list;
  const [item] = list.splice(idx, 1);
  // Language-tail items themselves append at end
  if (isLanguageTailFamily(item.familyId)) {
    list.push(item);
    return list;
  }
  let insertAt = list.length;
  for (let i = 0; i < list.length; i++) {
    if (isLanguageTailFamily(list[i].familyId)) {
      insertAt = i;
      break;
    }
  }
  list.splice(insertAt, 0, item);
  return list;
}

export function addMeasureInstance(
  a: WizardAnswers,
  family: MeasureFamilyId,
  products: Product[] = [],
  opts?: { advisorFlow?: AdvisorQuestionFlow },
): Partial<WizardAnswers> {
  const existing = instancesForFamily(a.measureInstances || [], family);
  const n = existing.length + 1;
  // Auto-select when only one product (ductwork, install, permit…)
  const sole =
    products.length > 0
      ? products.filter((p) => productMatchesMeasureFamily(p, family))
      : [];
  const soleId = sole.length === 1 ? sole[0].id : null;
  const soleProd = sole.length === 1 ? sole[0] : null;
  const isCustom = family === "custom";
  const isContractor = isContractorSuppliedFamily(family);
  const contractor = isContractor ? contractorPacketCopy(family) : null;
  const baseLabel = isCustom
    ? `Custom ${n}`
    : isContractor
      ? contractor!.title
      : labelForInstance(family, n);
  const inst: MeasureInstance = {
    id: ridInst(),
    familyId: family,
    label: isContractor ? contractor!.title : baseLabel,
    productId: isCustom || isContractor ? null : soleId,
    role: "included",
    packetTitle: isCustom ? "" : contractor?.title || (soleProd ? customerInstallName(soleProd) || soleProd.name : undefined),
    benefits: isCustom
      ? [""]
      : contractor
        ? [...contractor.benefits]
        : soleProd?.benefits
          ? [...soleProd.benefits]
          : undefined,
    workScope: isCustom
      ? ""
      : contractor
        ? contractor.workScope
        : soleProd?.workScope,
    description: isCustom
      ? ""
      : contractor
        ? contractor.description
        : soleProd?.description,
    customLaborHours: isCustom ? 1 : isContractor ? 0 : undefined,
    customMaterialCost: isCustom || isContractor ? 0 : undefined,
    measureLanguage: defaultMeasureLanguage(family, baseLabel, null),
    laborLines: [],
    documentRequests: DEFAULT_DOC_REQUESTS.map((d) => ({ ...d })),
    allBrandsInSize: false,
    selectedBrands: [],
    selectedCapacities: [],
    advisorFlow: "v2",
  };
  let measureInstances = [...(a.measureInstances || []), inst];
  let k = 0;
  measureInstances = measureInstances.map((m) => {
    if (m.familyId !== family) return m;
    k += 1;
    const place = (m.installLocationLabel || "").trim();
    return { ...m, label: labelForInstance(family, k, place || null) };
  });
  // Insert before packet-language tail so new equipment sits above install/permits
  measureInstances = placeNewInstanceBeforeLanguageTail(measureInstances, inst.id);
  const base = {
    measureInstances,
    focusMeasureId: a.focusMeasureId ?? null,
    ...syncIdsFromInstances(measureInstances),
  };
  const seeded = ensureDuctedCompanionsOnQuote(
    { ...a, ...base } as WizardAnswers,
    products,
    isDuctedEquipmentHost(family),
  );
  return { ...base, ...seeded };
}

export function removeMeasureInstance(
  a: WizardAnswers,
  instanceId: string,
): Partial<WizardAnswers> {
  const removed = (a.measureInstances || []).find((i) => i.id === instanceId);
  let measureInstances = (a.measureInstances || []).filter(
    (i) => i.id !== instanceId,
  );
  if (removed) {
    let k = 0;
    measureInstances = measureInstances.map((m) => {
      if (m.familyId !== removed.familyId) return m;
      k += 1;
      return { ...m, label: labelForInstance(removed.familyId, k) };
    });
  }
  const optionSelections = { ...(a.optionSelections || {}) };
  delete optionSelections[instanceId];
  const measureAdjustments = { ...(a.measureAdjustments || {}) };
  delete measureAdjustments[instanceId];
  return {
    measureInstances,
    optionSelections,
    measureAdjustments,
    ...syncIdsFromInstances(measureInstances),
  };
}

/** Match indoor/outdoor by brand + series (Comfort↔Comfort) + size. */
export function findMatchedSisterProduct(
  source: Product,
  products: Product[],
  sisterFamily: MeasureFamilyId,
  tonnage: number,
  path: string | null | undefined,
): Product | null {
  const brand = productBrand(source).toLowerCase();
  if (!brand) return null;
  let list = selectableProductsForFamily(products, sisterFamily, tonnage, undefined, undefined, {
    showAllSizes: false,
  });
  list = list.filter((p) => productBrand(p).toLowerCase() === brand);
  if (path) list = list.filter((p) => matchesHpInstallPath(p, path));
  // Owner pairing folder: never auto-pick outside the same group —
  // unless that group has no sister at all (stale seed before indoor SKUs existed).
  const groupIds = productsInSamePairingGroup(source.id);
  if (groupIds) {
    const allow = new Set(groupIds);
    const inGroup = list.filter((p) => allow.has(p.id));
    if (inGroup.length) {
      list = inGroup;
    } else {
      const srcComm = source.installCommunicating === true;
      list = list.filter((p) => (p.installCommunicating === true) === srcComm);
    }
  } else {
    const srcComm = source.installCommunicating === true;
    list = list.filter((p) => (p.installCommunicating === true) === srcComm);
  }
  if (!list.length) return null;
  const tier = source.tier || 1;
  const exact = list.filter((p) => (p.tier || 1) === tier);
  const pool = exact.length ? exact : list;
  return [...pool].sort((a, b) => {
    const ta = Math.abs((a.tier || 1) - tier);
    const tb = Math.abs((b.tier || 1) - tier);
    if (ta !== tb) return ta - tb;
    return (a.unitPrice || 0) - (b.unitPrice || 0);
  })[0] || null;
}

function sisterFamilyOf(familyId: MeasureFamilyId | undefined): MeasureFamilyId | null {
  if (familyId === "heat_pump") return "air_handler";
  if (familyId === "air_handler") return "heat_pump";
  return null;
}

/** Path-linked pair, or the only outdoor/indoor of that type on the job. */
export function sisterFillEligible(
  source: Pick<MeasureInstance, "familyId" | "pathLinkGroupId" | "pathLinkUnlinked">,
  sis: Pick<
    MeasureInstance,
    "familyId" | "pathLinkGroupId" | "pathLinkUnlinked" | "equipmentConfirmed"
  >,
  instances: MeasureInstance[],
  opts?: { rematchConfirmed?: boolean },
): boolean {
  if (sis.equipmentConfirmed && !opts?.rematchConfirmed) return false;
  if (source.pathLinkUnlinked || sis.pathLinkUnlinked) return false;
  if (
    source.pathLinkGroupId &&
    sis.pathLinkGroupId === source.pathLinkGroupId
  ) {
    return true;
  }
  const srcN = instances.filter((m) => m.familyId === source.familyId).length;
  const sisN = instances.filter((m) => m.familyId === sis.familyId).length;
  return srcN === 1 && sisN === 1;
}

export function sameEquipmentLane(
  familyId: string | null | undefined,
  prev: Product | null | undefined,
  next: Product | null | undefined,
  inst?: Pick<
    MeasureInstance,
    "waterHeaterStyle" | "wallVentStyle" | "furnaceEffStyle"
  >,
): boolean {
  if (!prev || !next) return false;
  if (familyId === "water_heater") {
    const a =
      inst?.waterHeaterStyle || detectWaterHeaterStyle(prev) || "";
    const b = detectWaterHeaterStyle(next) || "";
    return Boolean(a) && a === b;
  }
  if (familyId === "wall_heater") {
    const ventOf = (p: Product) => {
      const name = `${p.name || ""} ${p.sku || ""}`.toLowerCase();
      if (name.includes("rinnai") || name.includes("energysaver")) return "rinnai";
      if (name.includes("direct vent") || name.includes("direct-vent"))
        return "direct_vent";
      return "lfl";
    };
    return ventOf(prev) === ventOf(next);
  }
  if (familyId === "furnace") {
    const kind = (p: Product) => {
      const eff = detectFurnaceEffStyle(p);
      return eff === "high_eff" || eff === "uln_high" || eff === "navien_npf"
        ? "pvc"
        : "bvent";
    };
    return kind(prev) === kind(next);
  }
  return true;
}

/**
 * Manufacturer chips are multi-select. Tap Carrier, tap Bosch — both stay on
 * so the packet can show both as packages. "All in this size" is a separate path.
 */
export function toggleMeasureBrand(
  inst: Pick<MeasureInstance, "selectedBrands" | "allBrandsInSize">,
  brand: string,
): { selectedBrands: string[]; allBrandsInSize: boolean } {
  const name = canonicalizeBrand(brand) || (brand || "").trim();
  if (!name) {
    return {
      selectedBrands: [...(inst.selectedBrands || [])],
      allBrandsInSize: Boolean(inst.allBrandsInSize),
    };
  }
  const cur = inst.allBrandsInSize ? [] : [...(inst.selectedBrands || [])];
  const has = cur.some((b) => b.toLowerCase() === name.toLowerCase());
  const next = has
    ? cur.filter((b) => b.toLowerCase() !== name.toLowerCase())
    : [...cur, name];
  return { selectedBrands: next, allBrandsInSize: false };
}

/** Copy brand chips onto the unconfirmed sister (HP ↔ AH). */
export function setInstanceBrands(
  a: WizardAnswers,
  instanceId: string,
  selectedBrands: string[],
  allBrandsInSize: boolean,
): Partial<WizardAnswers> {
  const source = (a.measureInstances || []).find((m) => m.id === instanceId);
  if (!source) return {};
  const sisterFamily = sisterFamilyOf(source.familyId);
  const measureInstances = (a.measureInstances || []).map((m) => {
    if (m.id === instanceId) {
      const brand = msBrandFromSelection({
        selectedBrands,
        allBrandsInSize,
      });
      return {
        ...m,
        selectedBrands: [...selectedBrands],
        allBrandsInSize,
        scopeAnswers: {
          ...(m.scopeAnswers || {}),
          ...(brand ? { ms_brands: brand } : {}),
        },
      };
    }
    if (
      sisterFamily &&
      m.familyId === sisterFamily &&
      sisterFillEligible(source, m, a.measureInstances || [])
    ) {
      return {
        ...m,
        selectedBrands: [...selectedBrands],
        allBrandsInSize,
      };
    }
    return m;
  });
  return { measureInstances };
}

export function applyMeasureBrandToggle(
  a: WizardAnswers,
  instanceId: string,
  brand: string,
): Partial<WizardAnswers> {
  const inst = (a.measureInstances || []).find((m) => m.id === instanceId);
  if (!inst) return {};
  const next = toggleMeasureBrand(inst, brand);
  return setInstanceBrands(
    a,
    instanceId,
    next.selectedBrands,
    next.allBrandsInSize,
  );
}

export function setInstanceProduct(
  a: WizardAnswers,
  instanceId: string,
  productId: string | null,
  products: Product[],
): Partial<WizardAnswers> {
  const source = (a.measureInstances || []).find((m) => m.id === instanceId);
  const measureInstances = (a.measureInstances || []).map((m) => {
    if (m.id !== instanceId) return m;
    if (!productId) {
      return {
        ...m,
        productId: null,
        packetTitle: undefined,
        benefits: undefined,
        workScope: undefined,
        description: undefined,
        equipmentConfirmed: false,
        packageMark: "none" as const,
      };
    }
    const p = products.find((x) => x.id === productId);
    const prev = products.find((x) => x.id === m.productId);
    const sameLane = sameEquipmentLane(m.familyId, prev, p, m);
    const nextStyle =
      m.familyId === "water_heater" && p
        ? detectWaterHeaterStyle(p) || m.waterHeaterStyle
        : m.waterHeaterStyle;
    const styleChanged =
      m.familyId === "water_heater" &&
      nextStyle &&
      m.waterHeaterStyle &&
      nextStyle !== m.waterHeaterStyle;
    const rule = p ? inferPackageRule(p) : "none";
    const mark: MeasureInstance["packageMark"] =
      rule === "forced" ? "red" : rule === "eligible" ? "gold" : "none";
    let wallPath: string | undefined;
    if (m.familyId === "wall_heater" && p) {
      const name = `${p.name || ""} ${p.sku || ""}`.toLowerCase();
      const vent = m.wallVentStyle || "";
      if (
        vent === "rinnai" ||
        name.includes("rinnai") ||
        name.includes("energysaver") ||
        name.includes("wall-rin")
      ) {
        wallPath = "rinnai_dv";
      } else if (
        vent === "direct_vent" ||
        name.includes("direct vent") ||
        name.includes("direct-vent")
      ) {
        wallPath = "williams_dv";
      } else {
        wallPath = "williams_lfl";
      }
    }
    return {
      ...m,
      productId,
      packetTitle:
        m.productId === productId && m.packetTitle
          ? m.packetTitle
          : (p ? customerInstallName(p) || p.name : null) || m.packetTitle,
      benefits: p
        ? (isLockableEquipment(p)
            ? lockedEquipmentBenefits(p)
            : null) || (p.benefits ? [...p.benefits] : m.benefits)
        : m.benefits,
      workScope: p?.workScope || m.workScope,
      description: p?.description || m.description,
      equipmentConfirmed: sameLane ? m.equipmentConfirmed || false : false,
      waterHeaterStyle: nextStyle || m.waterHeaterStyle,
      accessoriesConfirmed: styleChanged ? false : m.accessoriesConfirmed,
      accessoryPicks: styleChanged ? [] : m.accessoryPicks,
      accessoryOffers: styleChanged ? [] : m.accessoryOffers,
      packageMark: mark,
      scopeAnswers: {
        ...(styleChanged
          ? Object.fromEntries(
              Object.entries(m.scopeAnswers || {}).filter(([k]) =>
                /^(wh_demo|wh_demo_|cabinet_fit|job_path|install_type|wh_job_type)/.test(
                  k,
                ),
              ),
            )
          : m.scopeAnswers || {}),
        ...(wallPath ? { wall_path: wallPath } : {}),
        ...(m.familyId === "water_heater" && p
          ? {
              wh_style:
                m.waterHeaterStyle || detectWaterHeaterStyle(p) || undefined,
              wh_vent_kind: detectWhVentKind(
                p,
                m.waterHeaterStyle || detectWaterHeaterStyle(p),
              ),
            }
          : {}),
        ...(m.familyId === "zoning" && p
          ? {
              zone_mfr: /ZONE-HW/i.test(p.sku || "")
                ? "honeywell"
                : "infinity",
            }
          : {}),
        ...(m.familyId === "furnace" && p
          ? {
              furn_vent_kind: (() => {
                const eff = detectFurnaceEffStyle(p);
                return eff === "high_eff" ||
                  eff === "uln_high" ||
                  eff === "navien_npf"
                  ? "pvc"
                  : "bvent";
              })(),
            }
          : {}),
        ...(m.familyId === "bath_fan" && p
          ? fanHasSelectableCfm(p.sku) && m.bathCfm
            ? { fan_cfm: String(m.bathCfm) }
            : fanHasSelectableCfm(p.sku)
              ? {}
              : { fan_cfm: undefined }
          : {}),
        ...(m.familyId === "ductless"
          ? (() => {
              const fromSel = msBrandFromSelection(m);
              const blob = `${p ? productBrand(p) : ""} ${p?.name || ""}`.toLowerCase();
              const brand =
                fromSel ||
                (/mitsu/.test(blob)
                  ? "mitsubishi"
                  : /carrier/.test(blob)
                    ? "carrier"
                    : null);
              return brand ? { ms_brands: brand } : {};
            })()
          : {}),
      },
    };
  });

  // Package pair: size + path + matching brand/series (Comfort↔Comfort)
  if (productId && source) {
    const caps = (source.selectedCapacities || []) as number[];
    const path = source.hpInstallPath ?? null;
    const picked = products.find((x) => x.id === productId) || null;
    const sisterFamily = sisterFamilyOf(source.familyId);
    const swapping = Boolean(
      source.productId && productId && source.productId !== productId,
    );
    if (sisterFamily) {
      const tons = caps[0] || a.systemTonnage || 3;
      const match = picked
        ? findMatchedSisterProduct(picked, products, sisterFamily, tons, path)
        : null;
      for (let i = 0; i < measureInstances.length; i++) {
        const sis = measureInstances[i]!;
        if (sis.familyId !== sisterFamily) continue;
        const nextCaps =
          !sis.selectedCapacities?.length && caps.length
            ? [...caps]
            : swapping && caps.length
              ? [...caps]
              : sis.selectedCapacities;
        const nextPath =
          sis.hpInstallPath == null && path != null
            ? path
            : swapping && path != null
              ? path
              : sis.hpInstallPath;
        const canFill = sisterFillEligible(source, sis, measureInstances, {
          rematchConfirmed: swapping,
        });
        const nextProduct =
          canFill && match
            ? match
            : sis.productId
              ? products.find((p) => p.id === sis.productId) || null
              : null;
        let nextBrands: string[] | undefined;
        if (canFill && source.selectedBrands?.length) {
          nextBrands = [...source.selectedBrands];
        } else if (sis.selectedBrands?.length) {
          nextBrands = sis.selectedBrands;
        } else if (source.selectedBrands?.length) {
          nextBrands = [...source.selectedBrands];
        } else {
          nextBrands = sis.selectedBrands;
        }
        if (canFill && match) {
          const matchBrand = productBrand(match);
          if (
            matchBrand &&
            !(nextBrands || []).some(
              (b) => b.toLowerCase() === matchBrand.toLowerCase(),
            )
          ) {
            nextBrands = [...(nextBrands || []), matchBrand];
          }
        }
        if (canFill && match) {
          const oldSis = sis.productId
            ? products.find((p) => p.id === sis.productId) || null
            : null;
          const keepConfirmed =
            Boolean(sis.equipmentConfirmed) &&
            sameEquipmentLane(sis.familyId, oldSis, match);
          measureInstances[i] = {
            ...sis,
            selectedCapacities: nextCaps,
            hpInstallPath: nextPath,
            selectedBrands: nextBrands,
            allBrandsInSize: Boolean(
              sis.allBrandsInSize || source.allBrandsInSize,
            ),
            productId: match.id,
            packetTitle: customerInstallName(match) || match.name,
            benefits: match.benefits ? [...match.benefits] : sis.benefits,
            workScope: match.workScope || sis.workScope,
            description: match.description || sis.description,
            equipmentConfirmed: keepConfirmed,
          };
        } else if (swapping && canFill && !match && sis.equipmentConfirmed) {
          measureInstances[i] = {
            ...sis,
            selectedCapacities: nextCaps,
            hpInstallPath: nextPath,
            selectedBrands: nextBrands,
            equipmentConfirmed: false,
          };
        } else {
          measureInstances[i] = {
            ...sis,
            selectedCapacities: nextCaps,
            hpInstallPath: nextPath,
            selectedBrands: nextBrands,
            allBrandsInSize: Boolean(
              sis.allBrandsInSize || source.allBrandsInSize,
            ),
            ...(canFill && match
              ? {
                  productId: match.id,
                  packetTitle: customerInstallName(match) || match.name,
                  benefits: match.benefits ? [...match.benefits] : sis.benefits,
                  workScope: match.workScope || sis.workScope,
                  description: match.description || sis.description,
                  equipmentConfirmed: false,
                }
              : {}),
          };
        }
        void nextProduct;
      }
    }
  }
  const optionSelections = { ...(a.optionSelections || {}) };
  if (productId) {
    const p = products.find((x) => x.id === productId);
    const owner = pickPadOwnerProductId(
      measureInstances.filter((i) => i.productId).map((i) => i.productId!),
      products,
      measureInstances
        .filter((i) => i.role === "included" && i.productId)
        .map((i) => i.productId!),
    );
    const defaults = (p?.options || [])
      .filter((o) => {
        if (!o.defaultSelected) return false;
        if (isPadOption(o)) {
          return false;
        }
        return true;
      })
      .map((o) => o.id);
    // Keep in-card model options. Remap them under the new main.
    // Do not wipe Comfort/Performance just because main changed.
    const prev = a.optionSelections?.[instanceId] || [];
    const remapped: string[] = [...defaults];
    const oldMain = source?.productId
      ? products.find((x) => x.id === source.productId) || null
      : null;
    const newMain = p || null;
    if (oldMain && newMain && oldMain.id !== newMain.id) {
      for (const cand of products) {
        if (cand.id === newMain.id) continue;
        const oldOpt = makeAlternateProductOption(oldMain, cand);
        if (!oldOpt || !prev.includes(oldOpt.id)) continue;
        const nextOpt = makeAlternateProductOption(newMain, cand);
        if (nextOpt && !remapped.includes(nextOpt.id)) remapped.push(nextOpt.id);
      }
    } else {
      for (const id of prev) {
        if (id.startsWith("tier_up_") && !remapped.includes(id)) remapped.push(id);
      }
    }
    optionSelections[instanceId] = remapped;
    void owner;
  } else {
    delete optionSelections[instanceId];
  }

  // Mirror option models onto the sister (Performance option → Performance AH)
  if (productId && source) {
    const sisterFamily = sisterFamilyOf(source.familyId);
    const srcProd = products.find((x) => x.id === productId) || null;
    const srcOptIds = new Set(optionSelections[instanceId] || []);
    if (sisterFamily && srcProd) {
      for (const sis of measureInstances) {
        if (sis.familyId !== sisterFamily) continue;
        if (!sisterFillEligible(source, sis, measureInstances, {
          rematchConfirmed: Boolean(
            source.productId && productId && source.productId !== productId,
          ),
        })) continue;
        const tons =
          (sis.selectedCapacities || [])[0] || a.systemTonnage || 3;
        const sisMain =
          products.find((p) => p.id === sis.productId) ||
          findMatchedSisterProduct(
            srcProd,
            products,
            sisterFamily,
            tons,
            sis.hpInstallPath,
          );
        if (!sisMain) continue;
        const nextIds: string[] = [];
        for (const cand of products) {
          const srcOpt = makeAlternateProductOption(srcProd, cand);
          if (!srcOpt || !srcOptIds.has(srcOpt.id)) continue;
          const sisAlt = findMatchedSisterProduct(
            cand,
            products,
            sisterFamily,
            tons,
            sis.hpInstallPath,
          );
          if (!sisAlt) continue;
          const sisOpt = makeAlternateProductOption(sisMain, sisAlt);
          if (sisOpt) nextIds.push(sisOpt.id);
        }
        optionSelections[sis.id] = nextIds;
      }
    }
  }
  const owner = pickPadOwnerProductId(
    measureInstances.filter((i) => i.productId).map((i) => i.productId!),
    products,
    measureInstances
      .filter((i) => i.role === "included" && i.productId)
      .map((i) => i.productId!),
  );
  for (const inst of measureInstances) {
    if (!inst.productId || inst.id === instanceId) continue;
    const prod = products.find((x) => x.id === inst.productId);
    if (!prod || !isOutdoorPadHost(prod)) continue;
    if (owner && inst.productId !== owner) {
      optionSelections[inst.id] = (optionSelections[inst.id] || []).filter(
        (oid) => {
          const o = (prod.options || []).find((x) => x.id === oid);
          return !o || !isPadOption(o);
        },
      );
    }
  }
  return {
    ...(() => {
      const base = {
        ...a,
        measureInstances,
        optionSelections,
        ...syncIdsFromInstances(measureInstances),
      } as WizardAnswers;
      const withGuide = ensureHpwhGuideOnQuote(base, products);
      const mid = {
        measureInstances: withGuide.measureInstances || measureInstances,
        optionSelections,
        ...syncIdsFromInstances(
          withGuide.measureInstances || measureInstances,
        ),
        selectedMeasureFamilies:
          withGuide.selectedMeasureFamilies ||
          syncIdsFromInstances(measureInstances).selectedMeasureFamilies,
      } as WizardAnswers;
      const ducted = ensureDuctedCompanionsOnQuote(
        { ...a, ...mid },
        products,
        isDuctedEquipmentHost(source?.familyId),
      );
      return { ...mid, ...ducted };
    })(),
  };
}

export function setInstanceScopeAnswers(
  a: WizardAnswers,
  instanceId: string,
  scopeAnswers: ScopeAnswers,
): Partial<WizardAnswers> {
  const instances = (a.measureInstances || []).map((inst) =>
    inst.id === instanceId ? { ...inst, scopeAnswers: { ...scopeAnswers } } : inst,
  );
  const offer = String(scopeAnswers.duct_offer_new || "");
  const extra =
    offer === "yes" || offer === "no"
      ? withNewDuctsOption(a, instanceId, offer === "yes")
      : {};
  return { measureInstances: instances, ...extra };
}

export function outdoorPlaceFromPreset(presetId: string): string {
  const id = (presetId || "").toLowerCase();
  if (id.includes("roof")) return "roof";
  if (id.includes("balcon") || id.includes("deck")) return "balcony";
  if (id.includes("bracket") || id.includes("elevat") || id.includes("stand"))
    return "elevated";
  return "grade";
}

export function msBrandFromSelection(
  inst: Pick<MeasureInstance, "selectedBrands" | "allBrandsInSize">,
): string | null {
  const brands = (inst.selectedBrands || []).map((b) => b.toLowerCase());
  const hasCar = brands.some((b) => /carrier/.test(b));
  const hasMit = brands.some((b) => /mitsu/.test(b));
  if (hasCar && hasMit) return "both";
  if (hasMit) return "mitsubishi";
  if (hasCar) return "carrier";
  return null;
}

export function setInstanceHeadLocations(

  a: WizardAnswers,
  instanceId: string,
  headLocations: string[],
): Partial<WizardAnswers> {
  const instances = (a.measureInstances || []).map((inst) =>
    inst.id === instanceId
      ? { ...inst, headLocations: headLocations.map((h) => h).slice(0, 12) }
      : inst,
  );
  return { measureInstances: instances };
}

/** Placement for large equipment — title + packet wording (session UX → MASTER) */
export function setInstanceInstallLocation(
  a: WizardAnswers,
  instanceId: string,
  presetId: string | null,
  detail: string,
): Partial<WizardAnswers> {
  const measureInstances = (a.measureInstances || []).map((inst) => {
    if (inst.id !== instanceId) return inst;
    const composed = composeInstallPlacement(
      inst.familyId,
      presetId,
      detail,
      { waterHeaterStyle: inst.waterHeaterStyle },
    );
    return {
      ...inst,
      installLocationPreset: presetId,
      installLocationDetail: detail,
      installLocationLabel: composed,
      scopeAnswers: {
        ...(inst.scopeAnswers || {}),
        // Chip placement answers the first site-location question so it is not asked twice
        ...(presetId
          ? {
              outdoor_location:
                presetId === "roof" || presetId.includes("roof")
                  ? "roof"
                  : presetId === "tight" || presetId.includes("tight")
                    ? "tight_access"
                    : "side_yard",
              ms_outdoor_place: outdoorPlaceFromPreset(presetId),
            }
          : {}),
      },
    };
  });
  const counts: Partial<Record<MeasureFamilyId, number>> = {};
  const renumbered = measureInstances.map((inst) => {
    counts[inst.familyId] = (counts[inst.familyId] || 0) + 1;
    const place = (inst.installLocationLabel || "").trim();
    return {
      ...inst,
      label: labelForInstance(
        inst.familyId,
        counts[inst.familyId]!,
        place || null,
      ),
    };
  });
  return { measureInstances: renumbered };
}

/** Surgical partial update on one measure instance (field UX). */
export function patchMeasureInstance(
  a: WizardAnswers,
  instanceId: string,
  partial: Partial<MeasureInstance>,
): Partial<WizardAnswers> {
  const measureInstances = (a.measureInstances || []).map((m) =>
    m.id === instanceId ? { ...m, ...partial } : m,
  );
  return { measureInstances };
}

/** Families that share install path when seeded by the same job package */
export const PACKAGE_PATH_LINK_GROUPS: MeasureFamilyId[][] = [
  ["heat_pump", "air_handler"],
  ["ac", "furnace"],
];

/**
 * Mark package-seeded partner measures with a path link group.
 * Individual +Add measure leaves pathLinkGroupId null.
 */
export function ensurePackagePathLinks(
  instances: MeasureInstance[],
  packageFamilies: MeasureFamilyId[],
  enabled = true,
): MeasureInstance[] {
  if (!enabled || !instances.length) return instances;
  let next = instances.map((i) => ({ ...i }));
  for (const group of PACKAGE_PATH_LINK_GROUPS) {
    if (!group.every((f) => packageFamilies.includes(f))) continue;
    const members = group
      .map((f) => next.find((i) => i.familyId === f && !i.pathLinkUnlinked))
      .filter((x): x is MeasureInstance => Boolean(x));
    if (members.length < 2) continue;
    const existing =
      members.find((m) => m.pathLinkGroupId)?.pathLinkGroupId || null;
    const gid = existing || `pl-${ridInst()}`;
    const sharedPath =
      members.find((m) => m.hpInstallPath)?.hpInstallPath ?? null;
    const memberIds = new Set(members.map((m) => m.id));
    next = next.map((inst) => {
      if (!memberIds.has(inst.id) || inst.pathLinkUnlinked) return inst;
      return {
        ...inst,
        pathLinkGroupId: gid,
        hpInstallPath: inst.hpInstallPath ?? sharedPath,
      };
    });
  }
  return next;
}

/**
 * Set 24V / mini-split path. Package-linked partners follow.
 * Choosing a different path than a linked partner unlinks this measure only.
 */
export function setInstanceHpInstallPath(
  a: WizardAnswers,
  instanceId: string,
  path: "conventional" | "mini-split" | null,
): Partial<WizardAnswers> {
  const list = a.measureInstances || [];
  const src = list.find((i) => i.id === instanceId);
  if (!src) return {};

  const group = src.pathLinkGroupId;
  const wasUnlinked = Boolean(src.pathLinkUnlinked);

  if (group && !wasUnlinked && path != null) {
    const partner = list.find(
      (i) =>
        i.id !== instanceId &&
        i.pathLinkGroupId === group &&
        !i.pathLinkUnlinked &&
        i.hpInstallPath &&
        i.hpInstallPath !== path,
    );
    if (partner) {
      return {
        measureInstances: list.map((inst) =>
          inst.id === instanceId
            ? {
                ...inst,
                hpInstallPath: path,
                pathLinkUnlinked: true,
                pathLinkGroupId: null,
              }
            : inst,
        ),
      };
    }
  }

  return {
    measureInstances: list.map((inst) => {
      if (inst.id === instanceId) {
        return {
          ...inst,
          hpInstallPath: path,
          pathLinkUnlinked: false,
        };
      }
      if (
        group &&
        !wasUnlinked &&
        inst.pathLinkGroupId === group &&
        !inst.pathLinkUnlinked
      ) {
        return { ...inst, hpInstallPath: path };
      }
      return inst;
    }),
  };
}

/** Human label of linked partners (field UI). */
export function pathLinkPartnerLabel(
  inst: MeasureInstance,
  instances: MeasureInstance[],
): string | null {
  if (!inst.pathLinkGroupId || inst.pathLinkUnlinked) return null;
  const partners = instances.filter(
    (i) =>
      i.id !== inst.id &&
      i.pathLinkGroupId === inst.pathLinkGroupId &&
      !i.pathLinkUnlinked,
  );
  if (!partners.length) return null;
  return partners
    .map((p) => {
      const sole =
        instances.filter((x) => x.familyId === p.familyId).length === 1;
      return cleanMeasureDisplayLabel(
        p.label ||
          MEASURE_FAMILIES.find((f) => f.id === p.familyId)?.label ||
          p.familyId,
        sole,
      );
    })
    .join(", ");
}

export function setInstancePacketCopy(
  a: WizardAnswers,
  instanceId: string,
  copy: {
    packetTitle?: string;
    benefits?: string[];
    workScope?: string;
    workScopeTouched?: boolean;
    description?: string;
  },
): Partial<WizardAnswers> {
  const normalized = {
    ...copy,
    packetTitle:
      copy.packetTitle != null
        ? formatMeasureTitle(copy.packetTitle)
        : copy.packetTitle,
  };
  const measureInstances = (a.measureInstances || []).map((m) =>
    m.id === instanceId ? { ...m, ...normalized } : m,
  );
  return { measureInstances };
}


/**
 * Optional on a product row:
 * - If this IS the main model → toggle measure role optional/included (keep product).
 * - If another model is main → toggle that product as an upgrade option under main
 *   (does NOT replace the main selection).
 * - If no main yet → select this as main and mark measure optional.
 */

/** Stable option id for offering product B as an option under main product A. */
export function alternateOptionId(mainSku: string, targetSku: string): string {
  return `tier_up_${mainSku || "main"}_to_${targetSku || "alt"}`;
}

/**
 * Build a customer-facing optional line for an alternate model in the same measure.
 * Works for heat pumps, filters (AprilAire), wall heaters — not only staged equipment.
 * Price delta = max(0, target − main) so cheaper alts still appear as $0-up options.
 */
export function makeAlternateProductOption(
  main: Product,
  target: Product,
): ProductOption | null {
  if (!main || !target || main.id === target.id) return null;
  if ((main.sku || "") === (target.sku || "")) return null;
  const mainPrice = liveSellPrice(main);
  const targetPrice = liveSellPrice(target);
  const delta = alternateLiveDelta(mainPrice, targetPrice);
  const label = customerInstallName(target) || target.tierLabel || target.name;
  const benefitSrc = isLockableEquipment(target)
    ? lockedEquipmentBenefits(target)
    : target.benefits || [];
  const highlights = (benefitSrc || []).filter(Boolean);
  return {
    id: alternateOptionId(main.sku || main.id, target.sku || target.id),
    kind: "tier_upgrade",
    title: `Option: ${label}`,
    body:
      highlights.length
        ? highlights.join("\n")
        : `Optional alternate to ${main.tierLabel || main.name}: ${target.name}.`,
    priceDelta: delta,
    upgradeSku: target.sku,
    upgradeTier: target.tier,
    materialCost: Math.max(
      0,
      (Number(target.materialCost) || 0) - (Number(main.materialCost) || 0),
    ),
    laborHours: Math.max(
      0,
      (Number(target.laborHours) || 0) - (Number(main.laborHours) || 0),
    ),
    defaultSelected: false,
  };
}

/** Exact option match — never substring SKU (that painted Option ✓ on unpicked units). */
export function isAlternateOptionPicked(
  selectedIds: string[] | null | undefined,
  main: Product | null | undefined,
  target: Product | null | undefined,
): boolean {
  if (!main || !target || !selectedIds?.length) return false;
  const opt = makeAlternateProductOption(main, target);
  if (opt && selectedIds.includes(opt.id)) return true;
  const sku = (target.sku || "").trim();
  if (!sku) return false;
  const needle = `_to_${sku}`.toLowerCase();
  return selectedIds.some((id) => String(id).toLowerCase().endsWith(needle));
}

function idsForAlternateOption(
  selectedIds: string[],
  main: Product,
  target: Product,
): string[] {
  const opt = makeAlternateProductOption(main, target);
  const sku = (target.sku || "").trim();
  const needle = sku ? `_to_${sku}`.toLowerCase() : "";
  return selectedIds.filter((id) => {
    if (opt && id === opt.id) return true;
    if (needle && String(id).toLowerCase().endsWith(needle)) return true;
    return false;
  });
}

/** Pick the zoning SKU that matches this count and the brand already on the job. */
export function findZoningProductForCount(
  products: Product[],
  count: number,
  hint: {
    sku?: string | null;
    name?: string | null;
    selectedBrands?: string[] | null;
    scopeAnswers?: ScopeAnswers;
  },
): Product | null {
  const fromAns = String(hint.scopeAnswers?.zone_mfr || "");
  const inferred = inferZoneMfr({
    sku: hint.sku,
    name: hint.name,
    selectedBrands: hint.selectedBrands,
  });
  let want: "honeywell" | "infinity" | "both" =
    fromAns === "honeywell" || fromAns === "infinity" || fromAns === "both"
      ? fromAns
      : inferred;
  if (want === "honeywell" && count !== 3 && count !== 4) want = "infinity";
  const skuOf = (brand: "INF" | "HW") =>
    products.find(
      (p) => (p.sku || "").toUpperCase() === `ZONE-${brand}-${count}`,
    ) || null;
  if (want === "honeywell") return skuOf("HW") || skuOf("INF");
  return skuOf("INF") || skuOf("HW");
}

/**
 * Advisor changed 2-zone → 4-zone (or any count). Keep rooms 1–N that still
 * apply, rematch the zoning SKU, remap Honeywell/Infinity options.
 */
export function applyZoneCountChange(
  a: WizardAnswers,
  instanceId: string,
  count: number,
  products: Product[],
): Partial<WizardAnswers> {
  const inst = (a.measureInstances || []).find((m) => m.id === instanceId);
  if (!inst || inst.familyId !== "zoning") return {};
  const prev = inst.productId
    ? products.find((p) => p.id === inst.productId) || null
    : null;
  const next = findZoningProductForCount(products, count, {
    sku: prev?.sku,
    name: prev?.name,
    selectedBrands: inst.selectedBrands,
    scopeAnswers: inst.scopeAnswers,
  });
  const honeywellOk = count === 3 || count === 4;
  const hw = products.find(
    (p) => (p.sku || "").toUpperCase() === `ZONE-HW-${count}`,
  );
  const inf = products.find(
    (p) => (p.sku || "").toUpperCase() === `ZONE-INF-${count}`,
  );
  const bothOnTable = Boolean(honeywellOk && hw && inf);
  const inferred = inferZoneMfr({
    sku: prev?.sku,
    name: prev?.name,
    selectedBrands: inst.selectedBrands,
  });
  const fromAns = String(inst.scopeAnswers?.zone_mfr || "");
  let mfr = fromAns || inferred;
  if (mfr === "honeywell" && !honeywellOk) mfr = "infinity";
  if (bothOnTable) mfr = "";

  const measureInstances = (a.measureInstances || []).map((m) => {
    if (m.id !== instanceId) return m;
    const brands =
      bothOnTable
        ? []
        : mfr === "infinity"
          ? ["Carrier"]
          : mfr === "honeywell"
            ? ["Honeywell"]
            : m.selectedBrands;
    return {
      ...m,
      zoneCount: count,
      productId: bothOnTable ? null : next?.id || inf?.id || hw?.id || null,
      packetTitle: bothOnTable ? m.packetTitle : (next ? customerInstallName(next) || next.name : m.packetTitle),
      benefits: bothOnTable
        ? m.benefits
        : next?.benefits
          ? [...next.benefits]
          : m.benefits,
      workScope: bothOnTable ? m.workScope : next?.workScope || m.workScope,
      description: bothOnTable ? m.description : next?.description || m.description,
      equipmentConfirmed: false,
      selectedBrands: brands,
      allBrandsInSize: bothOnTable,
      scopeAnswers: {
        ...(m.scopeAnswers || {}),
        zone_count: String(count),
        zone_mfr: mfr,
      },
    };
  });

  const optionSelections = { ...(a.optionSelections || {}) };
  if (bothOnTable) {
    delete optionSelections[instanceId];
  } else if (next) {
    const prevIds = a.optionSelections?.[instanceId] || [];
    const remapped: string[] = [];
    for (const id of prevIds) {
      const mm = /ZONE-(INF|HW)-(\d+)/i.exec(id);
      if (!mm) continue;
      const sku = `ZONE-${mm[1].toUpperCase()}-${count}`;
      const cand = products.find((p) => (p.sku || "").toUpperCase() === sku);
      if (!cand || cand.id === next.id) continue;
      const opt = makeAlternateProductOption(next, cand);
      if (opt) remapped.push(opt.id);
    }
    optionSelections[instanceId] = remapped;
  } else {
    delete optionSelections[instanceId];
  }

  return { measureInstances, optionSelections };
}

export function toggleProductOptional(
  a: WizardAnswers,
  instanceId: string,
  productId: string,
  products: Product[],
): Partial<WizardAnswers> {
  const inst = (a.measureInstances || []).find((m) => m.id === instanceId);
  if (!inst) return {};

  // Same product as main — only flip included ↔ optional on the measure
  if (inst.productId === productId) {
    const nextRole = inst.role === "optional" ? "included" : "optional";
    return setInstanceRole(a, instanceId, nextRole);
  }

  // No main yet — select this product and mark the measure optional
  if (!inst.productId) {
    const next = {
      ...a,
      ...setInstanceProduct(a, instanceId, productId, products),
    };
    return {
      ...next,
      ...setInstanceRole(next as WizardAnswers, instanceId, "optional"),
    };
  }

  // Main already set — attach/detach this product as a customer option under main
  const main = products.find((p) => p.id === inst.productId);
  const target = products.find((p) => p.id === productId);
  if (!main || !target) return {};

  const familyId = inst.familyId;
  if (!productMatchesMeasureFamily(target, familyId)) return {};

  const opt = makeAlternateProductOption(main, target);
  const selected = new Set(a.optionSelections?.[instanceId] || []);
  const matchingIds = idsForAlternateOption([...selected], main, target);
  if (matchingIds.length) {
    for (const id of matchingIds) selected.delete(id);
  } else if (opt) {
    selected.add(opt.id);
  } else {
    return {};
  }

  const optionSelections: Record<string, string[]> = {
    ...(a.optionSelections || {}),
    [instanceId]: Array.from(selected),
  };

  const sisterFamily = sisterFamilyOf(inst.familyId);
  if (sisterFamily) {
    const tons = (inst.selectedCapacities || [])[0] || a.systemTonnage || 3;
    for (const sis of a.measureInstances || []) {
      if (sis.familyId !== sisterFamily) continue;
      if (!sisterFillEligible(inst, sis, a.measureInstances || [])) continue;
      const sisMain =
        products.find((p) => p.id === sis.productId) ||
        findMatchedSisterProduct(
          main,
          products,
          sisterFamily,
          tons,
          sis.hpInstallPath,
        );
      if (!sisMain) continue;
      const nextIds: string[] = [];
      for (const cand of products) {
        const srcOpt = makeAlternateProductOption(main, cand);
        if (!srcOpt || !selected.has(srcOpt.id)) continue;
        const sisAlt = findMatchedSisterProduct(
          cand,
          products,
          sisterFamily,
          tons,
          sis.hpInstallPath,
        );
        if (!sisAlt) continue;
        const sisOpt = makeAlternateProductOption(sisMain, sisAlt);
        if (sisOpt) nextIds.push(sisOpt.id);
      }
      optionSelections[sis.id] = nextIds;
    }
  }

  return { optionSelections };
}

export function setInstanceRole(
  a: WizardAnswers,
  instanceId: string,
  role: MeasurePickRole,
): Partial<WizardAnswers> {
  const measureInstances = (a.measureInstances || []).map((m) => {
    if (m.id !== instanceId) return m;
    // Company language / install / permits — never proposal options
    if (isAlwaysIncludedLanguageFamily(m.familyId) && role === "optional") {
      return { ...m, role: "included" as MeasurePickRole };
    }
    return { ...m, role };
  });
  return {
    measureInstances,
    ...syncIdsFromInstances(measureInstances),
  };
}

/** Numbered work scope the advisor sees while answering — same text as the packet. */
/** Indoor set-and-secure — easy to swap later (e.g. suspended air handler). */
function seismicSecureLine(familyId: string): string {
  const unit = familyId === "air_handler" ? "air handler" : "furnace";
  return `Set and secure the new ${unit} to meet Bay Area earthquake standards.`;
}

const BATH_FAN_CLEANUP =
  "Protect floors, counters, and fixtures in the bathroom and keep dust to a minimum.";

function insertBathFanCleanup(inst: MeasureInstance, lines: string[]): void {
  if (inst.familyId !== "bath_fan") return;
  const contractor =
    inst.jobPath === "contractor" ||
    String(inst.scopeAnswers?.install_type || "") === "contractor_new";
  if (contractor) return;
  if (lines.some((l) => /keep dust to a minimum|thoroughly clean/i.test(l)))
    return;
  const afterDemo = lines.findIndex((l) =>
    /Remove your existing bath fan/i.test(l),
  );
  lines.splice(afterDemo >= 0 ? afterDemo + 1 : 0, 0, BATH_FAN_CLEANUP);
}

function applyBathFanStartup(
  inst: MeasureInstance,
  product: Product | null | undefined,
  lines: string[],
): void {
  if (inst.familyId !== "bath_fan") return;
  const sense = /WhisperSense|FAN-PANA-SENSE/i.test(
    `${product?.name || ""} ${product?.sku || ""}`,
  );
  const next = sense
    ? "Check, test, and start the new bath fan for proper operation, including the motion sensor."
    : "Check, test, and start the new bath fan for proper operation.";
  const i = lines.findIndex((l) =>
    /Check airflow|test the new bath fan|start the new bath fan/i.test(l),
  );
  if (i >= 0) lines[i] = next;
  else lines.push(next);
}

function joinAnd(parts: string[]): string {
  const list = parts.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

function ductlessNamedRooms(inst: MeasureInstance): string[] {
  const rooms = inst.ductlessHeadRooms || [];
  const names = inst.ductlessHeadRoomNames || [];
  const seeded = inst.scopeAnswers || {};
  const n = Math.max(
    Number(inst.ductlessZones || seeded.ms_zones || 0) || 0,
    rooms.length,
    8,
  );
  const out: string[] = [];
  const roomLabel = (id: string, custom?: string) => {
    if ((id === "other" || id === "custom") && String(custom || "").trim()) {
      return String(custom).trim();
    }
    return DUCTLESS_HEAD_ROOMS.find((r) => r.id === id)?.label || "";
  };
  for (let i = 0; i < n; i++) {
    const id = String(rooms[i] || seeded[`ms_h${i + 1}_room`] || "").trim();
    if (!id) continue;
    const custom = String(
      names[i] || seeded[`ms_h${i + 1}_room_name`] || "",
    ).trim();
    const label = roomLabel(id, custom);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

function isAdvisorPermitLine(line: string): boolean {
  return /mechanical permit|include mechanical permit|need a permit|pull(?:s|ing)? (?:a |the )?permit|building permit for this|permit \(always/i.test(
    line,
  );
}

function ensureDuctlessRefrigerantScope(
  inst: MeasureInstance,
  body: string[],
): void {
  if (inst.familyId !== "ductless") return;
  const zones =
    Number(inst.ductlessZones || inst.scopeAnswers?.ms_zones || 0) || 0;
  const rooms = ductlessNamedRooms(inst);
  const multi = zones >= 2 || rooms.length >= 2;
  const idxs = body
    .map((l, i) => (/refrigerant line/i.test(l) ? i : -1))
    .filter((i) => i >= 0);
  const reuse = idxs.some((i) =>
    /existing path|reuse/i.test(body[i]),
  );
  const next = reuse
    ? multi
      ? rooms.length
        ? `Connect existing refrigerant line sets from the outdoor condenser to the indoor heads in ${joinAnd(rooms)}.`
        : `Connect existing refrigerant line sets from the outdoor condenser to each indoor head.`
      : rooms.length === 1
        ? `Connect existing refrigerant line set from the outdoor condenser to the indoor head in ${rooms[0]}.`
        : `Connect existing refrigerant line set from the outdoor condenser to the indoor head.`
    : multi
      ? rooms.length
        ? `Install new refrigerant line sets from the outdoor condenser to the new indoor heads in ${joinAnd(rooms)}.`
        : `Install new refrigerant line sets from the outdoor condenser to each new indoor head.`
      : rooms.length === 1
        ? `Install new refrigerant line set from the outdoor condenser to the new indoor head in ${rooms[0]}.`
        : `Install new refrigerant line set from the outdoor condenser to the new indoor head.`;
  for (let j = idxs.length - 1; j >= 0; j--) body.splice(idxs[j], 1);
  const afterPad = body.findIndex((l) =>
    /preformed(?: equipment)? pad|existing pad|pour a new pad|Set the new outdoor unit|Set the outdoor unit on|custom concrete pad/i.test(
      l,
    ),
  );
  const lastHead = body.reduce(
    (acc, l, i) =>
      /Mount a high-wall|Install a (?:thin|low-wall|slim|4-way)|indoor head in/i.test(
        l,
      )
        ? i
        : acc,
    -1,
  );
  const beforeElec = body.findIndex((l) =>
    /dedicated .+ circuit|electrical work|Install a new dedicated/i.test(l),
  );
  const at =
    afterPad >= 0
      ? afterPad + 1
      : lastHead >= 0
        ? lastHead + 1
        : beforeElec >= 0
          ? beforeElec
          : body.length;
  body.splice(at, 0, next);
}

function reorderDuctlessPacketBody(body: string[]): void {
  const isHeadLine = (l: string) =>
    /indoor head|high-wall|floor-console|cassette|slim, hidden|Mount indoor heads/i.test(
      l,
    ) && !/refrigerant line/i.test(l);
  const isPadLine = (l: string) =>
    /preformed(?: equipment)? pad|existing pad|pour a new pad|Set the (?:new )?outdoor unit on|custom concrete pad/i.test(
      l,
    );
  const isLineSet = (l: string) => /refrigerant line/i.test(l);
  const isElecLine = (l: string) =>
    /dedicated .+ circuit|electrical work|Install a new dedicated|by others.{0,20}all electrical/i.test(
      l,
    );
  const isCloseLine = (l: string) => /Check, test/i.test(l);
  const isDemoLine = (l: string) =>
    /haul it away|haul them away|Professionally recover|Remove your existing/i.test(
      l,
    );
  const demosL = body.filter(isDemoLine);
  const headsL = body.filter((l) => isHeadLine(l) && !isDemoLine(l));
  const padsL = body.filter(isPadLine);
  const lineL = body.filter(isLineSet);
  const elecL = body.filter(isElecLine);
  const closeL = body.filter(isCloseLine);
  const restL = body.filter(
    (l) =>
      !isDemoLine(l) &&
      !isHeadLine(l) &&
      !isPadLine(l) &&
      !isLineSet(l) &&
      !isElecLine(l) &&
      !isCloseLine(l),
  );
  body.length = 0;
  body.push(
    ...demosL,
    ...headsL,
    ...padsL,
    ...lineL,
    ...elecL,
    ...restL,
    ...closeL,
  );
}

function collapseDuctlessHeadLines(lines: string[]): string[] {
  const isHead = (l: string) =>
    /Mount (?:a high-wall indoor head|the \d+k)|Install (?:a thin one-way|a low-wall indoor|a slim, hidden indoor|the \d+k)/i.test(
      l,
    );
  const heads = lines.filter(isHead);
  if (heads.length < 3) return lines;
  const rooms = heads
    .map((l) => {
      const m =
        l.match(/\bin ([^,]+?)(?:,| on |, in )/i) ||
        l.match(/\bfor ([^.]+)\./i);
      return (m?.[1] || "").replace(/\s+on an approved.*$/i, "").trim();
    })
    .filter(Boolean);
  if (rooms.length < 3) return lines;
  const list =
    rooms.length === 1
      ? rooms[0]
      : rooms.slice(0, -1).join(", ") + ", and " + rooms[rooms.length - 1];
  const combined = `Mount indoor heads in ${list}. Flash and seal each penetration and slope the condensate so it drains.`;
  const out: string[] = [];
  let placed = false;
  for (const l of lines) {
    if (!isHead(l)) {
      out.push(l);
      continue;
    }
    if (!placed) {
      out.push(combined);
      placed = true;
    }
  }
  return out;
}

function insertIncludedSeismicSecure(familyId: string, lines: string[]): void {
  if (familyId !== "furnace" && familyId !== "air_handler") return;
  if (lines.some((l) => /earthquake|seismic.?secur|Bay Area earthquake/i.test(l)))
    return;
  const line = seismicSecureLine(familyId);
  if (!lines.length) {
    lines.push(line);
    return;
  }
  const afterDemo = lines.findIndex((l) =>
    /haul it away|haul them away|Professionally recover the refrigerant|^Remove your existing/i.test(
      l,
    ),
  );
  const afterLead = lines.findIndex((l) => /will install a new/i.test(l));
  const at =
    afterDemo >= 0
      ? afterDemo + 1
      : afterLead >= 0
        ? afterLead + 1
        : 0;
  lines.splice(at, 0, line);
}

function bareScopeLine(line: string): string {
  return String(line || "")
    .replace(/^\d+[\.)]\s*/, "")
    .replace(/^[•\-*]\s*/, "")
    .trim()
    .toLowerCase();
}

function collapseLineSetPair(lines: string[]): string[] {
  const isLine = (l: string) =>
    /line.?set|refrigerant line|reconnect to existing lin/i.test(l);
  const isCover = (l: string) =>
    /line.?set cover|line hide|UV|insulat(?:e|ion).{0,24}line/i.test(l);
  const isPen = (l: string) =>
    /penetrat|wall sleeve|line.?set hole|core.?drill/i.test(l);
  const reuse = lines.filter(
    (l) => isLine(l) && /reconnect|reuse|existing line/i.test(l),
  );
  const fresh = lines.filter(
    (l) => isLine(l) && /new line|run a new|install new refrigerant/i.test(l),
  );
  const extras = lines.filter((l) => isCover(l) || isPen(l));
  if (!reuse.length && !fresh.length) return lines;
  const rest = lines.filter((l) => !isLine(l) && !isCover(l) && !isPen(l));
  const coverBit = extras.some((l) => isCover(l));
  const merged = reuse.length
    ? coverBit
      ? "Reconnect to the existing line set and protect the run."
      : "Reconnect to the existing line set."
    : coverBit
      ? "Run a new line set and protect the run."
      : fresh[0] || "Run a new line set.";
  const at = lines.findIndex((l) => isLine(l) || isCover(l) || isPen(l));
  const out = [...rest];
  out.splice(Math.max(0, at <= rest.length ? at : rest.length), 0, merged);
  return out;
}

function mergeTouchedWorkScope(locked: string, compiled: string): string {
  const hand = locked
    .split(/\n/)
    .map((l) => l.trimEnd())
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""));
  if (!compiled.trim()) return locked.trim();
  const auto = compiled
    .split(/\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean);
  const have = new Set(
    hand.map(bareScopeLine).filter((s) => s && s !== "notes"),
  );
  const out = [...hand];
  for (const line of auto) {
    const bare = bareScopeLine(line);
    if (!bare || bare === "notes") continue;
    if (have.has(bare)) continue;
    if (
      [...have].some(
        (h) =>
          h.length > 24 &&
          bare.length > 24 &&
          (h.startsWith(bare.slice(0, 40)) || bare.startsWith(h.slice(0, 40))),
      )
    )
      continue;
    out.push(line);
    have.add(bare);
  }
  return out
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
}

export function liveWorkScopeDocument(
  inst: MeasureInstance,
  product: Product | null | undefined,
  answers?: WizardAnswers | null,
): string {
  const lockedTouched =
    inst.workScopeTouched && (inst.workScope || "").trim()
      ? inst.workScope!.trim()
      : null;
  if (FILL_IN_SKIP_FAMILIES.has(inst.familyId)) {
    return (inst.workScope || product?.workScope || "").trim();
  }
  if (
    inst.familyId === "ductwork" &&
    !String(inst.scopeAnswers?.duct_plan || "").trim() &&
    !inst.workScopeTouched
  ) {
    return "";
  }
  const seeded: ScopeAnswers = { ...(inst.scopeAnswers || {}) };
  if (inst.familyId === "ductless") {
    if (inst.ductlessZones && !seeded.ms_zones) seeded.ms_zones = inst.ductlessZones;
    if (seeded.line_set === "new") seeded.line_set = "new_path";
    if (seeded.line_set === "reuse") seeded.line_set = "reuse_path";
  }
  if (inst.familyId === "zoning" && inst.zoneCount && !seeded.zone_count) {
    seeded.zone_count = String(inst.zoneCount);
  }
  if (inst.familyId === "zoning" && !seeded.zone_mfr) {
    seeded.zone_mfr = inferZoneMfr({
      sku: product?.sku,
      name: product?.name,
      selectedBrands: inst.selectedBrands,
    });
  }
  if (inst.familyId === "hrv") {
    if (inst.hrvKind && !seeded.hrv_kind) seeded.hrv_kind = inst.hrvKind;
    if (inst.hrvSqft && !seeded.hrv_sqft) seeded.hrv_sqft = inst.hrvSqft;
    if (inst.hrvBeds && !seeded.hrv_beds) seeded.hrv_beds = inst.hrvBeds;
    const blob = `${product?.sku || ""} ${product?.name || ""}`;
    if (/ERV-HW|energy recovery/i.test(blob) && !/heat recovery/i.test(product?.name || ""))
      seeded.hrv_kind = "erv";
    else if (/HRV-HW|heat recovery ventilator/i.test(blob))
      seeded.hrv_kind = "hrv";
  }
  if (inst.familyId === "bath_fan" && jobHasMajorOnJob(answers)) {
    seeded.fan_visit = "with";
  }
  if (inst.familyId === "electrical" && jobHasMajorOnJob(answers)) {
    seeded.ejob_visit = "with";
  }
  if (inst.familyId === "humidifier" && jobHasMajorOnJob(answers)) {
    seeded.hum_visit = "with";
  }
  if (inst.familyId === "dehumidifier" && jobHasMajorOnJob(answers)) {
    seeded.dh_visit = "with";
  }
  if (inst.familyId === "humidifier") {
    const kind = inst.humidifierKind;
    if (kind) seeded.hum_kind = kind;
  }
  if (inst.familyId === "bath_fan") {
    const sku = product?.sku || "";
    if (fanHasSelectableCfm(sku) && inst.bathCfm) {
      seeded.fan_cfm = String(inst.bathCfm);
    } else {
      delete seeded.fan_cfm;
    }
    const blob = `${sku} ${product?.name || ""}`.toLowerCase();
    seeded.fan_needs_switch = /sense/.test(blob) ? "no" : "yes";
  }
  if (inst.familyId === "water_heater" && product) {
    const style = inst.waterHeaterStyle || detectWaterHeaterStyle(product);
    if (style) seeded.wh_style = style;
    seeded.wh_vent_kind = detectWhVentKind(product, style);
  }
  if (inst.familyId === "furnace" && product) {
    const eff = detectFurnaceEffStyle(product);
    seeded.furn_vent_kind =
      eff === "high_eff" || eff === "uln_high" || eff === "navien_npf"
        ? "pvc"
        : "bvent";
  }
  const circ =
    inst.familyId === "electrical"
      ? electricalCircuitOverride(inst) ||
        (product ? resolveProductCircuit(product, inst.familyId) : null)
      : product
        ? resolveProductCircuit(product, inst.familyId)
        : null;
  if (circ && !seeded.elec_voltage) seeded.elec_voltage = circ.voltId;
  const compiled = questionnaireForFamily(inst.familyId)
    ? compileScopeAnswers(inst.familyId, seeded, undefined, {
        isHybrid: jobHasHybridHeat(answers || null),
        excludeIds: new Set([
          ...offeredOptionQuestionIds(inst, answers || undefined),
          ...PAD_FOLLOW_UP_IDS,
          ...jobPathCompileExcludeIds(
            inst.familyId,
            inst.jobPath,
            inst.wallVentStyle || String(inst.scopeAnswers?.wall_path || ""),
          ),
          ...(siblingOwnsLineSet(inst, answers)
            ? [...LINE_SET_QUESTION_IDS]
            : []),
          ...(inst.familyId !== "permits" ? ["ms_permit"] : []),
        ]),
        circuit: circ
          ? {
              volts: circ.voltId,
              ampId: circ.ampId,
              label: circ.label,
              breakerAmps: circ.breakerAmps,
            }
          : null,
      })
    : null;
  const lead = equipmentLeadLines(product, inst.familyId, inst.gasFuel);
  if (
    inst.familyId === "ductless" &&
    lead[1] &&
    product
  ) {
    const zones = Number(inst.ductlessZones || inst.scopeAnswers?.ms_zones || 0) || 0;
    const roomList = ductlessNamedRooms(inst);
    const face = customerInstallName(product);
    if (zones >= 2) {
      lead[1] = roomList.length
        ? `Install a new ${face} with indoor heads in ${joinAnd(roomList)}.`
        : `Install a new ${face} with indoor heads in each zone.`;
    } else {
      const style = String((inst.ductlessHeadStyles || [])[0] || "").trim();
      const styleName =
        style === "high_wall"
          ? "high-wall indoor"
          : style === "low_wall"
            ? "floor-console indoor"
            : style === "one_way"
              ? "1-way cassette indoor"
              : style === "four_way"
                ? "4-way cassette indoor"
                : style === "slim_duct"
                  ? "slim ducted indoor"
                  : style === "ducted_ah"
                    ? "ducted indoor"
                    : "";
      lead[1] = styleName
        ? `Install a new ${face} with a ${styleName}.`
        : `Install a new ${face}.`;
    }
  }
  if (
    inst.familyId === "zoning" &&
    lead[1] &&
    String(seeded.zone_job || inst.scopeAnswers?.zone_job) === "replace"
  ) {
    const face = customerInstallName(product);
    lead[1] = `Replace the existing zone panel with a new ${face}.`;
  }
  let raw = collapseDuctlessHeadLines(
    collapseLineSetPair(
    collapsePadScopeLines(
      ((compiled && compiled.scopeLines) || [])
        .map((l) => l.replace(/^\d+[\.)]\s*/, "").trim())
        .filter(Boolean)
        .filter(
          (l) =>
            !/client accepts hybrid|sound level at the current|room volume is large enough|no ventilation duct required|panel has room for the new breaker|Existing service light and GFI/i.test(
              l,
            ),
        ),
    ),
    ),
  ).map(rewriteBrandInText);
  if (inst.familyId === "zoning") {
    raw = collapseZoningScopeLines(raw, seeded);
  }
  const isDemo = (l: string) =>
    /haul it away|haul them away|Professionally recover the refrigerant/i.test(
      l,
    ) || /^Remove your existing/i.test(l);
  const isRecoverDup = (l: string) =>
    /Recover refrigerant from the existing system/i.test(l);
  const isNote = (l: string) =>
    /manufacturer recommends yearly|yearly maintenance/i.test(l);
  const isOthersOutdoor = (l: string) =>
    /removal of existing outdoor(?:\s*\/\s*ductless)? equipment by others/i.test(
      l,
    );
  const demos = raw.filter(isDemo);
  const notes = raw.filter(isNote);
  let rest = raw.filter(
    (l) =>
      !isDemo(l) &&
      !isNote(l) &&
      !isRecoverDup(l) &&
      !isOthersOutdoor(l),
  );
  if (
    rest.some((l) =>
      /Reconnect (?:to existing )?condensate|Install new condensate drain/i.test(
        l,
      ),
    )
  ) {
    rest = rest.filter(
      (l) =>
        !/^Connect condensate to an approved drain/i.test(l) &&
        !/^Connect furnace condensate to an approved/i.test(l),
    );
  }
  const body = [...rest];
  insertIncludedSeismicSecure(inst.familyId, body);
  insertBathFanCleanup(inst, body);
  applyBathFanStartup(inst, product, body);
  ensureDuctlessRefrigerantScope(inst, body);
  if (inst.familyId !== "permits") {
    for (let i = body.length - 1; i >= 0; i--) {
      if (isAdvisorPermitLine(body[i])) body.splice(i, 1);
    }
  }
  if (
    familyGetsEquipmentLead(inst.familyId) &&
    !body.some((l) => /Check, test/i.test(l) || /Confirm proper operation/i.test(l))
  ) {
    const close = equipmentCloseLine(inst.familyId, product);
    body.push(close);
  }
  if (answers) {
    for (const d of accessoriesForInstance(inst, answers)) {
      if (!(inst.accessoryPicks || []).includes(d.id)) continue;
      const line = (d.offerScopeLine || "").trim();
      if (!line) continue;
      if (body.some((l) => l.toLowerCase() === line.toLowerCase())) continue;
      body.push(line);
    }
  }
  if (
    String(inst.scopeAnswers?.ducted_filter_reuse || "") === "1" ||
    String(inst.scopeAnswers?.ducted_filter || "") === "reuse"
  ) {
    const reuse =
      "Reuse the existing filter system. It meets manufacturer requirements to protect the new equipment.";
    if (!body.some((l) => /existing filter system/i.test(l))) {
      const seismicAt = body.findIndex((l) =>
        /earthquake|Set and secure the new/i.test(l),
      );
      body.splice(seismicAt >= 0 ? seismicAt + 1 : body.length, 0, reuse);
    }
  }
  if (
    instanceReconnectsRecirc(inst) &&
    instanceIsHpwh(inst, product)
  ) {
    body.push(HPWH_RECIRC_CONTRACT_NOTE);
  }
  if (inst.familyId === "ductless") reorderDuctlessPacketBody(body);
  const numberedLead = [...lead];
  if (
    numberedLead[1] &&
    body[0] &&
    /^Install a new /i.test(numberedLead[1]) &&
    /^Install a new /i.test(body[0]) &&
    body[0].length > numberedLead[1].length + 8
  ) {
    numberedLead.splice(1, 1);
  }
  // Work order: pull the old unit first. Model number always sits on line 2
  // of the remaining packet (stamp+product, or product after demo).
  const stamp = numberedLead[0] ? [numberedLead[0]] : [];
  const productLine = numberedLead.slice(1);
  const head = demos.length
    ? [...stamp, ...demos, ...productLine]
    : [...stamp, ...productLine];
  const numbered = [...head, ...body].map((l, i) => `${i + 1}. ${l}`);
  const noteBlock = notes.length
    ? ["", "Notes", ...notes.map((n) => `• ${n}`)]
    : [];
  const parts = [...numbered, ...noteBlock].filter(
    (l, i, arr) => !(l === "" && arr[i - 1] === ""),
  );
  const liveText = parts.length
    ? parts.join("\n")
    : (inst.workScope || product?.workScope || "").trim();
  if (lockedTouched) return mergeTouchedWorkScope(lockedTouched, liveText);
  return liveText;
}

export type SigningOptionPreview = {
  id: string;
  label: string;
  detail: string;
  priceLabel?: string;
};

/** Options the customer can pick at signing — shown under included work scope. */
export function signingOptionsForInstance(
  inst: MeasureInstance,
  answers: WizardAnswers | null | undefined,
  product?: Product | null,
  products: Product[] = [],
): SigningOptionPreview[] {
  const out: SigningOptionPreview[] = [];
  const defs = accessoriesForInstance(inst, answers || undefined);
  for (const accId of inst.accessoryOffers || []) {
    const d = defs.find((x) => x.id === accId);
    if (!d) continue;
    const ids = [...d.ownedQuestionIds, ...d.followUpQuestionIds];
    const follow = ids.length
      ? compileScopeAnswers(inst.familyId, inst.scopeAnswers || {}, undefined, {
          onlyIds: ids,
        })
      : null;
    const hours =
      (Number(d.laborHours) || 0) + (follow?.extraLaborHours || 0);
    const mat =
      (Number(d.materialCost) || 0) + (follow?.extraMaterialCost || 0);
    const sell = estimateScopeExtraSell(hours, mat);
    const lines = (follow?.scopeLines || []).filter(Boolean);
    if (!lines.length && d.offerScopeLine) lines.push(d.offerScopeLine);
    const hatchPicked = (inst.accessoryPicks || []).includes("attic_hatch");
    if (d.id === "attic_ladder" && hatchPicked) {
      const hatch = defs.find((x) => x.id === "attic_hatch");
      const hatchIds = hatch
        ? [...hatch.ownedQuestionIds, ...hatch.followUpQuestionIds]
        : [];
      const hatchFollow = hatchIds.length
        ? compileScopeAnswers(
            inst.familyId,
            inst.scopeAnswers || {},
            undefined,
            { onlyIds: hatchIds },
          )
        : null;
      const hatchSell = estimateScopeExtraSell(
        (Number(hatch?.laborHours) || 0) + (hatchFollow?.extraLaborHours || 0),
        (Number(hatch?.materialCost) || 0) + (hatchFollow?.extraMaterialCost || 0),
      );
      const delta = Math.max(0, sell - hatchSell);
      out.push({
        id: d.id,
        label: "Upgrade to pull-down ladder",
        detail:
          "Same opening. Difference only — hatch money comes out, ladder goes in.",
        priceLabel: `+$${Math.round(delta || sell)}`,
      });
      continue;
    }
    out.push({
      id: d.id,
      label: d.label,
      detail: lines.join(" "),
      priceLabel: `+$${Math.round(Math.max(0, sell))}`,
    });
  }
  const picked = answers?.optionSelections?.[inst.id] || [];
  if (product && picked.length) {
    for (const oid of picked) {
      if (out.some((o) => o.id === oid)) continue;
      const opt = (product.options || []).find((o) => o.id === oid);
      const m = /^tier_up_(.+)_to_(.+)$/i.exec(oid);
      const targetSku = String(opt?.upgradeSku || m?.[2] || "").trim();
      const target =
        (targetSku &&
          products.find(
            (p) => (p.sku || "").toUpperCase() === targetSku.toUpperCase(),
          )) ||
        null;
      if (target && target.id === product.id) continue;
      const alt = target ? makeAlternateProductOption(product, target) : null;
      const delta = Number(alt?.priceDelta ?? opt?.priceDelta ?? 0);
      const sell = target ? liveSellPrice(target) : 0;
      const label =
        (target
          ? packetFaceTitle(target) ||
            customerInstallName(target) ||
            target.tierLabel ||
            target.name
          : "") ||
        opt?.title ||
        (m ? `Option: ${m[2]}` : oid);
      out.push({
        id: oid,
        label,
        detail: (alt?.body || opt?.body || "").trim(),
        priceLabel: delta > 0 ? `+$${Math.round(delta)}` : "+$0",
      });
    }
  }
  return out;
}

export function isAlwaysIncludedLanguageFamily(
  familyId: string | null | undefined,
): boolean {
  return [
    "permits",
    "install",
    "conversion_guide",
    "hpwh_guide",
    "hers",
  ].includes(familyId || "");
}

/** Packet-language families (view/edit text; no Optional/Hold/Pkg). */
export function isLanguageMeasureFamily(
  familyId: string | null | undefined,
): boolean {
  return isAlwaysIncludedLanguageFamily(familyId) || familyId === "maintenance";
}

export function isEducationLanguageProduct(p: Product): boolean {
  if (p.sku === HP_CONVERSION_GUIDE_SKU || p.sku === HPWH_EXPECT_SKU)
    return true;
  if ((p.category || "").toLowerCase() === "education") return true;
  return /gas furnace vs heat pump|what changes|expectation language|heat pump water heater — what to expect|hpwh/i.test(
    `${p.name} ${p.description || ""}`,
  );
}

export function isHeatPumpWaterHeaterProduct(p: Product): boolean {
  if (p.sku === HPWH_EXPECT_SKU) return false;
  if (isEducationLanguageProduct(p)) return false;
  const blob = `${p.name} ${p.sku} ${p.category} ${p.description || ""}`.toLowerCase();
  if (/heat pump water|hybrid water heater|hpwh|heat-pump water/.test(blob))
    return true;
  if (
    /water heat|tankless|navien/.test(blob) &&
    /heat.?pump|hybrid/.test(blob)
  )
    return true;
  return false;
}

/** Contract note when an HPWH is tied to an existing recirc loop. */
export const HPWH_RECIRC_CONTRACT_NOTE =
  "Heat pump water heater and existing recirculation: Heat pump (hybrid) water heaters are not designed to run with a recirculation pump. The existing recirc loop can be reconnected if you want, but that typically cuts available hot-water capacity and efficiency. The heater recovers more slowly and may run more often. You acknowledge those effects and have asked us to reconnect the existing recirc as-is.";

export const HPWH_RECIRC_ADVISOR_NOTE =
  "Heat pump water heaters are not designed for recirc pumps. Reconnecting is possible, but they lose capacity and efficiency. That wording goes on the contract notes if they choose reconnect.";

export function instanceReconnectsRecirc(inst: MeasureInstance): boolean {
  const a = inst.scopeAnswers || {};
  const v = String(a.wh_recirc || a.wh_recirc_kind || "");
  if (v === "reattach" || v === "existing") return true;
  const picks = inst.accessoryPicks || [];
  const offers = inst.accessoryOffers || [];
  return (
    picks.includes("recirc") ||
    picks.includes("tl_recirc") ||
    offers.includes("recirc") ||
    offers.includes("tl_recirc")
  );
}

export function instanceIsHpwh(
  inst: MeasureInstance,
  product?: Product | null,
): boolean {
  if (inst.familyId !== "water_heater") return false;
  if (inst.waterHeaterStyle === "hybrid") return true;
  if (product && isHeatPumpWaterHeaterProduct(product)) return true;
  return false;
}

export function hpwhRecircNotesFromAnswers(
  a: WizardAnswers,
  products: Product[],
): string | null {
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const inst of a.measureInstances || []) {
    if (!instanceReconnectsRecirc(inst)) continue;
    const p = inst.productId ? byId.get(inst.productId) : undefined;
    if (instanceIsHpwh(inst, p)) return HPWH_RECIRC_CONTRACT_NOTE;
  }
  return null;
}

/** Packet / fill-in services — auto-tied to a job, never picked as a unit. */
const FILL_IN_SERVICE_FAMILIES: MeasureFamilyId[] = [
  ...LANGUAGE_TAIL_FAMILIES,
  "conversion_guide",
  "hpwh_guide",
];

const FILL_IN_SERVICE_SKUS = new Set([
  "SVC-HERS",
  "SVC-PERMIT",
  "SVC-LOAD",
  "SVC-INSTALL",
  HP_CONVERSION_GUIDE_SKU,
  HPWH_EXPECT_SKU,
]);

function isFillInServiceFamily(family: string | null | undefined): boolean {
  return FILL_IN_SERVICE_FAMILIES.includes(family as MeasureFamilyId);
}

function isFillInServiceProduct(p: Product): boolean {
  const sku = (p.sku || "").toUpperCase();
  if (FILL_IN_SERVICE_SKUS.has(sku) || FILL_IN_SERVICE_SKUS.has(p.sku || "")) {
    return true;
  }
  const fid = (p.familyId || "").toLowerCase().replace(/-/g, "_");
  if (isFillInServiceFamily(fid) || fid === "permit") return true;
  return /hers test|hers rater|title 24 hers|state required independent hers/i.test(
    p.name || "",
  );
}

export function productMatchesMeasureFamily(
  p: Product,
  family: MeasureFamilyId,
): boolean {
  const name = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  const ductless = isDuctlessProduct(p);
  // Education language is ONLY education families — never a furnace/HP model
  if (
    family !== "conversion_guide" &&
    family !== "hpwh_guide" &&
    isEducationLanguageProduct(p)
  ) {
    return false;
  }
  // Fill-in / packet services stay on their own measure. Never a unit.
  if (isFillInServiceProduct(p) && !isFillInServiceFamily(family)) {
    return false;
  }
  // Service SKUs (HERS, permit, disconnect…) never appear as equipment.
  if (
    MAJOR_MEASURE_IDS.includes(family) &&
    /^(SVC-)/i.test(p.sku || "")
  ) {
    return false;
  }
  // Owner “Shows on this measure” — honor familyId so a novice-added SKU appears.
  const fid = String(p.familyId || "")
    .toLowerCase()
    .replace(/_/g, "-");
  const fam = String(family).toLowerCase().replace(/_/g, "-");
  if (fid === fam || fid.startsWith(`${fam}-`)) {
    if (fam === "heat_pump" && ductless) return false;
    if (MAJOR_MEASURE_IDS.includes(family) && /^(SVC-)/i.test(p.sku || ""))
      return false;
    return true;
  }
  switch (family) {
    case "heat_pump":
      if (ductless) return false;
      if (isEducationLanguageProduct(p)) return false;
      if (p.familyId === "thermostat" || /^STAT-/i.test(p.sku || ""))
        return false;
      if (/thermostat|humidif|truefresh|zone (panel|system)|resideo/i.test(name))
        return false;
      if (p.equipmentKind === "heat_pump") return true;
      return (
        /heat pump/i.test(name) &&
        !/mini.?split|ductless|gas furnace vs|water heater/i.test(name)
      );
    case "ductless":
      return ductless || p.equipmentKind === "ductless";
    case "air_handler":
      if (ductless) return false;
      return (
        p.equipmentKind === "air_handler" || /air handler|fan coil/i.test(name)
      );
    case "coil":
      if (ductless) return false;
      if (/air handler|fan coil/i.test(name)) return false;
      return /coil|evaporator|cased/i.test(name);
    case "furnace":
      // Never mix Williams wall heaters / wall furnaces into central furnace list
      if ((p.sku || "").toUpperCase().startsWith("WALL-")) return false;
      if (p.equipmentKind === "air_handler") return false;
      if (/air handler|fan coil|h2air/i.test(name)) return false;
      if (
        /wall heater|wall furnace|monterey|forsaire|direct.?vent gravity|counterflow direct/i.test(
          name,
        )
      )
        return false;
      return (
        p.equipmentKind === "furnace" ||
        (/furnace|boiler|nhb-|nfb-|h2air/i.test(name) &&
          !/wall/i.test(name) &&
          !/water/i.test(name))
      );
    case "ac":
      if (ductless) return false;
      return (
        p.equipmentKind === "ac" ||
        (/\bac\b|air condition/i.test(name) && !/heat pump/i.test(name))
      );
    case "package_unit":
      return /package unit|rtu|rooftop/i.test(name) || p.sku.startsWith("PKG-");
    case "air_filter":
      // legacy family id → same catalog as air_cleaner
      return (
        (p.sku || "").toUpperCase().startsWith("AA-") ||
        (/aprilaire|filter|media|air cleaner|purifier|filtration/i.test(name) &&
          !/furnace|heat pump|air handler|thermostat/i.test(name))
      );
    case "air_cleaner":
      return (
        (p.sku || "").toUpperCase().startsWith("AA-") ||
        (/aprilaire|filter|media|air cleaner|purifier|filtration/i.test(name) &&
          !/furnace|heat pump|air handler|thermostat/i.test(name))
      );
    case "humidifier":
      return /humidif/i.test(name) && !/dehumid/i.test(name) || /^(HUM-|HUM-HW-)/i.test(p.sku);
    case "dehumidifier":
      return /dehumid/i.test(name) || /^(DH-|DH-HW-|DR65|DR90|DR120)/i.test(p.sku);
    case "hrv":
      return (
        /^(ERV-|HRV-)/i.test(p.sku || "") ||
        /truefresh|energy recovery|heat recovery|\berv\b|\bhrv\b/i.test(name)
      );
    case "attic_ladder":
      return (
        /^(LAD-)/i.test(p.sku || "") ||
        /attic ladder|pull.?down ladder|werner.*ladder/i.test(name)
      );
    case "attic_platform":
      return (
        /^(PLAT-)/i.test(p.sku || "") ||
        /attic platform|walk board|service platform/i.test(name)
      );
    case "ev_charger":
      return (
        /^(EV-)/i.test(p.sku || "") ||
        /ev charger|car charger|level 2|14-50|chargepoint/i.test(name)
      );
    case "range_hood":
      return (
        /^(HOOD-)/i.test(p.sku || "") ||
        /range hood|hood install|hood supplied/i.test(name)
      );
    case "attic_vent":
      return (
        /^(VENT-)/i.test(p.sku || "") ||
        (/attic vent|gable vent|soffit.*ridge|powered attic/i.test(name) &&
          !/bath fan|hrv|erv/i.test(name))
      );
    case "bath_fan":
      return (
        /^(FAN-)/i.test(p.sku || "") ||
        /bath fan|bathroom exhaust/i.test(name)
      );
    case "seismic_valve":
      return (
        /^(EQV-)/i.test(p.sku || "") ||
        /quakevalve|earthquake|seismic shut|excess.?flow/i.test(name)
      );
    case "water_heater":
      if (isEducationLanguageProduct(p)) return false;
      if (isExcludedWaterHeaterProduct(p)) return false;
      if (/boiler|nhb-|nfb-|h2air/i.test(name + " " + (p.sku || "")))
        return false;
      return (
        /water heater|tankless|hot water|hpwh/i.test(name) ||
        /^(AOS-|WTR-)/i.test(p.sku || "")
      );
    case "wall_heater":
      return (
        /^(WALL-WIL-|WALL-RIN-|WALL-COZ-)/i.test(p.sku || "") ||
        ((/williams|rinnai|cozy/i.test(name) &&
          /wall heater|wall furnace|monterey|counterflow|energysaver|top-vent|direct-vent/i.test(
            name,
          )))
      );
    case "permits":
      return (
        p.sku === "SVC-PERMIT" ||
        (/permit/i.test(name) && !/zone|honeywell|infinity/i.test(name))
      );
    case "hers":
      return (
        p.sku === "SVC-HERS" ||
        /hers test|hers rater|title 24 duct/i.test(name)
      );
    case "load_calc":
      return (
        p.sku.includes("LOAD") ||
        /load calc|manual j|precision home load|efficiency analysis/i.test(name)
      );
    case "thermostat":
      return (
        p.sku.startsWith("STAT") ||
        p.sku.startsWith("TH-") ||
        (/thermostat|ecobee|nest|smart stat/i.test(name) &&
          !/zone|honeywell zone|infinity zone/i.test(name))
      );
    case "ductwork":
      // Service ductwork only — never heat pumps / "ducted" equipment
      return (
        (p.sku || "").toUpperCase() === "SVC-DUCT" ||
        (p.sku || "").toUpperCase().startsWith("DUCT") ||
        (/duct seal|duct sealing|duct mod|duct repair|ductwork|return air|supply run|minor modifications/i.test(
          name,
        ) &&
          !ductless &&
          (p.equipmentKind === "other" || !p.equipmentKind))
      );
    case "zoning":
      return (
        (p.sku || "").toUpperCase().startsWith("ZONE-") ||
        (/zone system|zoning|zone panel/i.test(name) &&
          !/install & startup|installation & startup/i.test(name))
      );
    case "install":
      // Startup/install package ONLY — never "professionally installed" zone kits
      return (
        p.sku === "SVC-INSTALL" ||
        (/installation & startup|install & startup|standard installation/i.test(
          p.name,
        ) &&
          !/zone|permit|duct/i.test(name))
      );
    case "maintenance":
      return (
        p.sku.startsWith("SVC-MAINT") ||
        p.sku.startsWith("MAINT") ||
        (/maintenance|membership|service plan|comfort club|shield plan/i.test(
          name,
        ) &&
          !/zone|install/i.test(name))
      );
    case "custom":
    case "sub_asbestos":
    case "sub_crane":
      // No catalog products — advisor writes cost / we hire the trade
      return false;
    case "gas_line":
      return (
        (p.sku || "").toUpperCase() === "SVC-GAS" ||
        (/gas line|gas piping|gas pipe|gas extension/i.test(name) &&
          !/furnace|water heater|wall heater/i.test(p.category || ""))
      );
    case "single_duct":
      return (
        (p.sku || "").toUpperCase() === "SVC-DUCT-ONE" ||
        /single duct|one duct|single supply|single return|one run/i.test(name)
      );
    case "flue":
      return (
        (p.sku || "").toUpperCase() === "SVC-FLUE" ||
        (/flue|b-vent|b vent|vent pipe|chimney liner/i.test(name) &&
          !/direct.?vent wall|williams/i.test(name))
      );
    case "electrical_disconnect":
      return (
        (p.sku || "").toUpperCase() === "SVC-DISC" ||
        /disconnect|whip|electrical disconnect|outdoor disconnect/i.test(name)
      );
    case "electrical":
      return (
        /^ELEC-/.test((p.sku || "").toUpperCase()) ||
        p.familyId === "electrical"
      );
    case "condensate":
      return (
        (p.sku || "").toUpperCase() === "SVC-COND" ||
        /condensate|cond drain|condensate pump|secondary drain/i.test(name)
      );
    case "sheet_metal":
      return (
        (p.sku || "").toUpperCase() === "SVC-SM" ||
        /sheet metal|plenum|transition|fabricat/i.test(name)
      );
    case "conversion_guide":
      return (
        p.sku === HP_CONVERSION_GUIDE_SKU ||
        /gas furnace vs heat pump/i.test(name)
      );
    case "hpwh_guide":
      return (
        p.sku === HPWH_EXPECT_SKU ||
        /heat pump water heater — what to expect|hpwh.*expect/i.test(name)
      );
    default:
      return false;
  }
}

export function partnerStagingsForFamily(
  a: WizardAnswers,
  products: Product[],
  family: MeasureFamilyId,
  excludeInstanceId?: string,
): EquipmentStaging[] {
  const partnerFams = new Set(partnerFamiliesFor(family));
  if (!partnerFams.size) return [];
  const stages: EquipmentStaging[] = [];
  for (const inst of a.measureInstances || []) {
    if (excludeInstanceId && inst.id === excludeInstanceId) continue;
    if (!inst.productId || !partnerFams.has(inst.familyId)) continue;
    const p = products.find((x) => x.id === inst.productId);
    if (!p) continue;
    const opts =
      a.optionSelections?.[inst.id] || a.optionSelections?.[p.id];
    stages.push(effectiveStaging(p, opts, products));
  }
  return stages;
}

export type SelectableProductsOpts = {
  /**
   * When true, skip job-tonnage filter so advisor can pick any model in the family
   * (stray off the normal 3-ton / 4-ton list). Default false = size-matched only.
   */
  showAllSizes?: boolean;
  /** Keep this product visible even if it fails the tonnage filter (already selected). */
  forceIncludeProductId?: string | null;
};

/** @deprecated use familyUsesCapacityFilter — tonnage is only one metric */
export function familyUsesTonnageFilter(family: MeasureFamilyId): boolean {
  return familyUsesCapacityFilter(family);
}

/** True when this family participates in capacity chips (tons / BTU / gallons). */
export function familyUsesCapacityFilter(family: MeasureFamilyId): boolean {
  return metricForFamily(family) != null;
}

export function selectableProductsForFamily(
  products: Product[],
  family: MeasureFamilyId,
  tonnage: number,
  answers?: WizardAnswers,
  excludeInstanceId?: string,
  opts?: SelectableProductsOpts,
): Product[] {
  let list = products.filter((p) => productMatchesMeasureFamily(p, family));
  if (family === "heat_pump" || family === "air_handler" || family === "ac") {
    list = list.filter((p) => !isDuctlessProduct(p));
  }
  if (family === "hrv" && answers && excludeInstanceId) {
    const inst = (answers.measureInstances || []).find(
      (m) => m.id === excludeInstanceId,
    );
    const kind = String(inst?.hrvKind || inst?.scopeAnswers?.hrv_kind || "");
    if (kind === "erv") {
      list = list.filter((p) => /ERV-HW|energy recovery/i.test(`${p.sku} ${p.name}`));
    } else if (kind === "hrv") {
      list = list.filter((p) => /HRV-HW|heat recovery/i.test(`${p.sku} ${p.name}`) && !/energy recovery/i.test(p.name));
    }
    const classCfm = inst?.hrvSqft && inst?.hrvBeds
      ? // hint only — still show the class, do not hide others
        null
      : null;
    void classCfm;
  }
  if (family === "zoning" && answers && excludeInstanceId) {
    const inst = (answers.measureInstances || []).find(
      (m) => m.id === excludeInstanceId,
    );
    const n = Number(inst?.zoneCount || inst?.scopeAnswers?.zone_count || 0);
    if (n >= 2) {
      list = list.filter((p) => {
        const m = /ZONE-(?:HW|INF)-(\d+)/i.exec(p.sku || "");
        return m ? Number(m[1]) === n : /zone/i.test(p.name);
      });
    }
  }
  const showAll = Boolean(opts?.showAllSizes);
  const metric = metricForFamily(family);
  const capacityValues = {
    tons: answers?.systemTonnage ?? tonnage,
    btu: answers?.systemBtu ?? null,
    gallons: answers?.systemGallons ?? null,
  };

  if (!showAll && metric === "tons") {
    // Exact job tonnage only on the main list (not 2.5/5 when 4 is selected).
    list = list.filter((p) => productMatchesTonnage(p, capacityValues.tons || 3));
  }
  // Furnace / wall heater → BTU when a chip is selected
  if (!showAll && metric === "btu" && capacityValues.btu != null) {
    const sized = list.filter((p) =>
      productMatchesCapacity(p, family, capacityValues),
    );
    if (family === "ductless" || sized.length > 0) list = sized;
  }
  // Water heater → gallons when a chip is selected
  if (!showAll && metric === "gallons" && capacityValues.gallons != null) {
    const sized = list.filter((p) =>
      productMatchesCapacity(p, family, capacityValues),
    );
    if (sized.length > 0) list = sized;
  }
  // Always surface the already-selected model even if off-size / off-filter
  const forceId = opts?.forceIncludeProductId;
  if (forceId) {
    const forced = products.find((p) => p.id === forceId);
    if (
      forced &&
      productMatchesMeasureFamily(forced, family) &&
      !list.some((p) => p.id === forced.id)
    ) {
      list = [...list, forced];
    }
  }
  // Show full Comfort / Performance / Infinity ladder for the job tonnage.
  // Do NOT strip tiers by partner staging here — advisors need the full AH/HP list.
  void excludeInstanceId;
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of list) {
    const sku = (p.sku || p.id).toUpperCase();
    if (seen.has(sku)) continue;
    seen.add(sku);
    out.push(p);
  }
  return out.sort((a, b) => {
    const ta = a.tier ?? 1;
    const tb = b.tier ?? 1;
    if (ta !== tb) return ta - tb;
    const pa = a.unitPrice || 0;
    const pb = b.unitPrice || 0;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

/** Options for a measure — accessories + same-family alternates + staged upgrades. */
export function optionsForMeasureInstance(
  product: Product,
  answers: WizardAnswers,
  products: Product[],
  instanceId: string,
  familyId: MeasureFamilyId,
): ProductOption[] {
  const partnerFams = new Set(partnerFamiliesFor(familyId));
  const partnerDetails: { product: Product; staging: EquipmentStaging }[] = [];
  for (const inst of answers.measureInstances || []) {
    if (inst.id === instanceId || !inst.productId) continue;
    if (!partnerFams.has(inst.familyId)) continue;
    const p = products.find((x) => x.id === inst.productId);
    if (!p) continue;
    const opts =
      answers.optionSelections?.[inst.id] || answers.optionSelections?.[p.id];
    partnerDetails.push({
      product: p,
      staging: effectiveStaging(p, opts, products),
    });
  }

  // Staged equipment upgrades (HP/furnace ladders)
  const tierOpts = filterTierUpgradesForPartners(
    product,
    buildTierUpgradeOptions(product, products),
    partnerDetails,
    products,
  );

  // Same-family alternate models (AprilAire filters, wall heaters, etc.)
  // Include any other product that matches this measure family.
  const familyAlts: ProductOption[] = [];
  for (const p of products) {
    if (p.id === product.id) continue;
    if ((p.sku || "") === (product.sku || "")) continue;
    if (!productMatchesMeasureFamily(p, familyId)) continue;
    if (familyId === "wall_heater" && !sameInstallFoundation(product, p)) {
      continue;
    }
    if (familyId === "ductless") {
      const inst = (answers.measureInstances || []).find(
        (i) => i.id === instanceId,
      );
      if (isDuctlessOneToOneZones(inst?.ductlessZones)) {
        if (!sameDuctlessOneToOneSize(product, p)) continue;
      }
    }
    if (familyId === "water_heater") {
      const inst = (answers.measureInstances || []).find(
        (i) => i.id === instanceId,
      );
      const style =
        inst?.waterHeaterStyle || detectWaterHeaterStyle(product);
      if (style && detectWaterHeaterStyle(p) !== style) continue;
      const caps = inst?.selectedCapacities || [];
      if (caps.length) {
        const gal = productCapacityValue(p, "gallons", style);
        if (gal != null && !caps.includes(gal)) continue;
      }
    }
    // Prefer equal-or-higher price so we don't offer a cheaper "downgrade" as default list
    // (advisor can still force via toggle if already selected)
    const alt = makeAlternateProductOption(product, p);
    if (!alt) continue;
    if ((alt.priceDelta ?? 0) < 0) continue;
    familyAlts.push(alt);
  }

  // Rebuild any optionSelections that point at alternates (keeps selected options on packet)
  const picked = answers.optionSelections?.[instanceId] || [];
  for (const oid of picked) {
    if (familyAlts.some((o) => o.id === oid) || tierOpts.some((o) => o.id === oid))
      continue;
    if ((product.options || []).some((o) => o.id === oid)) continue;
    const m = /^tier_up_(.+)_to_(.+)$/i.exec(oid);
    if (!m) continue;
    const targetSku = m[2];
    const target = products.find(
      (p) => (p.sku || "").toUpperCase() === targetSku.toUpperCase(),
    );
    if (!target) continue;
    const alt = makeAlternateProductOption(product, target);
    if (alt) familyAlts.push({ ...alt, id: oid });
  }
  const instForBrands = (answers.measureInstances || []).find(
    (i) => i.id === instanceId,
  );
  const wantedBrands = instForBrands?.allBrandsInSize
    ? null
    : new Set(
        (instForBrands?.selectedBrands || [])
          .map((b) => b.toLowerCase())
          .filter(Boolean),
      );
  const isSelectedOtherBrand = (sku?: string | null) => {
    if (!sku) return false;
    const target = products.find(
      (p) => (p.sku || "").toUpperCase() === sku.toUpperCase(),
    );
    if (!target || target.id === product.id) return false;
    const b = productBrand(target).toLowerCase();
    if (!b) return false;
    if (wantedBrands && wantedBrands.size === 0) return false;
    if (wantedBrands && !wantedBrands.has(b)) return false;
    return productBrand(product).toLowerCase() !== b;
  };

  const baseTier = product.tier ?? 1;
  const upgradesOnly = [...tierOpts, ...familyAlts]
    .filter((o) => {
      if (o.kind !== "tier_upgrade") return true;
      // Keep if explicitly selected even when "lower" tier (already offered)
      if (picked.includes(o.id)) return true;
      // Advisor picked this other brand — keep it as a package even at the same tier
      if (isSelectedOtherBrand(o.upgradeSku) && (o.priceDelta ?? 0) >= 0) {
        return true;
      }
      if (o.upgradeTier != null && product.tier != null && o.upgradeTier <= baseTier) {
        // Allow same-family size alternatives (filters) even without higher tier
        if (familyId === "air_cleaner" || familyId === "air_filter" || familyId === "wall_heater" || familyId === "water_heater" || familyId === "ductless")
          return (o.priceDelta ?? 0) >= 0;
        return false;
      }
      if ((o.priceDelta ?? 0) < 0) return false;
      return true;
    })
    .sort(
      (a, b) =>
        (a.priceDelta ?? 0) - (b.priceDelta ?? 0) ||
        (a.upgradeTier ?? 0) - (b.upgradeTier ?? 0),
    );

  const accessories = (product.options || [])
    .filter((o) => o.kind !== "tier_upgrade")
    .filter((o) => (o.priceDelta ?? 0) >= 0 || isPadOption(o))
    .sort((a, b) => (a.priceDelta ?? 0) - (b.priceDelta ?? 0));

  const merged = [...accessories, ...upgradesOnly];
  const seen = new Set<string>();
  const seenUpgrade = new Set<string>();
  return merged.filter((o) => {
    if (!o.id || seen.has(o.id)) return false;
    const up = (o.upgradeSku || "").trim().toUpperCase();
    if (up) {
      if (seenUpgrade.has(up)) return false;
      seenUpgrade.add(up);
    }
    seen.add(o.id);
    return true;
  });
}

export { productStaging, stagingLabel, effectiveStaging };

export function liveSellPrice(
  p: Product,
  adj?: { extraLaborHours?: number; extraMaterialCost?: number } | null,
): number {
  const listed = Number(p.unitPrice) || 0;
  return resolveMeasureSellPrice({
    materialCost: Number(p.materialCost) || 0,
    laborHours: Number(p.laborHours) || 0,
    unitPrice: listed,
    priceMode: listed > 0 ? "manual" : "auto",
    extraLaborHours: clampAdditive(adj?.extraLaborHours),
    extraMaterialCost: clampAdditive(adj?.extraMaterialCost),
    rates: {
      laborRate: p.laborRate ?? DEFAULT_LABOR_RATE,
      materialDivisor: p.materialDivisor ?? DEFAULT_MATERIAL_DIVISOR,
      laborDivisor: p.laborDivisor ?? DEFAULT_LABOR_DIVISOR,
    },
  }).unitPrice;
}

function applySiteAdjustmentToLine(
  line: QuoteLine,
  adj?: { extraLaborHours?: number; extraMaterialCost?: number } | null,
): QuoteLine {
  if (!adj) return line;
  const extraH = clampAdditive(adj.extraLaborHours);
  const extraM = clampAdditive(adj.extraMaterialCost);
  if (!extraH && !extraM) return line;
  const priced = resolveMeasureSellPrice({
    materialCost: 0,
    laborHours: 0,
    unitPrice: Number(line.unitPrice) || 0,
    priceMode: "manual",
    extraLaborHours: extraH,
    extraMaterialCost: extraM,
    rates: {
      laborRate: line.laborRate || DEFAULT_LABOR_RATE,
      materialDivisor: line.materialDivisor || DEFAULT_MATERIAL_DIVISOR,
      laborDivisor: line.laborDivisor || DEFAULT_LABOR_DIVISOR,
    },
  });
  return {
    ...line,
    laborHours: (line.laborHours || 0) + extraH,
    materialCost: (line.materialCost || 0) + extraM,
    unitPrice: priced.unitPrice,
    priceMode: "manual",
  };
}


const HEAVY_EQUIP_FAMILIES: MeasureFamilyId[] = [
  "heat_pump",
  "furnace",
  "ac",
  "air_handler",
  "ductless",
  "package_unit",
];

export function isLoadCalcProduct(p: Product): boolean {
  return (
    p.sku === "SVC-LOAD" ||
    /precision home load|load & efficiency|manual j/i.test(p.name)
  );
}

/** Load calc is free, never optional, and always on when heavy equipment is on the job. */
export function ensureLoadCalcOnQuote(
  a: WizardAnswers,
  products: Product[],
): Partial<WizardAnswers> {
  const instances = [...(a.measureInstances || [])];
  const hasHeavy = instances.some(
    (i) =>
      HEAVY_EQUIP_FAMILIES.includes(i.familyId) &&
      (i.productId || i.familyId !== "load_calc"),
  );
  // Also if family selected even before product pick
  const fams = new Set(a.selectedMeasureFamilies || []);
  const heavyFam = HEAVY_EQUIP_FAMILIES.some((f) => fams.has(f));
  if (!hasHeavy && !heavyFam) {
    // Remove auto load-only if no equipment? Keep if user had it — still free if present
    return {};
  }

  const loadProd =
    products.find((p) => p.sku === "SVC-LOAD") ||
    products.find((p) => isLoadCalcProduct(p));
  if (!loadProd) return {};

  let measureInstances = instances;
  let slot = measureInstances.find((i) => i.familyId === "load_calc");
  if (!slot) {
    slot = {
      id: ridInst(),
      familyId: "load_calc",
      label: labelForInstance("load_calc", 1),
      productId: loadProd.id,
      role: "included",
      packetTitle: loadProd.name,
      benefits: loadProd.benefits ? [...loadProd.benefits] : undefined,
      workScope: loadProd.workScope,
      description: loadProd.description,
    };
    measureInstances = [...measureInstances, slot];
  } else if (slot.productId !== loadProd.id || slot.role !== "included") {
    measureInstances = measureInstances.map((m) =>
      m.id === slot!.id
        ? {
            ...m,
            productId: loadProd.id,
            role: "included",
            packetTitle: m.packetTitle || loadProd.name,
            benefits: m.benefits || (loadProd.benefits ? [...loadProd.benefits] : undefined),
            workScope: m.workScope || loadProd.workScope,
          }
        : m,
    );
  }

  const sync = syncIdsFromInstances(measureInstances);
  const families = new Set(sync.selectedMeasureFamilies || a.selectedMeasureFamilies || []);
  families.add("load_calc");

  return {
    ...sync,
    measureInstances,
    selectedMeasureFamilies: Array.from(families),
  };
}

function jobNeedsHers(a: WizardAnswers): boolean {
  if (a.hersShortSystem === true) return false;
  if (a.hersAsbestos === true) return false;
  const fams = new Set(a.selectedMeasureFamilies || []);
  const instances = a.measureInstances || [];
  const ducted = (id: MeasureFamilyId) =>
    id === "heat_pump" ||
    id === "ac" ||
    id === "furnace" ||
    id === "air_handler" ||
    id === "coil" ||
    id === "package_unit";
  if (
    instances.some((i) => {
      if (!ducted(i.familyId)) return false;
      if (i.familyId === "heat_pump" && i.hpInstallPath === "mini-split")
        return false;
      return true;
    })
  )
    return true;
  if (instances.some((i) => i.familyId === "ductwork")) return true;
  if (fams.has("ductless") && ![...fams].some(ducted)) return false;
  return [...fams].some(ducted);
}

function jobHasCoolingForHers(a: WizardAnswers): boolean {
  const instOk = (a.measureInstances || []).some(
    (i) =>
      (i.familyId === "ac" ||
        i.familyId === "heat_pump" ||
        i.familyId === "package_unit") &&
      i.hpInstallPath !== "mini-split",
  );
  if (instOk) return true;
  return (a.selectedMeasureFamilies || []).some(
    (f) => f === "ac" || f === "heat_pump" || f === "package_unit",
  );
}

export function hersPacketCopy(cooling: boolean): {
  name: string;
  description: string;
  benefits: string[];
  workScope: string;
} {
  const name = cooling
    ? "State Required Independent HERS Testing of Duct System & AC/Heat Pump"
    : "State Required Independent HERS Testing of Duct System";
  const steps = [
    "Acme HVAC will promptly schedule the required testing after project completion.",
    "Duct Test: This test measures the amount of air leakage in unconditioned areas from the duct system (attic or crawlspace). The HERS rater will need access to all areas of the home that have air vents so they can be properly sealed off for testing.",
    cooling
      ? "AC/Heat Pump Test: This test measures the performance of your new air conditioning system and verifies that the refrigerant levels meet manufacturer specifications."
      : null,
    "These tests generally take from 1 to 2 hours to perform.",
    "Acme HVAC will provide the HERS rater the detailed HVAC equipment specifications as needed.",
    "A compliance certificate will be issued by the California Energy Commission for the finalization of your building permit.",
  ].filter(Boolean) as string[];
  return {
    name,
    description:
      "Title 24 HERS testing required in the Bay Area when ducted HVAC equipment is changed or ducts are altered.",
    benefits: [
      "Effective July 1, 2015, per Title 24, duct testing is now mandatory when HVAC equipment is changed and the ducts are altered. This applies to both residential and commercial applications.",
      "Studies indicate that duct leakage can account for a total of 30% of home energy loss. Even worse than energy loss, leaking ducts pull dust and other harmful irritants into the conditioned space.",
      "For more information, call the energy hotline at the California Energy Commission 1-800-772-3300.",
    ],
    workScope: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  };
}

/** HERS is on every ducted AC / heat pump / furnace job by default.
 * Advisor can turn it off — we do not put it back. Advisor can turn it
 * on for a mini-split — we do not take it off. */
export function ensureHersOnQuote(
  a: WizardAnswers,
  products: Product[],
): Partial<WizardAnswers> {
  const instances = [...(a.measureInstances || [])];
  const needed = jobNeedsHers(a);
  const hersProd = products.find((p) => p.sku === "SVC-HERS");
  const slot = instances.find((i) => i.familyId === "hers");
  if (a.hersAdvisorOff) {
    return {};
  }
  if (!needed) {
    return {};
  }
  if (!hersProd) return {};
  const copy = hersPacketCopy(jobHasCoolingForHers(a));
  let measureInstances = instances;
  if (!slot) {
    measureInstances = [
      ...measureInstances,
      {
        id: ridInst(),
        familyId: "hers",
        label: "HERS testing",
        productId: hersProd.id,
        role: "included",
        packetTitle: copy.name,
        benefits: copy.benefits,
        workScope: copy.workScope,
        description: copy.description,
      },
    ];
  } else {
    measureInstances = measureInstances.map((m) =>
      m.id === slot.id
        ? {
            ...m,
            productId: hersProd.id,
            role: m.role || "included",
            packetTitle: copy.name,
            benefits: copy.benefits,
            workScope: copy.workScope,
            description: m.description || copy.description,
          }
        : m,
    );
  }
  const sync = syncIdsFromInstances(measureInstances);
  const families = new Set(
    sync.selectedMeasureFamilies || a.selectedMeasureFamilies || [],
  );
  families.add("hers");
  return {
    ...sync,
    measureInstances,
    selectedMeasureFamilies: Array.from(families),
  };
}

export const RETIRED_MEASURE_FAMILY_IDS = new Set<MeasureFamilyId>([
  "rebates",
]);

export function isRetiredMeasureFamily(
  id: string | null | undefined,
): boolean {
  return RETIRED_MEASURE_FAMILY_IDS.has(id as MeasureFamilyId);
}

/** Drop retired walk measures (old rebates chip) so they cannot re-enter the job. */
export function stripRetiredRebateMeasures(
  a: WizardAnswers,
): Partial<WizardAnswers> {
  const instances = (a.measureInstances || []).filter(
    (i) => !RETIRED_MEASURE_FAMILY_IDS.has(i.familyId),
  );
  const families = (a.selectedMeasureFamilies || []).filter(
    (id) => !RETIRED_MEASURE_FAMILY_IDS.has(id),
  );
  const dropped =
    instances.length !== (a.measureInstances || []).length ||
    families.length !== (a.selectedMeasureFamilies || []).length;
  if (!dropped) return {};
  const keep = new Set(instances.map((i) => i.id));
  const measureOrder = (a.measureOrder || []).filter((id) => keep.has(id));
  const sync = syncIdsFromInstances(instances);
  return {
    ...sync,
    measureInstances: instances,
    selectedMeasureFamilies: families,
    measureOrder,
    focusMeasureId:
      a.focusMeasureId && keep.has(a.focusMeasureId) ? a.focusMeasureId : null,
  };
}

export function applyHersSiteGates(
  a: WizardAnswers,
  products: Product[],
  next: {
    hersShortSystem?: boolean | null;
    hersAsbestos?: boolean | null;
  },
): Partial<WizardAnswers> {
  const hersShortSystem =
    next.hersShortSystem !== undefined
      ? next.hersShortSystem
      : (a.hersShortSystem ?? null);
  const hersAsbestos =
    next.hersAsbestos !== undefined
      ? next.hersAsbestos
      : (a.hersAsbestos ?? null);
  const block = hersShortSystem === true || hersAsbestos === true;
  let measureInstances = [...(a.measureInstances || [])];
  let families = new Set(a.selectedMeasureFamilies || []);
  if (block) {
    measureInstances = measureInstances.filter((m) => m.familyId !== "hers");
    families.delete("hers");
    return {
      hersShortSystem,
      hersAsbestos,
      hersAdvisorOff: true,
      measureInstances,
      selectedMeasureFamilies: Array.from(families),
    };
  }
  const mid = {
    ...a,
    hersShortSystem,
    hersAsbestos,
    hersAdvisorOff: false,
    measureInstances,
    selectedMeasureFamilies: Array.from(families),
  } as WizardAnswers;
  const withHers = ensureHersOnQuote(mid, products);
  return {
    hersShortSystem,
    hersAsbestos,
    hersAdvisorOff: false,
    ...withHers,
  };
}

/**
 * When any heat pump / hybrid water heater is on the job, auto-include free
 * expectation language (recovery is slower, efficiency is high, placement nuances).
 */
export function ensureHpwhGuideOnQuote(
  a: WizardAnswers,
  products: Product[],
): Partial<WizardAnswers> {
  const byId = new Map(products.map((p) => [p.id, p]));
  const instances = [...(a.measureInstances || [])];

  const hasHpwh = instances.some((i) => {
    if (i.familyId === "hpwh_guide") return false;
    if (i.familyId === "water_heater" && i.waterHeaterStyle === "hybrid")
      return true;
    if (!i.productId) return false;
    const p = byId.get(i.productId);
    return p ? isHeatPumpWaterHeaterProduct(p) : false;
  });
  const hybridPkg = (a.goals || []).includes("hybrid_wh");

  const guideProd =
    products.find((p) => p.sku === HPWH_EXPECT_SKU) ||
    products.find(
      (p) =>
        isEducationLanguageProduct(p) &&
        /heat pump water heater|hpwh/i.test(p.name),
    );

  if (!hasHpwh && !hybridPkg) {
    // Remove auto guide if HPWH no longer on the job (keep other education)
    if (!instances.some((i) => i.familyId === "hpwh_guide")) return {};
    const measureInstances = instances.filter((i) => {
      if (i.familyId !== "hpwh_guide") return true;
      // drop auto-only slots
      return false;
    });
    if (measureInstances.length === instances.length) return {};
    const sync = syncIdsFromInstances(measureInstances);
    const families = new Set(
      sync.selectedMeasureFamilies || a.selectedMeasureFamilies || [],
    );
    families.delete("hpwh_guide");
    return {
      ...sync,
      measureInstances,
      selectedMeasureFamilies: Array.from(families),
    };
  }

  if (!guideProd) {
    const families = new Set<MeasureFamilyId>(
      (a.selectedMeasureFamilies || []) as MeasureFamilyId[],
    );
    families.add("hpwh_guide");
    families.add("water_heater");
    return { selectedMeasureFamilies: Array.from(families) };
  }

  let measureInstances = instances;
  let slot = measureInstances.find((i) => i.familyId === "hpwh_guide");
  if (!slot) {
    // Prefer placing after first water heater instance
    const whIdx = measureInstances.findIndex(
      (i) => i.familyId === "water_heater",
    );
    slot = {
      id: ridInst(),
      familyId: "hpwh_guide",
      label: labelForInstance("hpwh_guide", 1),
      productId: guideProd.id,
      role: "included",
      packetTitle: guideProd.name,
      benefits: guideProd.benefits ? [...guideProd.benefits] : undefined,
      workScope: guideProd.workScope,
      description: guideProd.description,
    };
    if (whIdx >= 0) {
      measureInstances = [
        ...measureInstances.slice(0, whIdx + 1),
        slot,
        ...measureInstances.slice(whIdx + 1),
      ];
    } else {
      measureInstances = [...measureInstances, slot];
    }
  } else if (slot.productId !== guideProd.id || slot.role !== "included") {
    measureInstances = measureInstances.map((m) =>
      m.id === slot!.id
        ? {
            ...m,
            productId: guideProd.id,
            role: "included",
            packetTitle: m.packetTitle || guideProd.name,
            benefits:
              m.benefits ||
              (guideProd.benefits ? [...guideProd.benefits] : undefined),
            workScope: m.workScope || guideProd.workScope,
          }
        : m,
    );
  }

  const sync = syncIdsFromInstances(measureInstances);
  const families = new Set(
    sync.selectedMeasureFamilies || a.selectedMeasureFamilies || [],
  );
  families.add("hpwh_guide");
  // Keep water heater family selected if HPWH is present
  families.add("water_heater");

  return {
    ...sync,
    measureInstances,
    selectedMeasureFamilies: Array.from(families),
  };
}


/** Collapse legacy air_filter family into air_cleaner (one filter/media measure). */
export function migrateAirFilterFamily(a: WizardAnswers): Partial<WizardAnswers> {
  const fams = (a.selectedMeasureFamilies || []).map((f) =>
    (f as string) === "air_filter" ? ("air_cleaner" as MeasureFamilyId) : f,
  );
  const unique = Array.from(new Set(fams)) as MeasureFamilyId[];
  const measureInstances = (a.measureInstances || []).map((m) =>
    (m.familyId as string) === "air_filter"
      ? { ...m, familyId: "air_cleaner" as MeasureFamilyId }
      : m,
  );
  const ah = measureInstances.filter((m) => m.familyId === "air_cleaner");
  const others = measureInstances.filter((m) => m.familyId !== "air_cleaner");
  const withProd = ah.filter((m) => m.productId);
  const empty = ah.filter((m) => !m.productId);
  // One empty slot max if no product yet; keep every slot that has a product
  const keptAh = withProd.length ? withProd : empty.slice(0, 1);
  const measureInstances2 = [...others, ...keptAh];
  const sync = syncIdsFromInstances(measureInstances2);
  return {
    ...sync,
    selectedMeasureFamilies: unique,
    measureInstances: measureInstances2,
  };
}


/**
 * Keep custom packet order stable when measures change:
 * - drop removed instance ids
 * - keep relative order of remaining
 * - append brand-new instances at the end (standard family order among new only)
 */
export function syncMeasureOrder(
  instances: MeasureInstance[],
  prevOrder?: string[] | null,
): string[] {
  const ids = (instances || []).map((i) => i.id);
  const idSet = new Set(ids);
  const kept = (prevOrder || []).filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  const newcomers = ids.filter((id) => !keptSet.has(id));
  return pinFixedMeasureSlots(
    pinLanguageAfterEquipment([...kept, ...newcomers], instances),
    instances,
  );
}

/** Load calc always leads. Permits always close. Everything else keeps its order. */
function pinFixedMeasureSlots(
  order: string[],
  instances: MeasureInstance[],
): string[] {
  const byId = new Map((instances || []).map((i) => [i.id, i] as const));
  const load: string[] = [];
  const permits: string[] = [];
  const rest: string[] = [];
  for (const id of order) {
    const fam = byId.get(id)?.familyId;
    if (fam === "load_calc") load.push(id);
    else if (fam === "permits") permits.push(id);
    else rest.push(id);
  }
  return [...load, ...rest, ...permits];
}

/** Conversion / HPWH language sits with its equipment, never as the first packet line.
 *  Advisor-chosen order of the real measures is left alone. */
function pinLanguageAfterEquipment(
  order: string[],
  instances: MeasureInstance[],
): string[] {
  const byId = new Map((instances || []).map((i) => [i.id, i] as const));
  const first = byId.get(order[0] || "");
  const lang = new Set(["conversion_guide", "hpwh_guide"]);
  if (!first || !lang.has(first.familyId)) return order;
  const hostOf = (fam: string): MeasureFamilyId | null => {
    if (fam === "conversion_guide") return "heat_pump";
    if (fam === "hpwh_guide") return "water_heater";
    return null;
  };
  const langIds = order.filter((id) => hostOf(byId.get(id)?.familyId || ""));
  if (!langIds.length) return order;
  const rest = order.filter((id) => !langIds.includes(id));
  const out = [...rest];
  for (const lid of langIds) {
    const hostFam = hostOf(byId.get(lid)?.familyId || "");
    const host = hostFam
      ? rest.find((id) => byId.get(id)?.familyId === hostFam)
      : undefined;
    if (!host) {
      out.push(lid);
      continue;
    }
    const i = out.indexOf(host);
    out.splice(Math.max(0, i) + 1, 0, lid);
  }
  return out;
}

export function moveMeasureOrderId(
  order: string[],
  id: string,
  dir: -1 | 1,
): string[] {
  const i = order.indexOf(id);
  if (i < 0) return order;
  const j = i + dir;
  if (j < 0 || j >= order.length) return order;
  const next = [...order];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next;
}

export function reorderMeasureOrder(
  order: string[],
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return order;
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function emptyWizardAnswers(products: Product[]): WizardAnswers {
  const defaults = MEASURE_FAMILIES.filter((f) => f.defaultOn).map((f) => f.id);
  const tonnage = 3;
  const base: WizardAnswers = {
    clientCompany: "",
    clientContact: "",
    clientEmail: "",
    clientPhone: "",
    propertyStreet: "",
    propertyCity: "",
    propertyZip: "",
    propertyCounty: "",
    quoteVersion: 1,
    propertyType: "single_family",
    homeSize: "1800_2500",
    goals: [],
    activeJobGoalId: null,
    urgency: "soon",
    issues: [],
    budgetBand: "unknown",
    decisionMakers: "homeowner",
    customNotes: "",
    heatingPath: "furnace",
    selectedMeasureFamilies: defaults,
    measureInstances: [],
    coreProductIds: [],
    optionalProductIds: [],
    optionalPreselectedIds: [],
    optionSelections: {},
    selectedPackageKey: null,
    padMode: "off",
    measureAdjustments: {},
    systemTonnage: tonnage,
    startWindow: "flexible",
    paymentTerms: "check",
    checkDiscountPercent: 2,
    discountPercent: 0,
    // Sales tax not used on Acme packets
    selectedRebateIds: [],
    rebateAmountOverrides: {},
    showMeasurePrices: false,
    measureOrder: [],
    includeTax: false,
    taxRate: 0,
    executiveSummary: "",
    scope: "",
    timeline: "",
    includedFaqIds: FAQ_BANK.map((f) => f.id),
  };
  const rec = recommendFromGoals(base, products);
  return { ...base, ...rec };
}

export function hydrateWizardAnswers(
  products: Product[],
  raw: Partial<WizardAnswers> | null | undefined,
): WizardAnswers {
  const empty = emptyWizardAnswers(products);
  if (!raw) return empty;
  const merged = {
    ...empty,
    ...raw,
    issues: raw.issues || empty.issues,
    coreProductIds: raw.coreProductIds || [],
    optionalProductIds: raw.optionalProductIds || [],
    measureInstances: raw.measureInstances || [],
    selectedMeasureFamilies: raw.selectedMeasureFamilies || empty.selectedMeasureFamilies,
    optionSelections: raw.optionSelections || {},
    measureOrder: syncMeasureOrder(
      raw.measureInstances || [],
      raw.measureOrder || [],
    ),
    selectedRebateIds: Array.isArray(raw.selectedRebateIds)
      ? raw.selectedRebateIds
      : [],
    rebateAmountOverrides: raw.rebateAmountOverrides || {},
  } as WizardAnswers;
  return { ...merged, ...stripRetiredRebateMeasures(merged) };
}

export function toggleMeasureOption(
  a: WizardAnswers,
  productId: string,
  optionId: string,
  on: boolean,
  products?: Product[],
): Partial<WizardAnswers> {
  const current = new Set(a.optionSelections?.[productId] || []);
  const product = products?.find((p) => p.id === productId);
  const inst = (a.measureInstances || []).find((i) => i.id === productId);
  const prod =
    product ||
    (inst?.productId
      ? products?.find((p) => p.id === inst.productId)
      : undefined);
  const tierOpts =
    prod && products ? buildTierUpgradeOptions(prod, products) : [];
  const allOpts = [...(prod?.options || []), ...tierOpts];
  const opt = allOpts.find((o) => o.id === optionId);

  if (on && opt && isPadOption(opt)) {
    const next: Record<string, string[]> = {
      ...(a.optionSelections || {}),
    };
    current.add(optionId);
    next[productId] = Array.from(current);
    for (const [pid, ids] of Object.entries(next)) {
      if (pid === productId) continue;
      const inst2 = (a.measureInstances || []).find((i) => i.id === pid);
      const pr =
        products?.find((p) => p.id === pid) ||
        (inst2?.productId
          ? products?.find((p) => p.id === inst2.productId)
          : undefined);
      if (!pr || !products) continue;
      const prAll = [
        ...(pr.options || []),
        ...buildTierUpgradeOptions(pr, products),
      ];
      next[pid] = ids.filter((id) => {
        const o = prAll.find((x) => x.id === id);
        return !o || !isPadOption(o);
      });
    }
    return { optionSelections: next };
  }

  // Multi-select options — never clear sibling upgrades/accessories
  if (on) current.add(optionId);
  else current.delete(optionId);

  const nextSelections: Record<string, string[]> = {
    ...(a.optionSelections || {}),
    [productId]: Array.from(current),
  };

  if (products && prod && inst && opt?.kind === "tier_upgrade") {
    const nextStaging = effectiveStaging(prod, Array.from(current), products);
    const partnerFams = new Set(partnerFamiliesFor(inst.familyId));
    for (const pInst of a.measureInstances || []) {
      if (pInst.id === inst.id || !pInst.productId) continue;
      if (!partnerFams.has(pInst.familyId)) continue;
      const partner = products.find((x) => x.id === pInst.productId);
      if (!partner) continue;
      const pOpts = new Set(nextSelections[pInst.id] || []);
      const pTier = buildTierUpgradeOptions(partner, products);
      for (const o of pTier) {
        if (!pOpts.has(o.id) || !o.upgradeSku) continue;
        const up = products.find((x) => x.sku === o.upgradeSku);
        if (up && productStaging(up) !== nextStaging) pOpts.delete(o.id);
      }
      if (on) {
        const matchId = matchingTierUpgradeId(partner, nextStaging, products);
        if (matchId) {
          // Add matching partner upgrade — do not wipe other options the advisor chose
          pOpts.add(matchId);
        }
      } else {
        const baseStage = productStaging(prod);
        for (const o of pTier) {
          if (!pOpts.has(o.id) || !o.upgradeSku) continue;
          const up = products.find((x) => x.sku === o.upgradeSku);
          if (up && productStaging(up) !== baseStage) pOpts.delete(o.id);
        }
      }
      nextSelections[pInst.id] = Array.from(pOpts);
    }
  }

  return { optionSelections: nextSelections };
}

export function toggleMeasureFamily(
  a: WizardAnswers,
  family: MeasureFamilyId,
  on: boolean,
  products: Product[],
): Partial<WizardAnswers> {
  return toggleMeasureFamilyFlow(a, family, "v2", on, products);
}

export function toggleMeasureFamilyFlow(
  a: WizardAnswers,
  family: MeasureFamilyId,
  flow: AdvisorQuestionFlow,
  on: boolean,
  products: Product[],
): Partial<WizardAnswers> {
  if (RETIRED_MEASURE_FAMILY_IDS.has(family)) {
    return stripRetiredRebateMeasures(a);
  }
  let measureInstances = [...(a.measureInstances || [])];
  let focusMeasureId: string | null | undefined = a.focusMeasureId;
  const scoped = FLOW_COMPARE_FAMILY_IDS.includes(family);
  const match = (i: MeasureInstance) =>
    i.familyId === family && (!scoped || instanceAdvisorFlow(i) === flow);
  if (on) {
    const existing = measureInstances.find(match);
    const hostOnJob = measureInstances.some(
      (i) => i.familyId === "furnace" || i.familyId === "air_handler",
    );
    if (family === "air_cleaner" && hostOnJob) {
      // Chip only — filter is picked on the furnace / air handler
    } else if (!existing) {
      const isCustom = family === "custom";
      const isContractor = isContractorSuppliedFamily(family);
      const contractor = isContractor ? contractorPacketCopy(family) : null;
      const id = ridInst();
      // Never pre-pick equipment — advisor chooses on the Equipment step
      // Custom measure is freeform (no product); seed labor/materials for pricing
      const inst: MeasureInstance = {
        id,
        familyId: family,
        label: isCustom
          ? "Custom 1"
          : contractor
            ? contractor.title
            : labelForInstance(family, 1),
        productId: null,
        role: "included",
        packetTitle: isCustom ? "" : contractor?.title,
        benefits: isCustom ? [""] : contractor ? [...contractor.benefits] : undefined,
        workScope: isCustom ? "" : contractor?.workScope,
        description: isCustom ? "" : contractor?.description,
        customLaborHours: isCustom ? 1 : isContractor ? 0 : undefined,
        customMaterialCost: isCustom || isContractor ? 0 : undefined,
        advisorFlow: "v2",
      };
      measureInstances.push(inst);
      measureInstances = placeNewInstanceBeforeLanguageTail(
        measureInstances,
        id,
      );
      // Do not steal focus — Continue walks the job in order
    }
    // Re-select existing family: stay on list (tap the card to open)
  } else {
    measureInstances = measureInstances.filter((i) => !match(i));
    if (focusMeasureId && !measureInstances.some((i) => i.id === focusMeasureId)) {
      focusMeasureId = null;
    }
  }
  const optionSelections = { ...(a.optionSelections || {}) };
  const keepIds = new Set(measureInstances.map((i) => i.id));
  for (const k of Object.keys(optionSelections)) {
    if (!keepIds.has(k)) delete optionSelections[k];
  }
  const base = {
    ...a,
    measureInstances,
    optionSelections,
    focusMeasureId: focusMeasureId ?? null,
    hersAdvisorOff: family === "hers" ? !on : a.hersAdvisorOff,
    ...syncIdsFromInstances(measureInstances),
  } as WizardAnswers;
  const withLoad = ensureLoadCalcOnQuote(base, products);
  const merged = { ...base, ...withLoad } as WizardAnswers;
  const withHpwh = ensureHpwhGuideOnQuote(merged, products);
  const midHers = { ...merged, ...withHpwh } as WizardAnswers;
  const withHers = ensureHersOnQuote(midHers, products);
  const hersMerged = {
    ...base,
    ...withLoad,
    ...withHpwh,
    ...withHers,
    focusMeasureId: focusMeasureId ?? null,
  } as WizardAnswers;
  const withStrip = stripRetiredRebateMeasures(hersMerged);
  const rebated = { ...hersMerged, ...withStrip } as WizardAnswers;
  const ducted = ensureDuctedCompanionsOnQuote(
    rebated,
    products,
    on && isDuctedEquipmentHost(family),
  );
  const out = { ...rebated, ...ducted };
  const insts = out.measureInstances || measureInstances;
  const fams = new Set(out.selectedMeasureFamilies || []);
  const hostOn = insts.some((i) => isDuctedEquipmentHost(i.familyId));
  if (hostOn && !(family === "air_cleaner" && !on)) fams.add("air_cleaner");
  if (family === "air_cleaner" && !on) fams.delete("air_cleaner");
  if (family === "ductwork" && !on) fams.delete("ductwork");
  return {
    ...out,
    selectedMeasureFamilies: Array.from(fams),
  };
}

/**
 * Families that belong to a goal/package — used to pin the whole package
 * at the top of Measure types (not just the first two equipment lines).
 */
export function packageFamiliesForGoals(goals: string[]): MeasureFamilyId[] {
  const g = goals || [];
  const out: MeasureFamilyId[] = [];
  const add = (id: MeasureFamilyId) => {
    if (!out.includes(id)) out.push(id);
  };

  if (g.includes("hybrid_hp")) {
    add("heat_pump");
    add("coil");
    add("furnace");
  } else if (g.includes("hp_conversion")) {
    add("heat_pump");
    add("air_handler");
    add("conversion_guide");
    add("ductwork");
  } else if (g.includes("heat_pump")) {
    add("heat_pump");
    add("coil");
  }

  if (g.includes("replace_furnace") || g.includes("replace_ac")) {
    // Split furnace vs AC so "AC only" / "Furnace" packages stay accurate.
    // Hybrid heat-pump is the exception: furnace stays on the job with the HP.
    if (g.includes("hybrid_hp")) {
      if (g.includes("replace_furnace")) add("furnace");
      if (g.includes("replace_ac")) add("ac");
    } else if (!g.includes("heat_pump") && !g.includes("hp_conversion")) {
      if (g.includes("replace_furnace")) add("furnace");
      if (g.includes("replace_ac")) add("ac");
    }
  }

  if (g.includes("ductless")) add("ductless");
  if (g.includes("iaq")) add("air_cleaner");
  if (g.includes("hybrid_wh") || g.includes("hpwh_guide")) {
    add("water_heater");
    add("hpwh_guide");
  }
  if (g.includes("water_heater")) add("water_heater");
  if (g.includes("wall_heater")) add("wall_heater");
  if (g.includes("custom")) add("custom");
  if (g.includes("comfort_club")) add("maintenance");

  // Owner-built packages may list measure family ids directly
  for (const raw of g) {
    if (MEASURE_FAMILIES.some((f) => f.id === raw)) {
      add(raw as MeasureFamilyId);
    }
  }

  // Major equipment always carries a permit line (advisor can still be prompted later).
  const MAJOR_NEEDS_PERMIT: MeasureFamilyId[] = [
    "heat_pump",
    "air_handler",
    "coil",
    "furnace",
    "ac",
    "ductless",
    "package_unit",
    "water_heater",
    "wall_heater",
  ];
  if (out.some((id) => MAJOR_NEEDS_PERMIT.includes(id))) {
    add("permits");
  }
  if (
    out.includes("heat_pump") ||
    out.includes("ac") ||
    out.includes("furnace") ||
    out.includes("air_handler") ||
    out.includes("coil") ||
    out.includes("package_unit")
  ) {
    add("hers");
  }
  // Support lines for central equipment packages (not wall-heater-only / WH-only)
  const needsSupport =
    out.includes("heat_pump") ||
    out.includes("air_handler") ||
    out.includes("coil") ||
    out.includes("furnace") ||
    out.includes("ac") ||
    out.includes("ductless");
  if (needsSupport) {
    add("load_calc");
  }

  return out;
}

/** Language / fees auto-attached. Never “started work.” Never block unselect. */
export const SCAFFOLD_FAMILIES = new Set<MeasureFamilyId>([
  "hpwh_guide",
  "conversion_guide",
  "load_calc",
  "permits",
  "hers",
  "install",
  "maintenance",
]);

/** True when advisor has started real work on a measure (not just scaffold). */
export function instanceHasAdvisorWork(inst: MeasureInstance): boolean {
  if (SCAFFOLD_FAMILIES.has(inst.familyId)) return false;
  if (inst.productId) return true;
  if (inst.selectedCapacities && inst.selectedCapacities.length > 0) return true;
  if (inst.selectedBrands && inst.selectedBrands.length > 0) return true;
  if (inst.scopeAnswers && Object.keys(inst.scopeAnswers).length > 0) return true;
  if (inst.installLocationPreset) return true;
  if (inst.furnaceEffStyle || inst.furnaceCabinetStyle) return true;
  if (inst.hpInstallPath || inst.wallVentStyle || inst.waterHeaterStyle)
    return true;
  if (inst.priceOverride != null || inst.laborHoursOverride != null) return true;
  return false;
}

export function workedEquipmentLabels(a: WizardAnswers): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const inst of a.measureInstances || []) {
    if (!instanceHasAdvisorWork(inst)) continue;
    const lab = familyLabel(inst.familyId);
    if (seen.has(lab)) continue;
    seen.add(lab);
    out.push(lab);
  }
  return out;
}

export function quoteHasStartedMeasureWork(a: WizardAnswers): boolean {
  /**
   * Lock job goals only after real equipment work — model pick or site answers
   * on a primary equipment family. Auto-scaffold (install / permits / load_calc /
   * conversion guide) must NOT lock, or advisors cannot change mind on Situation.
   */
  const EQUIPMENT = new Set<MeasureFamilyId>([
    "heat_pump",
    "furnace",
    "ac",
    "air_handler",
    "ductless",
    "package_unit",
    "water_heater",
    "wall_heater",
    "custom",
    "zoning",
    "air_cleaner",
    "humidifier",
    "dehumidifier",
    "thermostat",
    "ductwork",
  ]);
  for (const inst of a.measureInstances || []) {
    if (!EQUIPMENT.has(inst.familyId)) continue;
    if (inst.productId) return true;
    if (inst.scopeAnswers && Object.keys(inst.scopeAnswers).length > 0)
      return true;
  }
  return false;
}

export function recommendFromGoals(
  a: WizardAnswers,
  products: Product[],
): Partial<WizardAnswers> {
  const goals = a.goals || [];
  let path: HeatingPath = a.heatingPath || "furnace";
  if (goals.includes("hp_conversion")) path = "heat_pump_conversion";
  else if (goals.includes("heat_pump")) path = "heat_pump";
  else if (goals.includes("ductless")) path = "all";
  else if (goals.includes("replace_furnace") || goals.includes("replace_ac"))
    path = "furnace";
  else if (goals.includes("wall_heater") && !goals.includes("heat_pump"))
    path = "all";

  const tonnage = a.systemTonnage || tonnageFromHomeSize(a.homeSize);
  // Start from package families for current goals (full package, not partial)
  const packageFams = packageFamiliesForGoals(goals);
  const families = new Set<MeasureFamilyId>(packageFams);
  const workStarted = quoteHasStartedMeasureWork(a);

  /** Advisor-picked equipment (zoning, etc.) — never drop when packages re-seed. */
  const ADVISOR_KEEP = new Set<MeasureFamilyId>([
    "heat_pump",
    "furnace",
    "ac",
    "air_handler",
    "coil",
    "ductless",
    "package_unit",
    "water_heater",
    "wall_heater",
    "custom",
    "zoning",
    "air_cleaner",
    "humidifier",
    "dehumidifier",
    "thermostat",
    "ductwork",
  ]);

  // Empty goals + no work yet → clear package so "Clear job goal" truly resets
  if (!workStarted && packageFams.length === 0 && goals.length === 0) {
    // leave families empty
  } else if (workStarted) {
    // Keep advisor's existing families; only add package extras
    for (const id of a.selectedMeasureFamilies || []) {
      families.add(id as MeasureFamilyId);
    }
  } else {
    // Soft rebuild: package families + any equipment the advisor already added
    // (e.g. Zoning toggled on before job packages) — packages must not wipe them
    for (const id of a.selectedMeasureFamilies || []) {
      if (ADVISOR_KEEP.has(id as MeasureFamilyId)) {
        families.add(id as MeasureFamilyId);
      }
    }
    for (const inst of a.measureInstances || []) {
      if (ADVISOR_KEEP.has(inst.familyId)) {
        families.add(inst.familyId);
      }
    }
  }

  if (!workStarted) {
    if (path === "heat_pump" || path === "heat_pump_conversion") {
      families.delete("furnace");
      families.delete("ac");
    } else if (path === "furnace") {
      families.delete("heat_pump");
      families.delete("air_handler");
      families.delete("conversion_guide");
    }
  }
  for (const f of packageFams) families.add(f);

  const skus = preferredSkusForHeatingPath(path, tonnage);
  const core: string[] = [];
  for (const sku of skus) {
    const p = products.find((x) => x.sku.toUpperCase() === sku.toUpperCase());
    if (p) core.push(p.id);
  }

  const ensureFamily = (fam: MeasureFamilyId) => {
    if (
      core.some((id) => {
        const p = products.find((x) => x.id === id);
        return p && productMatchesMeasureFamily(p, fam);
      })
    )
      return;
    const p = products.find(
      (x) =>
        productMatchesMeasureFamily(x, fam) &&
        (x.tier == null || x.tier === 1) &&
        productMatchesTonnage(x, tonnage),
    );
    if (p) core.push(p.id);
  };

  for (const fam of families) {
    if (
      [
        "heat_pump",
        "furnace",
        "ac",
        "air_handler",
        "install",
        "permits",
        "load_calc",
      ].includes(fam)
    ) {
      ensureFamily(fam);
    }
  }

  /** Equipment the advisor must pick on the Equipment step — never pre-select. */
  const PICK_ON_EQUIPMENT = new Set<MeasureFamilyId>([
    "heat_pump",
    "furnace",
    "ac",
    "air_handler",
    "coil",
    "ductless",
    "package_unit",
    "water_heater",
    "wall_heater",
        "custom",
    "zoning",
    "air_cleaner",
    "humidifier",
    "dehumidifier",
    "thermostat",
    // ductwork / install / permits auto-pick sole service product + work scope
  ]);

  const used = new Set<string>();
  const prevByFamily = new Map<MeasureFamilyId, MeasureInstance[]>();
  for (const inst of a.measureInstances || []) {
    const list = prevByFamily.get(inst.familyId) || [];
    list.push(inst);
    prevByFamily.set(inst.familyId, list);
  }
  const measureInstances: MeasureInstance[] = [];
  for (const fam of Array.from(families)) {
    // Prefer keeping existing instances (change of mind keeps picks when possible)
    const prev = prevByFamily.get(fam);
    if (prev?.length) {
      for (const inst of prev) {
        measureInstances.push(inst);
        if (inst.productId) used.add(inst.productId);
      }
      prevByFamily.delete(fam);
      continue;
    }
    let pid: string | null = null;
    if (!PICK_ON_EQUIPMENT.has(fam)) {
      // Service / info lines (install, permit, load, conversion guide) can default
      pid =
        core.find((id) => {
          if (used.has(id)) return false;
          const p = products.find((x) => x.id === id);
          return p && productMatchesMeasureFamily(p, fam);
        }) || null;
      if (!pid) {
        const p = products.find((x) => productMatchesMeasureFamily(x, fam));
        if (p) pid = p.id;
      }
      if (pid) used.add(pid);
    }
    const p = pid ? products.find((x) => x.id === pid) : null;
    measureInstances.push({
      id: ridInst(),
      familyId: fam,
      label: labelForInstance(fam, 1),
      productId: pid,
      role: "included",
      packetTitle: p ? customerInstallName(p) || p.name : undefined,
      benefits: p?.benefits ? [...p.benefits] : undefined,
      workScope: p?.workScope,
      description: p?.description,
      advisorFlow: "v2",
    });
  }

  const optionSelections: Record<string, string[]> = {};
  const owner = pickPadOwnerProductId(
    measureInstances.filter((i) => i.productId).map((i) => i.productId!),
    products,
    measureInstances
      .filter((i) => i.role === "included" && i.productId)
      .map((i) => i.productId!),
  );
  for (const inst of measureInstances) {
    if (!inst.productId) continue;
    const p = products.find((x) => x.id === inst.productId);
    if (!p) continue;
    const defaults = (p.options || [])
      .filter((o) => {
        if (!o.defaultSelected) return false;
        if (isPadOption(o)) return false;
        return true;
      })
      .map((o) => o.id);
    if (defaults.length) optionSelections[inst.id] = defaults;
  }

  const sync = syncIdsFromInstances(measureInstances);
  const withLoad = ensureLoadCalcOnQuote(
    {
      ...a,
      heatingPath: path,
      systemTonnage: tonnage,
      selectedMeasureFamilies: sync.selectedMeasureFamilies,
      measureInstances,
      coreProductIds: sync.coreProductIds,
      optionalProductIds: sync.optionalProductIds,
      optionSelections,
    } as WizardAnswers,
    products,
  );
  const mid = {
    ...a,
    heatingPath: path,
    systemTonnage: tonnage,
    selectedMeasureFamilies:
      withLoad.selectedMeasureFamilies || sync.selectedMeasureFamilies,
    measureInstances: withLoad.measureInstances || measureInstances,
    coreProductIds: withLoad.coreProductIds || sync.coreProductIds,
    optionalProductIds: withLoad.optionalProductIds || sync.optionalProductIds,
    optionSelections:
      (withLoad as { optionSelections?: Record<string, string[]> })
        .optionSelections || optionSelections,
  } as WizardAnswers;
  const withHpwh = ensureHpwhGuideOnQuote(mid, products);
  const hersIn = { ...mid, ...withHpwh } as WizardAnswers;
  const withHers = ensureHersOnQuote(hersIn, products);
  const hersMerged = { ...hersIn, ...withHers } as WizardAnswers;
  const withStrip = stripRetiredRebateMeasures(hersMerged);
  const rebated = { ...hersMerged, ...withStrip } as WizardAnswers;
  const hostInPkg = (rebated.measureInstances || []).some((m) =>
    isDuctedEquipmentHost(m.familyId),
  );
  const ducted = ensureDuctedCompanionsOnQuote(
    rebated,
    products,
    hostInPkg,
  );
  const linkedInstances = ensurePackagePathLinks(
    ducted.measureInstances ||
      withHers.measureInstances ||
      hersIn.measureInstances ||
      measureInstances,
    packageFams,
    true,
  );
  return {
    goals, // explicit so clear [] is never lost
    activeJobGoalId: a.activeJobGoalId ?? null,
    heatingPath: path,
    systemTonnage: tonnage,
    selectedMeasureFamilies:
      ducted.selectedMeasureFamilies ||
      withStrip.selectedMeasureFamilies ||
      withHers.selectedMeasureFamilies ||
      hersIn.selectedMeasureFamilies,
    measureInstances: linkedInstances,
    coreProductIds: withHers.coreProductIds || hersIn.coreProductIds,
    optionalProductIds: withHers.optionalProductIds || hersIn.optionalProductIds,
    optionSelections,
    optionalPreselectedIds: [],
  };
}

export function applyHeatingPathToAnswers(
  a: WizardAnswers,
  path: HeatingPath,
  products: Product[],
): Partial<WizardAnswers> {
  const rec = recommendFromGoals({ ...a, heatingPath: path }, products);
  return { ...rec, heatingPath: path };
}

export function buildLineItems(
  a: WizardAnswers,
  products: Product[],
): QuoteLine[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const byId = (id: string) => productById.get(id);
  const lines: QuoteLine[] = [];
  const instances = a.measureInstances || [];
  const famCount = new Map<MeasureFamilyId, number>();
  for (const inst of instances) {
    famCount.set(inst.familyId, (famCount.get(inst.familyId) || 0) + 1);
  }

  for (const inst of instances) {
    // —— Custom freeform measure (no catalog product) ——
    if (inst.familyId === "custom" || isContractorSuppliedFamily(inst.familyId)) {
      const mat = Math.max(0, Number(inst.customMaterialCost) || 0);
      const hours = Math.max(
        0,
        Number(inst.customLaborHours) || 0,
      );
      const contractor = isContractorSuppliedFamily(inst.familyId);
      const snap = getOwnerPricingSnapshot();
      const unitPrice = contractor
        ? Math.round(
            (contractorSellFromCost(mat, snap.contractorMarkupPct) +
              hours * (snap.laborRate || DEFAULT_LABOR_RATE)) *
              100,
          ) / 100
        : autoUnitPrice({
            materialCost: mat,
            laborHours: hours,
            laborRate: snap.laborRate || DEFAULT_LABOR_RATE,
            materialDivisor: snap.materialDivisor || DEFAULT_MATERIAL_DIVISOR,
            laborDivisor: snap.laborDivisor || DEFAULT_LABOR_DIVISOR,
            priceMode: "auto",
          });
      const seeded = contractor
        ? contractorPacketCopy(inst.familyId)
        : null;
      const title = formatMeasureTitle(
        (inst.packetTitle || "").trim() ||
          inst.label ||
          seeded?.title ||
          "Custom measure",
      );
      const benefits = (inst.benefits || [])
        .map((b) => b.trim())
        .filter(Boolean);
      const isOpt = inst.role === "optional";
      let line = productToLine(
        {
          id: `custom_${inst.id}`,
          name: title,
          sku: contractor
            ? `SUB-${inst.familyId.replace("sub_", "").toUpperCase()}`
            : `CUSTOM-${inst.id.slice(-6).toUpperCase()}`,
          category: contractor
            ? "Contractor supplied"
            : "Custom measure",
          description:
            (inst.description || "").trim() ||
            seeded?.description ||
            title,
          unitPrice,
          unit: "job",
          materialCost: mat,
          laborHours: hours,
          benefits: benefits.length
            ? benefits
            : seeded?.benefits || ["As described in work scope"],
          options: [],
          workScope:
            (inst.workScope || "").trim() ||
            seeded?.workScope ||
            "As agreed with the homeowner.",
          equipmentKind: "other",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          role: isOpt ? "optional" : "included",
          optional: isOpt,
          defaultSelected: !isOpt,
          catalog: products,
          showPrice: true,
        },
      );
      line.id = `li_${inst.id}`;
      line.role = isOpt ? "optional" : "included";
      line.optional = isOpt;
      line.defaultSelected = !isOpt;
      line.customerSelected = undefined;
      line.name = title;
      line.benefits = benefits.length ? benefits : line.benefits;
      line.workScope =
        (inst.workScope || "").trim() || line.workScope || "";
      line.description = (inst.description || "").trim() || line.description;
      line.unitPrice = unitPrice;
      line.materialCost = mat;
      line.laborHours = hours;
      line.options = [];
      line.selectedOptionIds = [];
      line.sortOrder = contractor ? 560 : 550;
      line = applySiteAdjustmentToLine(
        line,
        a.measureAdjustments?.[inst.id],
      );
      lines.push(line);
      continue;
    }

    if (!inst.productId) continue;
    const p = byId(inst.productId);
    if (!p) continue;
    if (
      p.sku === HP_CONVERSION_GUIDE_SKU &&
      a.heatingPath !== "heat_pump_conversion"
    )
      continue;

    const isEducation =
      p.sku === HP_CONVERSION_GUIDE_SKU ||
      p.sku === HPWH_EXPECT_SKU ||
      inst.familyId === "conversion_guide" ||
      inst.familyId === "hpwh_guide" ||
      isEducationLanguageProduct(p) ||
      /gas furnace vs heat pump|what changes|customer expectations|heat pump water heater — what to expect/i.test(
        p.name + " " + (p.category || ""),
      );
    const isLoad = isLoadCalcProduct(p) || inst.familyId === "load_calc";

    const measureRole = isEducation || isLoad
      ? "info"
      : inst.role === "optional"
        ? "optional"
        : "included";
    const isOptMeasure = measureRole === "optional";
    let line = productToLine(p, {
      // Education / load calc never optional and never charged
      role: measureRole,
      optional: isOptMeasure,
      // Optional measures must NOT pre-select on the customer packet
      defaultSelected: !isOptMeasure,
      catalog: products,
      showPrice: isEducation || isLoad ? false : true,
    });
    line.id = `li_${inst.id}`;
    line.role = measureRole;
    line.optional = isOptMeasure;
    line.defaultSelected = !isOptMeasure;
    line.customerSelected = undefined;
    if (inst.familyId !== "electrical") {
      const face = packetFaceTitle(p, inst.packetTitle);
      if (face) line.name = face;
      if (p.equipmentKind === "ductless") {
        line.description = customerInstallBlurb(p);
      }
    }
    if (!(line.manufacturerLinks && line.manufacturerLinks.length)) {
      const mfr = resolveManufacturerLinks(p);
      if (mfr.length) {
        line.manufacturerLinks = mfr;
        line.productInfoUrl = p.productInfoUrl || mfr[0].url;
      }
    }
    if (!line.packetPhotoUrl && shouldShowProductPhoto(line)) {
      line.packetPhotoUrl = resolveProductPhotoUrl(p) || resolveProductPhotoUrl(line);
    }
    if (isEducation || isLoad) {
      line.unitPrice = 0;
      line.materialCost = 0;
      line.laborHours = 0;
      line.showPrice = false;
      line.role = "info";
      line.optional = false;
      line.defaultSelected = true;
      line.options = [];
      line.selectedOptionIds = [];
    }

    // Staging-safe options (hide multi-stage upgrades when partner is single-stage)
    line.options = optionsForMeasureInstance(
      p,
      a,
      products,
      inst.id,
      inst.familyId,
    );

    const lockPacket = inst.familyId === "permits" && !inst.workScopeTouched;
    if (inst.familyId === "electrical") {
      line.name = electricalJobTitle(inst);
    }
    if (
      inst.benefits &&
      inst.benefits.length &&
      !lockPacket &&
      !isLockableEquipment(p) &&
      inst.familyId !== "zoning"
    ) {
      line.benefits = [...inst.benefits];
    } else if (isLockableEquipment(p)) {
      const locked = lockedEquipmentBenefits(p);
      if (locked) line.benefits = locked;
      else if ((p.benefits || []).length) line.benefits = [...p.benefits];
    } else if ((p.benefits || []).length >= 3) {
      line.benefits = [...p.benefits];
    } else {
      line.benefits = applyHomeSizingBenefit(line.benefits || [], p);
    }
    if (
      inst.familyId === "hers" ||
      inst.familyId === "permits" ||
      inst.familyId === "conversion_guide" ||
      inst.familyId === "hpwh_guide" ||
      inst.familyId === "load_calc" ||
      /permit|hers|load calc|vs gas|conversion|education|guide/i.test(
        `${inst.familyId} ${p.name} ${p.sku}`,
      )
    ) {
      line.benefits = (line.benefits || []).filter(
        (b) =>
          !/manufacturer limited parts warranty/i.test(b) &&
          !/labor warranty on this install/i.test(b),
      );
    }
    if (inst.familyId === "zoning") {
      const n = Number(inst.zoneCount || inst.scopeAnswers?.zone_count || 2);
      line.benefits = zoningPacketBenefits(
        n,
        inferZoneMfr({
          sku: p.sku,
          name: p.name,
          selectedBrands: inst.selectedBrands,
        }),
      );
    }
    if (line.benefits?.length) {
      line.benefits = line.benefits.map((b) =>
        String(b)
          .replace(/damper\(s\)/gi, "dampers")
          .replace(/Pick-A-Flow/gi, "selectable airflow"),
      );
    }
    if (inst.workScopeTouched && (inst.workScope || "").trim()) {
      line.workScope = inst.workScope;
    } else {
      const live = liveWorkScopeDocument(inst, p, a);
      if (live) line.workScope = live;
      else if (inst.workScope != null && inst.workScope !== "") {
        line.workScope = inst.workScope;
      }
    }
    if (line.workScope) {
      line.workScope = String(line.workScope)
        .replace(/AARVAKS/gi, "Acme HVAC")
        .replace(/WHAT Acme HVAC/g, "WHAT ACME HVAC")
        .replace(/longer, quieter runs/gi, "longer, quieter cycles")
        .replace(/\n*Install location \(as sold\):[^\n]*/gi, "")
        .replace(/damper\(s\)/gi, "dampers")
        .replace(/Pick-A-Flow/gi, "selectable airflow")
        .trim();
    }
    if (
      inst.familyId === "hpwh_guide" &&
      hpwhRecircNotesFromAnswers(a, products)
    ) {
      const note = HPWH_RECIRC_CONTRACT_NOTE;
      const scope = String(line.workScope || "");
      if (!scope.includes("not designed to run with a recirculation")) {
        line.workScope = [scope.trim(), note].filter(Boolean).join("\n\n");
      }
    }
    // Placement stays on the job card for production — never on the customer packet.

    // Mini-split multi-zone: head locations on the customer packet
    {
      const heads = (inst.headLocations || [])
        .map((h) => h.trim())
        .filter(Boolean);
      if (heads.length) {
        const headBlock =
          "Indoor head locations:\n" +
          heads.map((h, i) => `${i + 1}. ${h}`).join("\n");
        const base = (line.workScope || "").replace(
          /\n*INDOOR HEAD LOCATIONS:[\s\S]*$/i,
          "",
        ).replace(/\n*Indoor head locations:\n[\s\S]*$/i, "");
        line.workScope = (base ? base.trim() + "\n\n" : "") + headBlock;
        // Light benefit so customer sees zone plan
        const tag = `Multi-zone design: ${heads.length} indoor head${heads.length === 1 ? "" : "s"} as listed in work scope`;
        if (
          !isLockableEquipment(p) &&
          !(line.benefits || []).some((b) => /indoor head location/i.test(b))
        ) {
          line.benefits = [...(line.benefits || []), tag];
        }
      }
    }
    if (inst.description != null && inst.description !== "") {
      line.description = inst.description;
    } else if (p.equipmentKind === "ac" || p.equipmentKind === "heat_pump") {
      line.description =
        `${p.description} Quoted at ~${a.systemTonnage} ton class; final model matched to load.`.trim();
    }
    if (
      isEducation ||
      p.sku === HP_CONVERSION_GUIDE_SKU ||
      p.sku === HPWH_EXPECT_SKU
    ) {
      line.unitPrice = 0;
      line.materialCost = 0;
      line.laborHours = 0;
      line.showPrice = false;
      line.role = "info";
    }

    {
      const circ =
        inst.familyId === "electrical"
          ? electricalCircuitOverride(inst) ||
            resolveProductCircuit(p, inst.familyId)
          : resolveProductCircuit(p, inst.familyId);
      const seeded: ScopeAnswers = { ...(inst.scopeAnswers || {}) };
      if (inst.familyId === "ductless" && inst.ductlessZones && !seeded.ms_zones) {
        seeded.ms_zones = inst.ductlessZones;
      }
      if (inst.familyId === "zoning" && inst.zoneCount && !seeded.zone_count) {
        seeded.zone_count = String(inst.zoneCount);
      }
      if (inst.familyId === "zoning" && !seeded.zone_mfr) {
        seeded.zone_mfr = inferZoneMfr({
          sku: p.sku,
          name: p.name,
          selectedBrands: inst.selectedBrands,
        });
      }
      if (inst.familyId === "hrv") {
        if (inst.hrvKind && !seeded.hrv_kind) seeded.hrv_kind = inst.hrvKind;
        if (inst.hrvSqft && !seeded.hrv_sqft) seeded.hrv_sqft = inst.hrvSqft;
        if (inst.hrvBeds && !seeded.hrv_beds) seeded.hrv_beds = inst.hrvBeds;
      }
      if (inst.familyId === "bath_fan" && jobHasMajorOnJob(a)) {
        seeded.fan_visit = "with";
      }
      if (inst.familyId === "electrical" && jobHasMajorOnJob(a)) {
        seeded.ejob_visit = "with";
      }
      if (inst.familyId === "bath_fan") {
        if (fanHasSelectableCfm(p.sku) && inst.bathCfm) {
          seeded.fan_cfm = String(inst.bathCfm);
        } else {
          delete seeded.fan_cfm;
        }
        const blob = `${p.sku || ""} ${p.name || ""}`.toLowerCase();
        seeded.fan_needs_switch = /sense/.test(blob) ? "no" : "yes";
      }
      if (inst.familyId === "water_heater") {
        const style =
          inst.waterHeaterStyle || detectWaterHeaterStyle(p);
        if (style) seeded.wh_style = style;
        seeded.wh_vent_kind = detectWhVentKind(p, style);
      }
      if (inst.familyId === "furnace") {
        const eff = detectFurnaceEffStyle(p);
        seeded.furn_vent_kind =
          eff === "high_eff" || eff === "uln_high" || eff === "navien_npf"
            ? "pvc"
            : "bvent";
      }
      const compiled = questionnaireForFamily(inst.familyId)
        ? compileScopeAnswers(
            inst.familyId,
            seeded,
            undefined,
            {
              isHybrid: jobHasHybridHeat(a),
              excludeIds: new Set([
                ...offeredFollowUpQuestionIds(inst, a),
                ...PAD_FOLLOW_UP_IDS,
                ...jobPathCompileExcludeIds(
                  inst.familyId,
                  inst.jobPath,
                  inst.wallVentStyle || String(inst.scopeAnswers?.wall_path || ""),
                ),
                ...(siblingOwnsLineSet(inst, a)
                  ? [...LINE_SET_QUESTION_IDS]
                  : []),
                ...(isDuctOfferBuild(seeded) ? [...DUCT_BUILD_QUESTION_IDS] : []),
              ]),
              circuit: circ
                ? {
                    volts: circ.voltId,
                    ampId: circ.ampId,
                    label: circ.label,
                    breakerAmps: circ.breakerAmps,
                  }
                : null,
            },
          )
        : null;
      if (compiled && compiled.benefitLines.length && !isLockableEquipment(p)) {
        line.benefits = applyCompiledBenefits(line.benefits, compiled);
      }
      const picked = inst.accessoryPicks || [];
      if (picked.length && !isLockableEquipment(p)) {
        const seen = new Set((line.benefits || []).map((b) => b.trim().toLowerCase()));
        const extra: string[] = [];
        for (const d of accessoriesForInstance(inst, a)) {
          if (!picked.includes(d.id) || !d.packetBenefit) continue;
          const k = d.packetBenefit.trim().toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          extra.push(d.packetBenefit);
        }
        if (extra.length) line.benefits = [...(line.benefits || []), ...extra];
      }
      const advisor = a.measureAdjustments?.[inst.id] ||
        a.measureAdjustments?.[p.id] || {
          extraLaborHours: 0,
          extraMaterialCost: 0,
        };
      let kitHours = 0;
      let kitMat = 0;
      for (const d of accessoriesForInstance(inst, a)) {
        if (!(inst.accessoryPicks || []).includes(d.id)) continue;
        if (d.followUpQuestionIds.length) continue;
        kitHours += Number(d.laborHours) || 0;
        kitMat += Number(d.materialCost) || 0;
      }
      line = applySiteAdjustmentToLine(line, {
        extraLaborHours:
          (Number(advisor.extraLaborHours) || 0) +
          (compiled?.extraLaborHours || 0) +
          kitHours,
        extraMaterialCost:
          (Number(advisor.extraMaterialCost) || 0) +
          (compiled?.extraMaterialCost || 0) +
          kitMat,
      });
    }

    if (inst.laborHoursOverride != null && Number.isFinite(inst.laborHoursOverride)) {
      line.laborHours = Math.max(0, Number(inst.laborHoursOverride));
    }
    if (inst.priceOverride != null && Number.isFinite(inst.priceOverride)) {
      line.unitPrice = Math.max(0, Number(inst.priceOverride));
    }
    if (inst.extraSell != null && Number.isFinite(inst.extraSell)) {
      line.unitPrice = Math.max(0, (Number(line.unitPrice) || 0) + Number(inst.extraSell));
    }

    const pickedOpts =
      a.optionSelections?.[inst.id] || a.optionSelections?.[p.id] || [];
    const padKind = String(inst.scopeAnswers?.pad_kind || "");
    const instPad = padModeFromInstance(inst);
    const padMode =
      padKind === "existing"
        ? "off"
        : instPad !== "off"
          ? instPad
          : a.padMode || "off";
    const padOwnerInst = padOwnerInstanceFromAnswers(a);
    const ownsPad =
      padOwnerInst?.id === inst.id ||
      (!padOwnerInst && padOwnerIdFromAnswers(a, products) === p.id);

    const padFollow = ownsPad
      ? compileScopeAnswers(inst.familyId, inst.scopeAnswers || {}, undefined, {
          onlyIds: PAD_FOLLOW_UP_IDS,
        })
      : null;

    const ductOfferBuild = isDuctOfferBuild(inst.scopeAnswers || {});
    const ductBuild = ductOfferBuild
      ? compileScopeAnswers(inst.familyId, inst.scopeAnswers || {}, undefined, {
          onlyIds: [...DUCT_BUILD_QUESTION_IDS],
        })
      : null;

    // Normalize pad options, then decide which options appear on the packet
    let opts = (line.options || []).map((o) => {
      if (o.id === NEW_DUCTS_OPTION_ID && ductBuild) {
        const mat = 1600 + (Number(ductBuild.extraMaterialCost) || 0);
        const hrs = 10 + (Number(ductBuild.extraLaborHours) || 0);
        const sell = resolveOptionSellPrice({
          materialCost: mat,
          laborHours: hrs,
        });
        const extra = (ductBuild.scopeLines || []).join("\n");
        return {
          ...o,
          materialCost: mat,
          laborHours: hrs,
          priceDelta: sell,
          body: [o.body, extra].filter(Boolean).join("\n"),
        };
      }
      if (!isPadOption(o)) return o;
      const preformCredit =
        String(inst.scopeAnswers?.pad_base || "") === "preform" &&
        padMode === "optional";
      const matRaw =
        (o.materialCost != null && Number(o.materialCost) > 0
          ? Number(o.materialCost)
          : getPadMaterial()) + (padFollow?.extraMaterialCost || 0);
      const hrsRaw =
        (o.laborHours != null && Number(o.laborHours) > 0
          ? Number(o.laborHours)
          : getPadLabor()) + (padFollow?.extraLaborHours || 0);
      const mat = Math.max(0, matRaw - (preformCredit ? 85 : 0));
      const hrs = Math.max(0, hrsRaw - (preformCredit ? 0.45 : 0));
      const sell = padCustomerPrice(mat, hrs);
      const extraBody = (padFollow?.scopeLines || []).join("\n");
      return {
        ...o,
        kind: "pad" as const,
        title: getCustomConcretePadTitle(),
        body: [customConcretePadBody(), extraBody].filter(Boolean).join("\n"),
        materialCost: mat,
        laborHours: hrs,
        priceDelta: sell,
      };
    });
    opts = opts.map((o) => {
      if (o.kind === "tier_upgrade" || isPadOption(o)) return o;
      if (o.id === NEW_DUCTS_OPTION_ID) return o;
      if (!(Number(o.materialCost) > 0 || Number(o.laborHours) > 0)) return o;
      return {
        ...o,
        priceDelta: resolveOptionSellPrice({
          materialCost: o.materialCost,
          laborHours: o.laborHours,
        }),
      };
    });

    opts = opts.filter((o) => {
      if (isPadOption(o)) {
        if (padMode === "off") return false;
        return ownsPad; // one pad on the outdoor owner only
      }
      if (o.kind === "tier_upgrade") {
        // Only upgrades the advisor marked "As option" — optional for customer
        return pickedOpts.includes(o.id);
      }
      return pickedOpts.includes(o.id) || Boolean(o.defaultSelected);
    });

    if (ownsPad && padMode !== "off" && !opts.some((o) => isPadOption(o))) {
      opts.unshift(makeConcretePadOption(inst.id));
    }

    // Guarantee every advisor-selected option id is still on the packet
    // (tier rebuild / SKU mismatch can otherwise drop them)
    const have = new Set(opts.map((o) => o.id));
    for (const oid of pickedOpts) {
      if (have.has(oid)) continue;
      const fromLine = (line.options || []).find((o) => o.id === oid);
      const fromProd = (p.options || []).find((o) => o.id === oid);
      const recovered = fromLine || fromProd;
      if (recovered) {
        opts.push(recovered);
        have.add(oid);
      }
    }

    line.options = opts;
    line.selectedOptionIds = opts
      .filter((o) => {
        if (isPadOption(o)) return padMode === "included";
        return pickedOpts.includes(o.id);
      })
      .map((o) => o.id);

    lines.push(line);
  }

  const accessoryOfferLines: { parentId: string; line: QuoteLine }[] = [];
  for (const inst of instances) {
    const offered = inst.accessoryOffers || [];
    if (!offered.length) continue;
    const defs = accessoriesForInstance(inst, a);
    for (const accId of offered) {
      const d = defs.find((x) => x.id === accId);
      if (!d) continue;
      // Pad stays a small option on the outdoor unit — never its own measure card.
      if (d.id === "pad" || accId === "pad") continue;
      const follow = d.followUpQuestionIds.length
        ? compileScopeAnswers(inst.familyId, inst.scopeAnswers || {}, undefined, {
            onlyIds: d.followUpQuestionIds,
          })
        : null;
      const hours =
        (Number(d.laborHours) || 0) + (follow?.extraLaborHours || 0);
      const mat =
        (Number(d.materialCost) || 0) + (follow?.extraMaterialCost || 0);
      const unitPrice = autoUnitPrice({
        materialCost: mat,
        laborHours: hours,
        laborRate: DEFAULT_LABOR_RATE,
        materialDivisor: DEFAULT_MATERIAL_DIVISOR,
        laborDivisor: DEFAULT_LABOR_DIVISOR,
        priceMode: "auto",
      });
      const name = d.label;
      const tone = d.packetTone || "simple";
      const scopeBits =
        tone === "rich"
          ? [
              d.offerScopeLine || `Install ${d.label.toLowerCase()}.`,
              ...(follow?.scopeLines || []),
            ].filter(Boolean)
          : [d.offerScopeLine || `Install ${d.label.toLowerCase()}.`];
      const benefitBits =
        d.offerBenefitLines && d.offerBenefitLines.length
          ? d.offerBenefitLines
          : d.packetBenefit
            ? [d.packetBenefit]
            : [];
      let line = productToLine(
        {
          id: `offer_${inst.id}_${d.id}`,
          name,
          sku: `OPT-${d.id.toUpperCase()}`,
          category: "Optional upgrade",
          description: scopeBits.join(" "),
          unitPrice,
          unit: "each",
          materialCost: mat,
          laborHours: hours,
          benefits: benefitBits,
          options: [],
          workScope: scopeBits.join("\n"),
          equipmentKind: "other",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          role: "optional",
          optional: true,
          defaultSelected: false,
          catalog: products,
          showPrice: true,
        },
      );
      line.id = `li_${inst.id}__opt_${d.id}`;
      line.role = "optional";
      line.optional = true;
      line.defaultSelected = false;
      accessoryOfferLines.push({ parentId: inst.id, line });
    }
  }

  if (!instances.length) {
    for (const id of a.coreProductIds || []) {
      const p = byId(id);
      if (!p) continue;
      let line = productToLine(p, {
        role: "included",
        defaultSelected: true,
        catalog: products,
      });
      line = applySiteAdjustmentToLine(line, a.measureAdjustments?.[id]);
      lines.push(line);
    }
  }

  const keepInst = lines.filter((l) => String(l.id).startsWith("li_"));
  const others = applyStandardMeasureOrder(
    lines.filter((l) => !String(l.id).startsWith("li_")),
    products,
  );

  // Custom packet order (advisor-arranged) holds until they change it
  const order = syncMeasureOrder(
    instances.length
      ? instances
      : keepInst.map((l) => ({
          id: String(l.id).replace(/^li_/, ""),
        })) as MeasureInstance[],
    a.measureOrder,
  );

  let orderedInst: QuoteLine[];
  if (order.length && keepInst.length) {
    const byId = new Map(
      keepInst.map((l) => [String(l.id).replace(/^li_/, ""), l]),
    );
    const used = new Set<string>();
    orderedInst = [];
    for (const mid of order) {
      const li = byId.get(mid);
      if (li) {
        orderedInst.push(li);
        used.add(mid);
        for (const off of accessoryOfferLines.filter((o) => o.parentId === mid)) {
          orderedInst.push(off.line);
        }
      }
    }
    for (const [mid, li] of byId) {
      if (!used.has(mid)) {
        orderedInst.push(li);
        for (const off of accessoryOfferLines.filter((o) => o.parentId === mid)) {
          orderedInst.push(off.line);
        }
      }
    }
    orderedInst = orderedInst.map((li, i) =>
      normalizeLine({ ...li, sortOrder: (i + 1) * 10 }),
    );
  } else {
    orderedInst = applyStandardMeasureOrder(keepInst, products);
  }

  const merged = [...orderedInst, ...others].map((li, i) =>
    normalizeLine({ ...li, sortOrder: li.sortOrder || (i + 1) * 10 }),
  );
  // Re-number sequentially so document/editor keep this order
  const final = merged.map((li, i) =>
    normalizeLine({ ...li, sortOrder: (i + 1) * 10 }),
  );
  return foldStandalonePadIntoOwner(enforceSinglePadOnLines(final));
}

export function draftNarrative(a: WizardAnswers, _products: Product[]) {
  const pathLabel =
    HEATING_PATH_OPTIONS.find((h) => h.id === a.heatingPath)?.label ||
    "HVAC package";
  const executiveSummary =
    a.executiveSummary?.trim() ||
    defaultExecutiveSummary(a.clientContact?.split(/\s+/)[0]);
  const scope =
    a.scope?.trim() ||
    `Licensed supply and installation of Included measures, plus Optional measures and upgrades you accept when you sign. Work performed to manufacturer specs and applicable California code.`;
  const timeline =
    a.timeline?.trim() ||
    `Target start: ${a.startWindow || "to be scheduled"}. Typical install is 1–2 days after equipment arrives and permits are ready.`;
  const title =
    a.clientCompany || a.clientContact
      ? `${a.clientCompany || a.clientContact} — ${pathLabel}`
      : `Acme HVAC ${pathLabel}`;
  return { executiveSummary, scope, timeline, title };
}

export function applyWizardToProposal(
  a: WizardAnswers,
  products: Product[],
  existing?: Proposal | { id?: string },
): Proposal {
  const narrative = draftNarrative(a, products);
  const payment =
    PAYMENT_OPTIONS.find((p) => p.id === a.paymentTerms) ?? PAYMENT_OPTIONS[0];
  const base = createBlankProposal();
  const lineItems = buildLineItems(a, products);
  const productById = new Map(products.map((p) => [p.id, p]));

  const questions: ProposalQA[] = FAQ_BANK.filter((f) =>
    a.includedFaqIds?.includes(f.id),
  ).map((f) => ({
    id: f.id,
    question: f.question,
    answer: f.answer(a),
  }));

  // Discount % applies to the same package subtotal the customer sees:
  // included measures + included nested options (e.g. concrete pad), not bare unit prices only.
  const packageSubtotal = calcTotals(
    {
      ...base,
      lineItems,
      discount: 0,
      taxRate: 0,
    },
    [], // optionals not pre-selected
    [], // use each line's selectedOptionIds for pad / included options
  ).subtotal;
  const discount =
    a.discountPercent > 0
      ? Math.round(packageSubtotal * (a.discountPercent / 100) * 100) / 100
      : 0;

  return {
    ...base,
    ...(existing && "id" in existing && existing.id
      ? { id: existing.id }
      : {}),
    ...narrative,
    clientCompany: a.clientCompany,
    clientContact: a.clientContact,
    clientEmail: a.clientEmail,
    clientPhone: a.clientPhone || "",
    propertyStreet: a.propertyStreet || "",
    propertyCity: a.propertyCity || "",
    propertyZip: a.propertyZip || "",
    taxRate: 0, // sales tax removed from wizard packets
    discount,
    showMeasurePrices: Boolean(a.showMeasurePrices),
    rebates: (() => {
      const catalog = getRebatesCatalogForProposal();
      const selected = a.selectedRebateIds || [];
      const chosen = applyRebateOverrides(
        catalog,
        a.rebateAmountOverrides,
        selected,
      );
      const optIn = catalog.filter(
        (r) =>
          r.requiresCustomerOptIn &&
          r.enabled &&
          !selected.includes(r.id),
      );
      return [...chosen, ...optIn.map((r) => ({ ...r }))];
    })(),
    terms: `${base.terms}\n\nPayment preference: ${payment.label}.`,
    notes: [
      a.customNotes,
      hpwhRecircNotesFromAnswers(a, products),
    ]
      .filter(Boolean)
      .join("\n\n") || base.notes,
    warranty: buildProposalWarrantyPage(
      lineItems
        .map((li) =>
          li.productId ? productById.get(li.productId) : undefined,
        )
        .filter(Boolean) as Product[],
    ),
    lineItems,
    packetPackages: packetPackagesForProposal(
      {
        ...base,
        lineItems,
        wizardSnapshot: { answers: a, stepIdx: 0 },
      } as Proposal,
      products,
    ),
    selectedPackageKey: a.selectedPackageKey || null,
    questions,
    status: "draft",
    updatedAt: new Date().toISOString(),
    wizardSnapshot: {
      answers: a,
      stepIdx: 0,
    },
  };
}

export function padOwnerInstanceFromAnswers(
  a: WizardAnswers,
): MeasureInstance | null {
  const hosts = (a.measureInstances || []).filter(
    (m) =>
      m.familyId === "heat_pump" ||
      m.familyId === "ac" ||
      m.familyId === "ductless",
  );
  if (!hosts.length) return null;
  const withPad = hosts.find((m) => padModeFromInstance(m) !== "off");
  return withPad || hosts[0];
}

export function padOwnerIdFromAnswers(
  a: WizardAnswers,
  products: Product[],
): string | null {
  const hostInst = padOwnerInstanceFromAnswers(a);
  if (hostInst?.productId) {
    const hostIds = (a.measureInstances || [])
      .filter(
        (m) =>
          (m.familyId === "heat_pump" ||
            m.familyId === "ac" ||
            m.familyId === "ductless") &&
          m.productId,
      )
      .map((m) => m.productId!);
    const prefer = (a.measureInstances || [])
      .filter(
        (m) =>
          hostIds.includes(m.productId || "") &&
          padModeFromInstance(m) !== "off",
      )
      .map((m) => m.productId!);
    return (
      pickPadOwnerProductId(hostIds, products, prefer) || hostInst.productId
    );
  }
  const fromMeasures = (a.measureInstances || [])
    .map((m) => m.productId)
    .filter((id): id is string => Boolean(id));
  const ids = [
    ...fromMeasures,
    ...(a.coreProductIds || []),
    ...(a.optionalProductIds || []),
  ];
  const prefer = fromMeasures.filter((id) => {
    const inst = (a.measureInstances || []).find((m) => m.productId === id);
    if (!inst) return false;
    return padModeFromInstance(inst) !== "off";
  });
  return pickPadOwnerProductId(ids, products, prefer.length ? prefer : fromMeasures);
}

export { isPadOption, isOutdoorPadHost, getPadMaterial, getPadLabor, getPadSell };
