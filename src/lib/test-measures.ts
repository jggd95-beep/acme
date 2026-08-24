/**
 * Pre-built test measures + save/load packs for packet output QA.
 * Stored on-device so sales can re-open realistic measures anytime.
 */
import {
  applyStandardMeasureOrder,
  createBlankProposal,
  normalizeLine,
  productToLine,
  type Product,
  type ProductOption,
  type Proposal,
  type QuoteLine,
} from "./proposal-types";
import {
  CUSTOM_CONCRETE_PAD_TITLE,
  customConcretePadBody,
  padCustomerPrice,
  PAD_LABOR,
  PAD_MATERIAL,
  isPadOption,
} from "./equipment-catalog";

export type SavedTestPack = {
  id: string;
  name: string;
  createdAt: string;
  notes?: string;
  /** Snapshot of customer-facing line items */
  lineItems: QuoteLine[];
  showMeasurePrices?: boolean;
  executiveSummary?: string;
  warranty?: string;
  clientContact?: string;
  clientCompany?: string;
  clientEmail?: string;
};

const STORAGE_KEY = "aarvaks_test_measure_packs_v1";

function findBySku(products: Product[], sku: string): Product | undefined {
  const u = sku.toUpperCase();
  return products.find((p) => (p.sku || "").toUpperCase() === u);
}

function findFirst(
  products: Product[],
  pred: (p: Product) => boolean,
): Product | undefined {
  return products.find(pred);
}

function withRichCopy(
  line: QuoteLine,
  copy: {
    benefits?: string[];
    workScope?: string;
    options?: ProductOption[];
    name?: string;
  },
): QuoteLine {
  return normalizeLine({
    ...line,
    name: copy.name || line.name,
    benefits: copy.benefits ?? line.benefits,
    workScope: copy.workScope ?? line.workScope,
    options: copy.options ?? line.options,
  });
}

function padOption(ownerId: string): ProductOption {
  const sell = padCustomerPrice(PAD_MATERIAL, PAD_LABOR);
  return {
    id: `PAD-test-${ownerId}`,
    kind: "pad",
    title: CUSTOM_CONCRETE_PAD_TITLE,
    body: customConcretePadBody(),
    materialCost: PAD_MATERIAL,
    laborHours: PAD_LABOR,
    priceDelta: sell,
    defaultSelected: true,
  };
}

function mervOptions(): ProductOption[] {
  return [
    {
      id: "opt_merv13_test",
      kind: "accessory",
      title: "MERV 13 media upgrade",
      body: "Finer filtration for allergy season — drop-in media for the installed cabinet.",
      priceDelta: 185,
      defaultSelected: false,
    },
    {
      id: "opt_merv16_test",
      kind: "accessory",
      title: "MERV 16 media upgrade",
      body: "Highest residential media class we offer for this cabinet size.",
      priceDelta: 265,
      defaultSelected: false,
    },
  ];
}

function tierOption(main: Product, upgrade: Product): ProductOption {
  const delta = Math.max(0, (upgrade.unitPrice || 0) - (main.unitPrice || 0));
  return {
    id: `tier_up_${main.sku}_to_${upgrade.sku}`,
    kind: "tier_upgrade",
    title: `Option: ${upgrade.name}`,
    body: `Upgrade from ${main.name} to ${upgrade.name}.`,
    priceDelta: delta,
    upgradeSku: upgrade.sku,
    upgradeTier: upgrade.tier ?? 2,
    defaultSelected: false,
  };
}

/**
 * Full demo package: HP + AH + filter (with options) + ductwork + install +
 * permit + load calc + custom measure. Built for testing benefits / scope /
 * options / investment / CA pages on landscape output.
 */
export function buildDemoOutputLineItems(products: Product[]): QuoteLine[] {
  const lines: QuoteLine[] = [];
  const cat = products;

  const hp =
    findBySku(cat, "CAR-25VNA4") ||
    findFirst(
      cat,
      (p) =>
        p.equipmentKind === "heat_pump" &&
        !/ductless|mini/i.test(p.name) &&
        (p.unitPrice || 0) > 0,
    );
  const hpUpgrade = findFirst(
    cat,
    (p) =>
      p.equipmentKind === "heat_pump" &&
      p.id !== hp?.id &&
      !/ductless|mini/i.test(p.name) &&
      (p.unitPrice || 0) > (hp?.unitPrice || 0),
  );
  const ah =
    findBySku(cat, "CAR-FE4ANB") ||
    findFirst(cat, (p) => p.equipmentKind === "air_handler");
  const filter =
    findFirst(cat, (p) => (p.sku || "").startsWith("AA-") || /aprilaire|media/i.test(p.name)) ||
    findBySku(cat, "SVC-FILTER");
  const install =
    findBySku(cat, "SVC-INSTALL") ||
    findFirst(cat, (p) => /install|startup/i.test(p.name));
  const permit =
    findBySku(cat, "SVC-PERMIT") ||
    findFirst(cat, (p) => /permit/i.test(p.name));
  const duct =
    findBySku(cat, "SVC-DUCT") ||
    findFirst(cat, (p) => /duct seal|ductwork/i.test(p.name));
  const load =
    findBySku(cat, "SVC-LOAD") ||
    findFirst(cat, (p) => /load calc|manual j/i.test(p.name));

  if (hp) {
    const opts: ProductOption[] = [padOption(hp.id)];
    if (hpUpgrade) opts.push(tierOption(hp, hpUpgrade));
    lines.push(
      withRichCopy(
        productToLine(hp, {
          role: "included",
          defaultSelected: true,
          catalog: cat,
        }),
        {
          name: hp.name,
          benefits: [
            "High-efficiency heat pump heating and cooling in one system",
            "Quieter outdoor operation than older single-stage equipment",
            "Right-sized for the home after load calculation",
            "Pairs with a matching air handler for balanced airflow",
          ],
          workScope:
            "1. Recover refrigerant and remove outdoor unit safely.\n" +
            "2. Set new heat pump on pad; level and secure.\n" +
            "3. Braze or connect line set; pressure test and evacuate.\n" +
            "4. Charge to manufacturer specs; verify operation in heat and cool.\n" +
            "5. Review thermostat operation and maintenance with the homeowner.",
          options: opts,
        },
      ),
    );
  }

  if (ah) {
    lines.push(
      withRichCopy(
        productToLine(ah, {
          role: "included",
          defaultSelected: true,
          catalog: cat,
        }),
        {
          benefits: [
            "Variable or multi-speed airflow for comfort and efficiency",
            "Matched to the outdoor unit capacity",
            "Cleaner coil access for long-term service",
          ],
          workScope:
            "1. Remove existing air handler / furnace coil as applicable.\n" +
            "2. Install new air handler; transition supply and return.\n" +
            "3. Connect condensate with proper trap and safety switch.\n" +
            "4. Wire controls; verify static and temperature split.",
          options: [],
        },
      ),
    );
  }

  if (filter) {
    const fLine = productToLine(filter, {
      role: "included",
      defaultSelected: true,
      catalog: cat,
    });
    lines.push(
      withRichCopy(fLine, {
        benefits: [
          "Whole-home media filtration (not a 1-inch throwaway filter)",
          "Cabinet sized for the equipment return",
          "Optional MERV upgrades available below",
        ],
        workScope:
          "1. Install media cabinet in the return air path.\n" +
            "2. Seal cabinet to duct transitions.\n" +
            "3. Install starting media; leave spare guidance for homeowner.",
        options: mervOptions(),
      }),
    );
  }

  if (duct) {
    lines.push(
      withRichCopy(
        productToLine(duct, {
          role: "included",
          defaultSelected: true,
          catalog: cat,
        }),
        {
          benefits: [
            "Seals accessible leaks so conditioned air reaches the rooms that need it",
            "Supports proper airflow for the new equipment",
            "Minor transitions within quoted labor hours",
          ],
          workScope:
            "1. Inspect accessible supply and return ducts in work areas.\n" +
            "2. Seal joints and takeoffs with mastic / code-appropriate tape.\n" +
            "3. Repair damaged flexible runs within quoted scope.\n" +
            "4. Verify path is open after equipment changeout.",
        },
      ),
    );
  }

  if (install) {
    lines.push(
      productToLine(install, {
        role: "included",
        defaultSelected: true,
        catalog: cat,
      }),
    );
  }
  if (permit) {
    lines.push(
      productToLine(permit, {
        role: "included",
        defaultSelected: true,
        catalog: cat,
      }),
    );
  }
  if (load) {
    const l = productToLine(load, {
      role: "info",
      defaultSelected: true,
      catalog: cat,
      showPrice: false,
    });
    lines.push(
      normalizeLine({
        ...l,
        unitPrice: 0,
        showPrice: false,
        role: "info",
      }),
    );
  }

  // Optional comfort measure for checkbox testing
  const humid = findFirst(cat, (p) => /humidif/i.test(p.name));
  if (humid) {
    lines.push(
      withRichCopy(
        productToLine(humid, {
          role: "optional",
          optional: true,
          defaultSelected: false,
          catalog: cat,
        }),
        {
          benefits: [
            "Adds moisture in dry seasons for comfort",
            "Works with the central system when selected",
          ],
          workScope:
            "1. Mount humidifier on supply or return per model.\n" +
            "2. Plumb water and drain; wire to control.\n" +
            "3. Set humidity target; demonstrate to homeowner.",
        },
      ),
    );
  }

  // Custom freeform measure for testing custom layout
  lines.push(
    normalizeLine({
      id: "li_test_custom_platform",
      productId: null,
      name: "Attic service platform & safety (test custom)",
      description: "Custom measure — freeform benefits and work scope",
      quantity: 1,
      unit: "job",
      unitPrice: 890,
      materialCost: 220,
      laborHours: 4,
      role: "included",
      optional: false,
      defaultSelected: true,
      showPrice: true,
      benefits: [
        "Safe standing area for future service visits",
        "Protects ceiling drywall under equipment path",
        "Built for the equipment footprint on this job",
      ],
      workScope:
        "1. Build plywood platform spanning joists under air handler path.\n" +
        "2. Secure walk boards from attic access to equipment.\n" +
        "3. Leave area clean and photo-document for the homeowner.",
      options: [
        {
          id: "opt_test_led",
          kind: "accessory",
          title: "Attic LED work light (optional)",
          body: "Switched LED at platform for safer future visits.",
          priceDelta: 145,
        },
      ],
      sortOrder: 480,
    }),
  );

  // Mark pad selected on HP line for "included pad" testing
  const ordered = applyStandardMeasureOrder(lines, cat).map((li) => {
    const n = normalizeLine(li);
    if (n.options?.some(isPadOption)) {
      return normalizeLine({
        ...n,
        selectedOptionIds: n.options.filter(isPadOption).map((o) => o.id),
      });
    }
    return n;
  });

  return ordered;
}

export function createDemoOutputProposal(products: Product[]): Proposal {
  const lineItems = buildDemoOutputLineItems(products);
  return createBlankProposal({
    id: `prop_demo_output_${Date.now().toString(36)}`,
    title: "Rivera Test — full output demo",
    proposalNumber: `TEST-OUT-${Date.now().toString(36).toUpperCase()}`,
    clientCompany: "Rivera Test Residence",
    clientContact: "Maria Rivera",
    clientEmail: "maria.rivera.test@example.com",
    clientPhone: "(510) 555-0199",
    propertyStreet: "1234 Dwight Way",
    propertyCity: "Berkeley",
    propertyState: "CA",
    propertyZip: "94702",
    propertyImageUrl: "/property-samples/house.jpg",
    isTest: true,
    status: "draft",
    showMeasurePrices: false,
    lineItems,
    executiveSummary:
      "Training packet with heat pump, air handler, filtration (MERV options), duct sealing, install, permit, load calc, optional humidifier, and a custom attic platform measure. Use View / Download PDF to verify benefits, work scope, in-measure options, investment alignment, and California notices.",
    warranty:
      "Manufacturer equipment warranty as published. Acme HVAC labor warranty per company policy. This is a TEST proposal for layout verification.",
    notes: "TEST OUTPUT DEMO — re-open from Home anytime.",
  });
}

/** Load saved packs from localStorage */
export function listSavedTestPacks(): SavedTestPack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTestPack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTestPackFromProposal(
  p: Proposal,
  name?: string,
): SavedTestPack {
  const pack: SavedTestPack = {
    id: `pack_${Date.now().toString(36)}`,
    name:
      name?.trim() ||
      `Test pack — ${p.clientContact || p.title || "quote"} — ${new Date().toLocaleDateString()}`,
    createdAt: new Date().toISOString(),
    notes: p.notes || undefined,
    lineItems: (p.lineItems || []).map((li) => normalizeLine({ ...li })),
    showMeasurePrices: p.showMeasurePrices,
    executiveSummary: p.executiveSummary,
    warranty: p.warranty,
    clientContact: p.clientContact,
    clientCompany: p.clientCompany,
    clientEmail: p.clientEmail,
  };
  const all = listSavedTestPacks().filter((x) => x.id !== pack.id);
  all.unshift(pack);
  // Keep last 12 packs
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 12)));
  return pack;
}

export function deleteSavedTestPack(id: string): void {
  const all = listSavedTestPacks().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function proposalFromTestPack(pack: SavedTestPack): Proposal {
  return createBlankProposal({
    id: `prop_from_pack_${Date.now().toString(36)}`,
    title: `${pack.name} (restored)`,
    proposalNumber: `TEST-PACK-${Date.now().toString(36).toUpperCase()}`,
    clientCompany: pack.clientCompany || "Rivera Test Residence",
    clientContact: pack.clientContact || "Maria Rivera",
    clientEmail: pack.clientEmail || "maria.rivera.test@example.com",
    isTest: true,
    status: "draft",
    showMeasurePrices: pack.showMeasurePrices,
    lineItems: (pack.lineItems || []).map((li) =>
      normalizeLine({
        ...li,
        id: `li_${Math.random().toString(36).slice(2, 10)}`,
      }),
    ),
    executiveSummary: pack.executiveSummary,
    warranty: pack.warranty,
    notes: `Restored test pack ${pack.id}`,
  });
}

/** Refresh the static training sample with rich demo lines */
export function createRichTrainingSample(products: Product[]): Proposal {
  const demo = createDemoOutputProposal(products);
  return {
    ...demo,
    id: "prop_sample_training",
    proposalNumber: "TEST-SAMPLE-001",
    title: "Rivera Test Residence — full output sample",
  };
}
