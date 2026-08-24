/**
 * Install placement for large equipment measures.
 * Used in measure titles and customer packet wording (sold to be installed at…).
 *
 * Indoor vs outdoor menus — tankless water heaters are the dual (in or out) case.
 */

export type PlacementPreset = { id: string; label: string };

/** Exterior equipment: heat pump, AC, package, ductless outdoor */
export const OUTDOOR_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "front", label: "Front of home" },
  { id: "front-left", label: "Front left" },
  { id: "front-right", label: "Front right" },
  { id: "front-center", label: "Front center" },
  { id: "rear", label: "Rear of home" },
  { id: "rear-left", label: "Rear left" },
  { id: "rear-right", label: "Rear right" },
  { id: "rear-center", label: "Rear center" },
  { id: "left-side", label: "Left side" },
  { id: "right-side", label: "Right side" },
  { id: "south", label: "South side" },
  { id: "north", label: "North side" },
  { id: "east", label: "East side" },
  { id: "west", label: "West side" },
  { id: "side-yard", label: "Side yard" },
  { id: "courtyard", label: "Courtyard" },
  { id: "roof", label: "Roof" },
  { id: "pad-existing", label: "Existing pad" },
  { id: "garage-exterior", label: "Garage exterior wall" },
  { id: "other", label: "Other…" },
];

/** Indoor equipment: air handler, furnace, coil, etc. — no exterior yard chips */
export const INDOOR_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "attic", label: "Attic" },
  { id: "upstairs-closet", label: "Upstairs closet" },
  { id: "main-closet", label: "Main closet" },
  { id: "downstairs-closet", label: "Downstairs closet" },
  { id: "basement", label: "Basement" },
  { id: "crawl", label: "Crawl" },
  { id: "garage", label: "Garage" },
  { id: "utility", label: "Utility" },
  { id: "mechanical", label: "Mechanical" },
  { id: "closet", label: "Closet" },
  { id: "other", label: "Other…" },
];

/** Wall heater / wall furnace — room / wall interior only */
export const WALL_HEATER_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "living", label: "Living room" },
  { id: "family", label: "Family room" },
  { id: "bedroom", label: "Bedroom" },
  { id: "hallway", label: "Hallway" },
  { id: "dining", label: "Dining" },
  { id: "kitchen", label: "Kitchen" },
  { id: "office", label: "Office" },
  { id: "bonus", label: "Bonus room" },
  { id: "garage", label: "Garage" },
  { id: "upstairs", label: "Upstairs" },
  { id: "downstairs", label: "Downstairs" },
  { id: "adu", label: "ADU" },
  { id: "other", label: "Other…" },
];

/** Bath fan — room is the name on the card and packet */
export const BATH_FAN_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "hall-bath", label: "Hall bath" },
  { id: "master", label: "Master bath" },
  { id: "powder", label: "Powder" },
  { id: "guest", label: "Guest bath" },
  { id: "laundry", label: "Laundry" },
  { id: "other", label: "Other…" },
];

/** Standalone electrical — where the work lands */
export const ELECTRICAL_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "garage", label: "Garage" },
  { id: "laundry", label: "Laundry" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "outdoor", label: "Outdoor" },
  { id: "attic", label: "Attic" },
  { id: "panel", label: "At the panel" },
  { id: "other", label: "Other…" },
];

/** Tank / hybrid WH — typically interior */
export const WH_TANK_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "garage", label: "Garage" },
  { id: "basement", label: "Basement" },
  { id: "utility", label: "Utility" },
  { id: "closet", label: "Closet" },
  { id: "mechanical", label: "Mechanical" },
  { id: "laundry", label: "Laundry" },
  { id: "attic", label: "Attic" },
  { id: "crawl", label: "Crawl" },
  { id: "hallway-closet", label: "Hall closet" },
  { id: "outdoor-closet", label: "Outdoor closet" },
  { id: "shed", label: "Shed" },
  { id: "adu", label: "ADU" },
  { id: "other", label: "Other…" },
];

/**
 * Tankless — can be inside or outside.
 * Grouped list: interior first, then exterior.
 */
export const WH_TANKLESS_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "garage", label: "Garage" },
  { id: "utility", label: "Utility" },
  { id: "mechanical", label: "Mechanical" },
  { id: "closet", label: "Closet" },
  { id: "basement", label: "Basement" },
  { id: "attic", label: "Attic" },
  { id: "laundry", label: "Laundry" },
  { id: "outdoor-closet", label: "Outdoor closet" },
  { id: "outdoor-wall", label: "Outdoor wall" },
  { id: "side-yard", label: "Side yard" },
  { id: "rear", label: "Rear outside" },
  { id: "front", label: "Front outside" },
  { id: "adu", label: "ADU" },
  { id: "other", label: "Other…" },
];

/** @deprecated Use OUTDOOR_PLACEMENT_PRESETS — kept for older imports */
export const HVAC_PLACEMENT_PRESETS = OUTDOOR_PLACEMENT_PRESETS;
/** @deprecated Use WH_TANK_PLACEMENT_PRESETS */
export const WH_PLACEMENT_PRESETS = WH_TANK_PLACEMENT_PRESETS;

export type MeasureFamilyForPlacement =
  | "heat_pump"
  | "ac"
  | "furnace"
  | "ductless"
  | "package_unit"
  | "air_handler"
  | "water_heater"
  | "wall_heater"
  | "bath_fan"
  | "electrical";

const PLACEMENT_FAMILIES = new Set<string>([
  "heat_pump",
  "ac",
  "furnace",
  "ductless",
  "package_unit",
  "air_handler",
  "water_heater",
  "wall_heater",
  "bath_fan",
  "electrical",
]);

const OUTDOOR_FAMILIES = new Set<string>([
  "heat_pump",
  "ac",
  "ductless",
  "package_unit",
]);

const INDOOR_FAMILIES = new Set<string>(["air_handler", "furnace"]);

export function familyNeedsPlacement(familyId: string): boolean {
  return PLACEMENT_FAMILIES.has(familyId);
}

export type PlacementContext = {
  /** water_heater path: gas-tank | electric-tank | hybrid | tankless */
  waterHeaterStyle?: string | null;
};

/**
 * Location chips by equipment type.
 * Indoor vs outdoor split; tankless WH is the dual case.
 */
/** Package / rooftop — curb first, not a yard pad. */
export const PACKAGE_PLACEMENT_PRESETS: PlacementPreset[] = [
  { id: "roof-curb", label: "New roof curb" },
  { id: "existing-curb", label: "Existing roof curb" },
  { id: "roof", label: "Roof (no curb)" },
  { id: "grade", label: "On the ground" },
  { id: "garage-exterior", label: "Garage exterior" },
  { id: "other", label: "Other…" },
];

export function presetsForFamily(
  familyId: string,
  ctx?: PlacementContext,
): PlacementPreset[] {
  if (familyId === "water_heater") {
    const style = (ctx?.waterHeaterStyle || "").toLowerCase();
    if (style === "tankless" || style.includes("tankless")) {
      return WH_TANKLESS_PLACEMENT_PRESETS;
    }
    // tank / hybrid / electric-tank / gas-tank / unset → indoor-focused tank list
    return WH_TANK_PLACEMENT_PRESETS;
  }
  if (familyId === "wall_heater") return WALL_HEATER_PLACEMENT_PRESETS;
  if (familyId === "bath_fan") return BATH_FAN_PLACEMENT_PRESETS;
  if (familyId === "electrical") return ELECTRICAL_PLACEMENT_PRESETS;
  if (familyId === "package_unit") return PACKAGE_PLACEMENT_PRESETS;
  if (INDOOR_FAMILIES.has(familyId)) return INDOOR_PLACEMENT_PRESETS;
  if (OUTDOOR_FAMILIES.has(familyId)) return OUTDOOR_PLACEMENT_PRESETS;
  return OUTDOOR_PLACEMENT_PRESETS;
}

/** Human label for which menu is active (advisor UI) */
export function placementMenuKind(
  familyId: string,
  ctx?: PlacementContext,
): "outdoor" | "indoor" | "wall" | "wh_tank" | "wh_tankless" | "package" {
  if (familyId === "water_heater") {
    const style = (ctx?.waterHeaterStyle || "").toLowerCase();
    if (style === "tankless" || style.includes("tankless")) return "wh_tankless";
    return "wh_tank";
  }
  if (familyId === "wall_heater") return "wall";
  if (familyId === "package_unit") return "package";
  if (INDOOR_FAMILIES.has(familyId)) return "indoor";
  return "outdoor";
}

export function placementPresetLabel(
  presets: PlacementPreset[],
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  return presets.find((p) => p.id === id)?.label ?? null;
}

/** Compose display string for title / packet */
export function composeInstallPlacement(
  familyId: string,
  presetId: string | null | undefined,
  detail: string | null | undefined,
  ctx?: PlacementContext,
): string {
  const presets = presetsForFamily(familyId, ctx);
  const base = placementPresetLabel(presets, presetId);
  const d = (detail || "").trim();
  if (presetId === "other" && d) return d;
  if (base && d) return `${base} — ${d}`;
  if (base) return base;
  return d;
}
