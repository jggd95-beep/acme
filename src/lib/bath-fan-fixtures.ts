/**
 * Five bath-fan jobs — used by the review page and qa:bath-fan.
 * Each path is a real walk, not a stub.
 */
import type { MeasureInstance, WizardAnswers } from "./quote-wizard";
import type { Product } from "./proposal-types";

export type BathFanFixture = {
  id: string;
  title: string;
  blurb: string;
  sku: string;
  inst: MeasureInstance;
  expect: {
    leadIncludes: string;
    stepsInclude: string[];
    stepsExclude: string[];
    cfmLine?: string;
  };
};

function inst(
  id: string,
  sku: string,
  extra: Partial<MeasureInstance>,
): MeasureInstance {
  return {
    id,
    familyId: "bath_fan",
    label: "Bath fan",
    productId: `prod_${sku.toLowerCase()}`,
    role: "included",
    equipmentConfirmed: true,
    accessoriesConfirmed: true,
    ...extra,
  };
}

export const BATH_FAN_FIXTURES: BathFanFixture[] = [
  {
    id: "hall-replace",
    title: "1 · Hall bath — replace",
    blurb: "Same opening, reuse duct, 120V in place, WhisperCeiling 80.",
    sku: "FAN-PANA-WC80",
    inst: inst("bf1", "FAN-PANA-WC80", {
      jobPath: "replace",
      bathCfm: 80,
      bathLengthFt: 5,
      bathWidthFt: 8,
      bathHeightFt: 8,
      scopeAnswers: {
        job_path: "replace",
        install_type: "replace_existing",
        fan_visit: "with",
        fan_fit: "yes",
        fan_duct: "reuse",
        fan_elec: "in_place",
      },
    }),
    expect: {
      leadIncludes: "WhisperCeiling 80 CFM bath fan",
      stepsInclude: [
        "Remove your existing bath fan, haul it away, and recycle it.",
        "Reuse the existing exhaust duct to the exterior and confirm the damper.",
        "Reconnect the existing 120-volt at the fan.",
        "Protect floors, counters, and fixtures in the bathroom and keep dust to a minimum.",
      ],
      stepsExclude: [
        "Cut in a new bath fan opening",
        "Set the fan to 80 CFM",
        "Electrical to the bath fan by others",
      ],
    },
  },
  {
    id: "master-open-plaster",
    title: "2 · Master — replace, open plaster",
    blurb: "Open the ceiling, plaster patch, new duct, new 120V, WhisperCeiling LED 110.",
    sku: "FAN-PANA-WC110L",
    inst: inst("bf2", "FAN-PANA-WC110L", {
      jobPath: "replace",
      bathCfm: 110,
      bathCfmSkipped: true,
      scopeAnswers: {
        job_path: "replace",
        install_type: "replace_existing",
        fan_visit: "alone",
        fan_fit: "no",
        fan_surface: "plaster",
        fan_duct: "new",
        fan_elec: "new",
      },
    }),
    expect: {
      leadIncludes: "WhisperCeiling LED 110 CFM bath fan",
      stepsInclude: [
        "Remove your existing bath fan, haul it away, and recycle it.",
        "Acme HVAC will install a rough plaster patch at the opening. Texture and paint are by the owner.",
        "Run new exhaust duct to the exterior with a working damper.",
        "Install a new 120-volt circuit to the bath fan.",
      ],
      stepsExclude: ["Set the fan to 110 CFM", "same opening"],
    },
  },
  {
    id: "new-select-80",
    title: "3 · New fan — homeowner, Select 80",
    blurb: "Cut-in, sheetrock, Pick-A-Flow 80, moisture module, new 120V.",
    sku: "FAN-PANA-VKS3",
    inst: inst("bf3", "FAN-PANA-VKS3", {
      jobPath: "new_location",
      bathCfm: 80,
      bathLengthFt: 8,
      bathWidthFt: 10,
      bathHeightFt: 8,
      accessoryPicks: ["fan_moisture"],
      scopeAnswers: {
        job_path: "new_location",
        install_type: "cut_in_new",
        fan_visit: "with",
        fan_surface: "sheetrock",
        fan_elec: "new",
        fan_cfm: "80",
      },
    }),
    expect: {
      leadIncludes: "WhisperGreen Select 50–110 CFM bath fan",
      stepsInclude: [
        "Cut in a new bath fan opening per the manufacturer template and framing.",
        "Run new exhaust duct to the exterior with a working damper.",
        "Acme HVAC will install a rough patch at the opening. Texture and paint are by the owner.",
        "Install a new 120-volt circuit to the bath fan.",
        "Set the fan to 80 CFM for this bathroom.",
        "Install a Panasonic condensation / moisture sensor module in the WhisperGreen Select.",
      ],
      stepsExclude: [
        "Remove your existing bath fan",
        "Electrical to the bath fan by others",
      ],
      cfmLine: "Set the fan to 80 CFM for this bathroom.",
    },
  },
  {
    id: "contractor-led",
    title: "4 · New fan for a contractor — Select LED 110",
    blurb: "We set the fan. Patch, duct, and electric stay with the GC.",
    sku: "FAN-PANA-VKSL3",
    inst: inst("bf4", "FAN-PANA-VKSL3", {
      jobPath: "contractor",
      bathCfm: 110,
      bathCfmSkipped: true,
      scopeAnswers: {
        job_path: "contractor",
        install_type: "contractor_new",
        fan_visit: "alone",
        fan_elec: "by_others",
        fan_duct: "by_others",
        fan_surface: "by_contractor",
        fan_cfm: "110",
      },
    }),
    expect: {
      leadIncludes: "WhisperGreen Select LED 50–110 CFM bath fan",
      stepsInclude: [
        "Cut in a new bath fan opening per the manufacturer template and framing.",
        "Patch, texture, and paint by others.",
        "Exhaust duct to the exterior by others.",
        "Electrical to the bath fan by others.",
        "Set the fan to 110 CFM for this bathroom.",
      ],
      stepsExclude: [
        "Remove your existing bath fan",
        "Texture and paint are by the owner",
        "Reconnect the existing 120-volt",
        "keep dust to a minimum",
      ],
    },
  },
  {
    id: "replace-sense-tile",
    title: "5 · Replace — WhisperSense, tile ceiling",
    blurb: "Open tile ceiling, reuse duct, 120V in place, Sense at 110.",
    sku: "FAN-PANA-SENSE",
    inst: inst("bf5", "FAN-PANA-SENSE", {
      jobPath: "replace",
      bathCfm: 110,
      bathLengthFt: 10,
      bathWidthFt: 12,
      bathHeightFt: 8,
      scopeAnswers: {
        job_path: "replace",
        install_type: "replace_existing",
        fan_visit: "with",
        fan_fit: "no",
        fan_surface: "tile_ceiling",
        fan_duct: "reuse",
        fan_elec: "in_place",
        fan_cfm: "110",
      },
    }),
    expect: {
      leadIncludes: "WhisperSense 80–110 CFM bath fan",
      stepsInclude: [
        "Remove your existing bath fan, haul it away, and recycle it.",
        "Cut the tile ceiling as needed for the new fan.",
        "Reuse the existing exhaust duct to the exterior and confirm the damper.",
        "Reconnect the existing 120-volt at the fan.",
        "Set the fan to 110 CFM for this bathroom.",
        "Protect floors, counters, and fixtures in the bathroom and keep dust to a minimum.",
        "Check, test, and start the new bath fan for proper operation, including the motion sensor.",
      ],
      stepsExclude: ["Electrical to the bath fan by others"],
    },
  },
];

export function fixtureAnswers(fix: BathFanFixture): WizardAnswers {
  return {
    version: 1,
    stepIdx: 3,
    clientContact: "Maria Rivera",
    clientCompany: "",
    clientEmail: "",
    clientPhone: "",
    propertyStreet: "412 Oak St",
    propertyCity: "Berkeley",
    propertyZip: "94702",
    propertyCounty: "",
    quoteVersion: 1,
    propertyType: "single_family",
    homeSize: "1800_2500",
    goals: ["bath_fan"],
    activeJobGoalId: "bath_fan",
    systemTonnage: 3,
    measureInstances: [fix.inst],
    selectedMeasureFamilies: ["bath_fan"],
    coreProductIds: [fix.inst.productId!],
    optionalProductIds: [],
    optionSelections: {},
    measureAdjustments: {},
  } as unknown as WizardAnswers;
}

export function fixtureProduct(
  products: Product[],
  sku: string,
): Product | undefined {
  const u = sku.toUpperCase();
  return products.find((p) => (p.sku || "").toUpperCase() === u);
}
