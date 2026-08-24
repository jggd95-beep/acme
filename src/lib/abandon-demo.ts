/**
 * Demo scenarios the CA can pick when a mini-split (or other new system)
 * is replacing whatever is in the house. Language matches the source measure.
 * Water heater is intentionally omitted.
 */
export type AbandonGroup =
  | "wall"
  | "floor"
  | "furnace"
  | "outdoor"
  | "other";

export type AbandonScenario = {
  id: string;
  group: AbandonGroup;
  label: string;
  blurb: string;
  scopeLines: string[];
  laborHours: number;
  materialCost?: number;
  allowPatch: boolean;
};

export const ABANDON_GROUPS: { id: AbandonGroup; label: string }[] = [
  { id: "wall", label: "Wall heater" },
  { id: "floor", label: "Floor heater" },
  { id: "furnace", label: "Gas furnace" },
  { id: "outdoor", label: "Air conditioning" },
  { id: "other", label: "Other" },
];

export const ABANDON_SCENARIOS: AbandonScenario[] = [
  {
    id: "wall_single",
    group: "wall",
    label: "Wall heater · single-sided",
    blurb: "Cap gas + flue",
    laborHours: 1.25,
    allowPatch: true,
    scopeLines: [
      "Remove your existing wall heater, haul it away, and recycle it. Cap the gas and flue at that location.",
    ],
  },
  {
    id: "wall_double",
    group: "wall",
    label: "Wall heater · double-sided",
    blurb: "Cap gas + flue · both sides",
    laborHours: 1.75,
    allowPatch: true,
    scopeLines: [
      "Remove your existing double-sided wall heater, haul it away, and recycle it. Cap the gas and flue at that location.",
    ],
  },
  {
    id: "wall_patch",
    group: "wall",
    label: "Wall heater · cap + rough patch",
    blurb: "From the wall-heater measure",
    laborHours: 1.5,
    materialCost: 62.79,
    allowPatch: false,
    scopeLines: [
      "Remove your existing wall heater, haul it away, and recycle it. Cap the gas and flue at that location. Install a rough wall patch. Texture, trim and painting by others.",
    ],
  },
  {
    id: "floor_cap",
    group: "floor",
    label: "Floor heater · cap gas/flue + rough patch",
    blurb: "From the air-handler measure",
    laborHours: 1.5,
    allowPatch: false,
    scopeLines: [
      "Remove your existing floor furnace, haul it away, and recycle it. Cap the gas and flue. Install a rough floor patch as needed. Flooring, texture, trim and painting by others.",
    ],
  },
  {
    id: "floor_grille",
    group: "floor",
    label: "Floor heater · keep grille as return",
    blurb: "Location stays as return air",
    laborHours: 1.25,
    allowPatch: false,
    scopeLines: [
      "Remove existing floor heater and cap off gas line and flue. Use the existing floor heater location and grille as the new return-air inlet.",
    ],
  },
  {
    id: "furn_easy",
    group: "furnace",
    label: "Gas furnace",
    blurb: "Cap gas at the furnace · typical pull",
    laborHours: 1.5,
    materialCost: 125.38,
    allowPatch: false,
    scopeLines: [
      "Remove your existing furnace, haul it away, and recycle it. Cap off the gas line at the furnace location. Make the flue safe or remove it as required.",
    ],
  },
  {
    id: "furn_attic",
    group: "furnace",
    label: "Gas furnace · attic or gravity",
    blurb: "Harder pull · still cap the gas",
    laborHours: 2.5,
    materialCost: 125.38,
    allowPatch: false,
    scopeLines: [
      "Remove your existing attic or gravity furnace, haul it away, and recycle it. Cap off the gas line at the furnace location. Make the flue safe or remove it as required.",
    ],
  },
  {
    id: "ac_outdoor",
    group: "outdoor",
    label: "Air conditioning system",
    blurb: "Recover refrigerant · recycle the condenser",
    laborHours: 1.25,
    allowPatch: false,
    scopeLines: [
      "Recover the refrigerant to EPA requirements, then remove your existing air conditioner, haul it away, and recycle it.",
    ],
  },
  {
    id: "hp_outdoor",
    group: "outdoor",
    label: "Heat pump",
    blurb: "Recover refrigerant · recycle the outdoor unit",
    laborHours: 1.25,
    allowPatch: false,
    scopeLines: [
      "Recover the refrigerant to EPA requirements, then remove your existing outdoor unit, haul it away, and recycle it.",
    ],
  },
  {
    id: "electric",
    group: "other",
    label: "Electric heater(s) · disconnect + patch",
    blurb: "From the air-handler measure",
    laborHours: 0.88,
    materialCost: 57.33,
    allowPatch: false,
    scopeLines: [
      "Remove and dispose of electric heater(s). Properly disconnect electrical and remove or secure wiring in approved accessible junction box(s). Close up opening(s) with rough patch. All texture, trim, flooring and painting by others.",
    ],
  },
  {
    id: "other_gas",
    group: "other",
    label: "Other gas appliance · cap gas + flue",
    blurb: "Catch-all",
    laborHours: 1,
    allowPatch: true,
    scopeLines: [
      "Remove your existing gas appliance, haul it away, and recycle it. Cap the gas and flue at that location.",
    ],
  },
];

export function abandonById(id: string): AbandonScenario | undefined {
  return ABANDON_SCENARIOS.find((s) => s.id === id);
}