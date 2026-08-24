/**
 * Homeowner-facing manufacturer product links (consumer sites — not contractor portals).
 * Used on the customer proposal benefits column as "Learn more" anchors.
 */
import type { Product } from "./proposal-types";

export type ManufacturerLink = {
  label: string;
  url: string;
  /** Short note shown under the link */
  note?: string;
};

/** Known consumer product pages by brand / series. */
const HOMEOWNER_PAGES = {
  carrierHome: "https://www.carrier.com/residential/en/us/",
  carrierHeatPumps:
    "https://www.carrier.com/residential/en/us/products/heat-pumps/",
  carrierAc:
    "https://www.carrier.com/residential/en/us/products/air-conditioners/",
  carrierFurnaces:
    "https://www.carrier.com/residential/en/us/products/furnaces/",
  carrierAirHandlers:
    "https://www.carrier.com/residential/en/us/products/fan-coils/",
  carrierDuctless:
    "https://www.carrier.com/residential/en/us/products/ductless-systems/",
  carrierInfinityControl:
    "https://www.carrier.com/residential/en/us/products/thermostats/infinity-system-control/",
  carrierThermostats:
    "https://www.carrier.com/residential/en/us/products/thermostats/",
  mitsuHome: "https://www.mitsubishicomfort.com/",
  mitsuDuctless: "https://www.mitsubishicomfort.com/products",
  mitsuHyperHeat:
    "https://www.mitsubishicomfort.com/products/heat-pumps",
  mitsuSvz: "https://www.mitsubishicomfort.com/products/p-series/svz",
  mitsuPuzHa: "https://www.mitsubishicomfort.com/products/p-series/puz-ha",
  boschIds:
    "https://www.bosch-homecomfort.com/us/en/residential/products/heat-pumps/",
  aprilaireHome: "https://www.aprilaire.com/",
  aprilaireFilters:
    "https://www.aprilaire.com/whole-house-products/air-purifiers",
  aprilaireHumidifiers:
    "https://www.aprilaire.com/whole-house-products/humidifiers",
  navienResidential: "https://www.navieninc.com/residential",
  navienHvac: "https://www.navieninc.com/hvac",
  navienNaz: "https://www.navieninc.com/series/naz",
  navienNas: "https://www.navieninc.com/series/nas",
  navienNpf: "https://www.navieninc.com/series/npf",
  navienTankless:
    "https://www.navieninc.com/residential/water-heaters/tankless",
  navienBoilers: "https://www.navieninc.com/series/nhb-h",
  rinnaiWall: "https://www.rinnai.us/residential/direct-vent-heaters",
  aoSmithHome: "https://www.hotwater.com/",
  aoSmithHpwh:
    "https://www.hotwater.com/residential/water-heaters/hybrid-electric-heat-pump/",
  ecobeePremium: "https://www.ecobee.com/en-us/smart-thermostats/smart-thermostat-premium/",
  ecobeeEnhanced: "https://www.ecobee.com/en-us/smart-thermostats/",
  nestLearning: "https://store.google.com/product/nest_learning_thermostat",
  nestThermostat: "https://store.google.com/product/nest_thermostat",
  honeywellHome: "https://www.honeywellhome.com/",
  honeywellHumidifier: "https://www.honeywellhome.com/",
  honeywellTrueFresh:
    "https://www.honeywellhome.com/blogs/support/truefresh-ventilation-systems-2",
  broanHome: "https://www.broan-nutone.com/",
  panasonicFans: "https://iaq.na.panasonic.com/ventilation/fans",
  fergusonHome: "https://www.ferguson.com/",
  williamsWall: "https://williamscomfortprod.com/products/furnaces/",
  carrierLit:
    "https://www.carrier.com/residential/en/us/support/product-literature/",
  navienSupport: "https://www.navieninc.com/support",
  mitsuSupport: "https://www.mitsubishicomfort.com/support",
  aoSmithLit: "https://www.hotwater.com/find-documents-and-videos",
  aoSmithSupport: "https://www.hotwater.com/support.html",
  rinnaiEx17: "https://www.rinnai.us/residential/product-detail/ex17dtn",
  rinnaiSupport: "https://www.rinnai.us/support",
  navienNpeDl: "https://www.navieninc.com/series/npe-s2/downloads",
  navienNpeBrochure: "https://www.navieninc.com/downloads/npe-2-consumer-brochure-en",
  navienNpeInstall:
    "https://www.navieninc.com/downloads/npe-a-s-manuals-installation-manual-en",
  navienNazDl: "https://www.navieninc.com/series/naz/downloads",
  navienNazBrochure: "https://www.navieninc.com/downloads/naz-consumer-brochure-en",
  navienNazInstall:
    "https://www.navieninc.com/downloads/naz-installation-and-operation-manual-en",
  navienNasDl: "https://www.navieninc.com/series/nas/downloads",
  navienNasInstall:
    "https://www.navieninc.com/downloads/nas-installation-and-operation-manual-en",
  navienNpfDl: "https://www.navieninc.com/series/npf/downloads",
  navienNhbDl: "https://www.navieninc.com/series/nhb-h/downloads",
  navienNhbInstall:
    "https://www.navieninc.com/downloads/nhb-h-installation-operational-manual-en",
  navienNfbDl: "https://www.navieninc.com/series/nfb-h/downloads",
  carrierLitSearch:
    "https://www.carrier.com/residential/en/us/homeowner-resources/product-literature/",
  carrierHpComfort: "https://www.carrier.com/us/en/residential/heat-pumps/27sca5/",
  carrierHpLine: "https://www.carrier.com/us/en/residential/heat-pumps/",
  mitsuBrochures: "https://www.mitsubishicomfort.com/brochures-catalogs",
  mitsuLiterature: "https://www.mitsubishicomfort.com/literature",
  iqairPerfect16:
    "https://www.iqair.com/air-purifiers/whole-house-air-purifiers/guides-manuals",
  boschIdsManuals:
    "https://www.bosch-homecomfort.com/us/en/residential/technical-documentation/manuals/heating-and-cooling-heat-pump-systems/inverter-ducted-split-(ids)-heat-pump/",
  honeywellHe360:
    "https://www.honeywellhome.com/products/he360-evaporative-fan-powered-whole-home-humidifier",
  nestInstall: "https://support.google.com/googlenest/answer/9247296",
  ecobeeSupport: "https://www.ecobee.com/en-us/support/",
  rheemTanks: "https://www.rheem.com/products/residential/water-heating/tank/",
  cozyLine: "https://williamscomfort.com/products/furnaces/cozy/",
  boschSupport:
    "https://www.bosch-homecomfort.com/us/en/residential/service/",
  genericHvac: "https://www.energy.gov/energysaver/heat-pump-systems",
} as const;

function link(
  label: string,
  url: string,
  note?: string,
): ManufacturerLink {
  return { label, url, note };
}

/**
 * Resolve homeowner-facing manufacturer links for a catalog product.
 * Prefers product.productInfoUrl when set; otherwise infers from brand/SKU.
 */
export function resolveManufacturerLinks(
  product: Pick<
    Product,
    | "name"
    | "sku"
    | "category"
    | "description"
    | "equipmentKind"
    | "familyId"
    | "productInfoUrl"
    | "manufacturerLinks"
  > | null | undefined,
): ManufacturerLink[] {
  if (!product) return [];

  // Explicit links on the product win
  if (product.manufacturerLinks?.length) {
    return product.manufacturerLinks.filter((l) => l.url && l.label);
  }
  if (product.productInfoUrl) {
    return [
      link(
        "Manufacturer product details",
        product.productInfoUrl,
        "Homeowner product information",
      ),
    ];
  }

  const blob =
    `${product.name} ${product.sku} ${product.category} ${product.description} ${product.familyId || ""}`.toLowerCase();
  const sku = (product.sku || "").toUpperCase();
  const links: ManufacturerLink[] = [];

  // Thermostats / controls
  if (/CTRL-ECO-PREM|ecobee.*premium/i.test(sku + blob)) {
    links.push(
      link(
        "ecobee Smart Thermostat Premium",
        HOMEOWNER_PAGES.ecobeePremium,
        "Features, app, and homeowner guides",
      ),
    );
  } else if (/CTRL-ECO|ecobee/i.test(sku + blob)) {
    links.push(
      link(
        "ecobee smart thermostats",
        HOMEOWNER_PAGES.ecobeeEnhanced,
        "Compare models on ecobee.com",
      ),
    );
  } else if (/CTRL-NEST-LRN|nest learning/i.test(sku + blob)) {
    links.push(
      link(
        "Google Nest Learning Thermostat",
        HOMEOWNER_PAGES.nestLearning,
        "Consumer product page",
      ),
    );
  } else if (/CTRL-NEST|nest thermostat/i.test(sku + blob)) {
    links.push(
      link(
        "Google Nest Thermostat",
        HOMEOWNER_PAGES.nestThermostat,
        "Consumer product page",
      ),
    );
  } else if (/CTRL-INF|infinity system control/i.test(sku + blob)) {
    links.push(
      link(
        "Carrier Infinity® System Control",
        HOMEOWNER_PAGES.carrierInfinityControl,
        "Homeowner product overview",
      ),
    );
  } else if (/CTRL-CAR|carrier.*thermostat|comfort.*thermostat/i.test(sku + blob)) {
    links.push(
      link(
        "Carrier thermostats",
        HOMEOWNER_PAGES.carrierThermostats,
        "Homeowner thermostat lineup",
      ),
    );
  }

  // Ductless / mini-split / communicating FAU
  else if (/MIT-SUZ|MIT-SVZ|SVZ-KP|SUZ-KA/i.test(sku + blob)) {
    links.push(
      link(
        "Mitsubishi SVZ air handlers",
        HOMEOWNER_PAGES.mitsuSvz,
        "Communicating FAU indoor",
      ),
      link(
        "Mitsubishi Comfort",
        HOMEOWNER_PAGES.mitsuHome,
        "mitsubishicomfort.com",
      ),
    );
  } else if (/MIT-PUZ|MIT-PVA|PUZ-HA|PVA-A/i.test(sku + blob)) {
    links.push(
      link(
        "Mitsubishi PUZ-HA heat pumps",
        HOMEOWNER_PAGES.mitsuPuzHa,
        "P-Series communicating outdoor",
      ),
    );
  } else if (/MIT-HYPER|hyper-?heat|MIT-MSZ-FS|H2i/i.test(sku + blob)) {
    links.push(
      link(
        "Mitsubishi Electric heat pumps",
        HOMEOWNER_PAGES.mitsuHyperHeat,
        "Homeowner comfort site",
      ),
      link(
        "Mitsubishi Comfort — why ductless",
        HOMEOWNER_PAGES.mitsuHome,
        "mitsubishicomfort.com",
      ),
    );
  } else if (/MIT-MS|MIT-MSZ|MIT-MXZ|mitsubishi|mitsu-ductless/i.test(sku + blob)) {
    links.push(
      link(
        "Mitsubishi Electric ductless products",
        HOMEOWNER_PAGES.mitsuDuctless,
        "Homeowner product browser",
      ),
    );
  } else if (/CAR-MS|carrier.*mini|carrier.*ductless|multi-zone mini/i.test(sku + blob)) {
    links.push(
      link(
        "Carrier ductless mini-splits",
        HOMEOWNER_PAGES.carrierDuctless,
        "Homeowner ductless systems",
      ),
    );
  }

  // Carrier major equipment
  else if (/CAR-HP|heat pump/i.test(sku) || product.equipmentKind === "heat_pump") {
    if (/carrier|car-/i.test(blob + sku)) {
      links.push(
        link(
          "Carrier heat pumps",
          HOMEOWNER_PAGES.carrierHeatPumps,
          "Homeowner heat pump lineup",
        ),
      );
    } else if (/bosch/i.test(blob + sku)) {
      links.push(
        link(
          "Bosch home comfort heat pumps",
          HOMEOWNER_PAGES.boschIds,
          "Homeowner product info",
        ),
      );
    }
  } else if (
    product.equipmentKind === "ac" ||
    /CAR-26|air condition/i.test(sku + blob)
  ) {
    links.push(
      link(
        "Carrier air conditioners",
        HOMEOWNER_PAGES.carrierAc,
        "Homeowner AC lineup",
      ),
    );
  } else if (
    product.equipmentKind === "furnace" ||
    /CAR-58|furnace/i.test(sku + blob)
  ) {
    if (/williams|wall.?heat|forsaire|monterey|wall-wil/i.test(blob + sku)) {
      links.push(
        link(
          "Williams wall & floor furnaces",
          HOMEOWNER_PAGES.williamsWall,
          "Manufacturer product info",
        ),
      );
    } else {
      links.push(
        link(
          "Carrier gas furnaces",
          HOMEOWNER_PAGES.carrierFurnaces,
          "Homeowner furnace lineup",
        ),
      );
    }
  } else if (
    product.equipmentKind === "air_handler" ||
    /CAR-AH|air handler|fan coil/i.test(sku + blob)
  ) {
    links.push(
      link(
        "Carrier fan coils & air handlers",
        HOMEOWNER_PAGES.carrierAirHandlers,
        "Homeowner product overview",
      ),
    );
  }

  // IAQ / water
  else if (/aprilaire|^AA-|air.?clean|media filter/i.test(blob + sku)) {
    links.push(
      link(
        "AprilAire whole-home air purifiers",
        HOMEOWNER_PAGES.aprilaireFilters,
        "Homeowner product guide",
      ),
    );
  } else if (/HUM-HW|honeywell.*humidif|true.?steam|HE240|HE360/i.test(blob + sku)) {
    links.push(
      link(
        "Honeywell Home humidifiers",
        HOMEOWNER_PAGES.honeywellHumidifier,
        "Whole-home humidifiers",
      ),
    );
  } else if (/HRV-HW|ERV-HW|truefresh|VNT5/i.test(blob + sku)) {
    links.push(
      link(
        "Honeywell TrueFRESH HRV / ERV",
        HOMEOWNER_PAGES.honeywellTrueFresh,
        "Whole-house ventilation",
      ),
    );
  } else if (/FAN-PANA|whispergreen|whisperceiling|whispersense|panasonic/i.test(blob + sku)) {
    links.push(
      link(
        "Panasonic bathroom fans",
        HOMEOWNER_PAGES.panasonicFans,
        "WhisperGreen · WhisperCeiling · WhisperSense",
      ),
    );
  } else if (/VENT-GABLE|FAN-BROAN|FAN-NUTONE|broan|nutone/i.test(blob + sku)) {
    links.push(
      link(
        "Broan-NuTone",
        HOMEOWNER_PAGES.broanHome,
        "Bath fans & attic vents",
      ),
    );
  } else if (/humidif/i.test(blob)) {
    links.push(
      link(
        "AprilAire humidifiers",
        HOMEOWNER_PAGES.aprilaireHumidifiers,
        "Homeowner product guide",
      ),
    );
  } else if (/NAV-NAZ|NAZ-17|navien.*heat pump/i.test(blob + sku)) {
    links.push(
      link(
        "Navien NAZ heat pumps",
        HOMEOWNER_PAGES.navienNaz,
        "Inverter air-to-air · R-454B",
      ),
    );
  } else if (/NAV-NAS|NASS|NASV|navien.*air handler/i.test(blob + sku)) {
    links.push(
      link(
        "Navien NAS air handlers",
        HOMEOWNER_PAGES.navienNas,
        "Matched to NAZ",
      ),
    );
  } else if (/NAV-NPF|NPF700|hydro-furnace|hydro furnace/i.test(blob + sku)) {
    links.push(
      link(
        "Navien NPF furnace",
        HOMEOWNER_PAGES.navienNpf,
        "97% AFUE · natural gas",
      ),
    );
  } else if (/NAV-NHB|NAV-NFB|NAV-AH-H2AIR|h2air|navien.*boiler/i.test(blob + sku)) {
    links.push(
      link(
        "Navien condensing furnaces",
        HOMEOWNER_PAGES.navienBoilers,
        "NHB-H / NFB-H residential",
      ),
    );
  } else if (/NWP500|NAV-NWP|nwp500/i.test(blob + sku)) {
    links.push(
      link(
        "Navien heat pump water heaters",
        "https://www.navieninc.com/series/nwp500",
        "NWP500 series — 50 / 65 / 80 gal",
      ),
    );
  } else if (/navien|WTR-NAV|tankless/i.test(blob + sku)) {
    links.push(
      link(
        "Navien tankless water heaters",
        HOMEOWNER_PAGES.navienTankless,
        "Homeowner residential site",
      ),
    );
  } else if (/rinnai|WALL-RIN|energysaver/i.test(blob + sku)) {
    links.push(
      link(
        "Rinnai EnergySaver wall furnaces",
        HOMEOWNER_PAGES.rinnaiWall,
        "Direct-vent heaters (NG)",
      ),
    );
  } else if (/ao.?smith|AOS-/i.test(blob + sku)) {
    links.push(
      link(
        /hpwh|heat pump water/i.test(blob + sku)
          ? "A. O. Smith heat pump water heaters"
          : "A. O. Smith water heaters",
        /hpwh|heat pump water/i.test(blob + sku)
          ? HOMEOWNER_PAGES.aoSmithHpwh
          : HOMEOWNER_PAGES.aoSmithHome,
        "Homeowner product site",
      ),
    );
  } else if (/honeywell|zone-hw|zoning/i.test(blob + sku)) {
    links.push(
      link(
        "Honeywell Home",
        HOMEOWNER_PAGES.honeywellHome,
        "Homeowner controls & comfort",
      ),
    );
  } else if (/williams|wall.?heat|WALL-WIL/i.test(blob + sku)) {
    links.push(
      link(
        "Williams comfort products",
        HOMEOWNER_PAGES.williamsWall,
        "Manufacturer product info",
      ),
    );
  }

  // Soft fallback for major equipment brands with no specific match
  if (!links.length) {
    if (/carrier/i.test(blob + sku)) {
      links.push(
        link(
          "Carrier residential products",
          HOMEOWNER_PAGES.carrierHome,
          "Homeowner site — not a contractor portal",
        ),
      );
    } else if (/mitsubishi/i.test(blob + sku)) {
      links.push(
        link(
          "Mitsubishi Electric Comfort",
          HOMEOWNER_PAGES.mitsuHome,
          "Homeowner site",
        ),
      );
    }
  }

  return links;
}

/** Attach resolved links onto a product (idempotent). */
export function withManufacturerLinks<T extends Product>(p: T): T {
  const links = resolveManufacturerLinks(p);
  if (!links.length) return p;
  return {
    ...p,
    manufacturerLinks: p.manufacturerLinks?.length ? p.manufacturerLinks : links,
    productInfoUrl: p.productInfoUrl || links[0]?.url || null,
  };
}

export function enrichCatalogManufacturerLinks(products: Product[]): Product[] {
  return products.map((p) => withManufacturerLinks(p));
}

export type ProductDocKind = "brochure" | "spec" | "install";

export type ProductDocLink = {
  kind: ProductDocKind;
  label: string;
  url: string;
  note?: string;
};

function kindFromLabel(label: string): ProductDocKind | null {
  const s = label.toLowerCase();
  if (/install|io.?manual|installation/.test(s)) return "install";
  if (/spec|submittal|tech data|engineering|ahri/.test(s)) return "spec";
  if (/brochure|literature|product (page|details)|homeowner/.test(s))
    return "brochure";
  return null;
}

function brandDocHubs(product: Product): {
  brochure?: string;
  spec?: string;
  install?: string;
} {
  const blob =
    `${product.name} ${product.sku} ${product.category} ${product.familyId || ""}`.toLowerCase();
  const sku = (product.sku || "").toUpperCase();
  const hay = `${blob} ${sku}`;

  if (/CAR-HP-.*COM|comfort™ single-stage heat pump|27sca5/i.test(hay)) {
    return {
      brochure: "https://www.shareddocs.com/hvac/docs/1010/Public/08/01-825-113-25.pdf",
      spec: "https://www.shareddocs.com/hvac/docs/1009/Public/02/27SCA5-03PD.pdf",
      install: HOMEOWNER_PAGES.carrierLitSearch,
    };
  }
  if (/CAR-HP-.*INF|infinity® variable-speed heat pump|27vna/i.test(hay)) {
    return {
      brochure: "https://www.shareddocs.com/hvac/docs/1010/Public/06/01-825-131-01.pdf",
      spec: HOMEOWNER_PAGES.carrierLitSearch,
      install: HOMEOWNER_PAGES.carrierLitSearch,
    };
  }
  if (/carrier/i.test(hay) && /heat.?pump|CAR-HP/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.carrierLitSearch,
      spec: HOMEOWNER_PAGES.carrierLitSearch,
      install: HOMEOWNER_PAGES.carrierLitSearch,
    };
  }
  if (/npe-|wtr-nav|tankless/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.navienNpeBrochure,
      spec: HOMEOWNER_PAGES.navienNpeDl,
      install: HOMEOWNER_PAGES.navienNpeInstall,
    };
  }
  if (/naz-|navien.*heat pump/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.navienNazBrochure,
      spec: HOMEOWNER_PAGES.navienNazDl,
      install: HOMEOWNER_PAGES.navienNazInstall,
    };
  }
  if (/nas-|navien.*air handler/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.navienNas,
      spec: HOMEOWNER_PAGES.navienNasDl,
      install: HOMEOWNER_PAGES.navienNasInstall,
    };
  }
  if (/npf-|hydro-furnace/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.navienNpf,
      spec: HOMEOWNER_PAGES.navienNpfDl,
      install: HOMEOWNER_PAGES.navienNpfDl,
    };
  }
  if (/nfb-/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.navienBoilers,
      spec: HOMEOWNER_PAGES.navienNfbDl,
      install: HOMEOWNER_PAGES.navienNfbDl,
    };
  }
  if (/nhb-|h2air|navien.*boiler/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.navienBoilers,
      spec: HOMEOWNER_PAGES.navienNhbDl,
      install: HOMEOWNER_PAGES.navienNhbInstall,
    };
  }

  // Water heaters
  if (/aos-hpwh|wtr-hpwh|voltex|signature 900|hybrid heat pump water/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.aoSmithHpwh,
      spec: HOMEOWNER_PAGES.aoSmithLit,
      install: HOMEOWNER_PAGES.aoSmithLit,
    };
  }
  if (/aos-|ao.?smith|wtr-aos/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.aoSmithHome,
      spec: HOMEOWNER_PAGES.aoSmithLit,
      install: HOMEOWNER_PAGES.aoSmithLit,
    };
  }
  if (/rheem|wtr-rheem/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.rheemTanks,
      spec: HOMEOWNER_PAGES.rheemTanks,
      install: HOMEOWNER_PAGES.rheemTanks,
    };
  }

  // Wall heat
  if (/rinnai|ex11|ex17|ex22|ex38|energysaver/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.rinnaiWall,
      spec: HOMEOWNER_PAGES.rinnaiEx17,
      install: HOMEOWNER_PAGES.rinnaiEx17,
    };
  }
  if (/cozy|wall-coz/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.cozyLine,
      spec: HOMEOWNER_PAGES.cozyLine,
      install: HOMEOWNER_PAGES.cozyLine,
    };
  }
  if (/williams|wall-wil|wall.?heat|forsaire|monterey/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.williamsWall,
      spec: HOMEOWNER_PAGES.williamsWall,
      install: HOMEOWNER_PAGES.williamsWall,
    };
  }

  // Mitsubishi
  if (/mitsubishi|mit-/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.mitsuBrochures,
      spec: HOMEOWNER_PAGES.mitsuLiterature,
      install: HOMEOWNER_PAGES.mitsuSupport,
    };
  }

  // Bosch
  if (/bosch|ids/i.test(hay) && /heat pump|bova|ids/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.boschIds,
      spec: HOMEOWNER_PAGES.boschIdsManuals,
      install: HOMEOWNER_PAGES.boschIdsManuals,
    };
  }

  // Carrier
  if (/carrier|car-/i.test(hay)) {
    if (/heat pump|car-hp/i.test(hay)) {
      return {
        brochure: HOMEOWNER_PAGES.carrierHpComfort,
        spec: HOMEOWNER_PAGES.carrierLitSearch,
        install: HOMEOWNER_PAGES.carrierLitSearch,
      };
    }
    if (/furnace|58s|58t/i.test(hay)) {
      return {
        brochure: HOMEOWNER_PAGES.carrierFurnaces,
        spec: HOMEOWNER_PAGES.carrierLitSearch,
        install: HOMEOWNER_PAGES.carrierLitSearch,
      };
    }
    if (/air handler|fan coil|car-ah/i.test(hay)) {
      return {
        brochure: HOMEOWNER_PAGES.carrierAirHandlers,
        spec: HOMEOWNER_PAGES.carrierLitSearch,
        install: HOMEOWNER_PAGES.carrierLitSearch,
      };
    }
    if (/ductless|mini|car-ms/i.test(hay)) {
      return {
        brochure: HOMEOWNER_PAGES.carrierDuctless,
        spec: HOMEOWNER_PAGES.carrierLitSearch,
        install: HOMEOWNER_PAGES.carrierLitSearch,
      };
    }
    if (/thermostat|infinity system control|ctrl-inf|ctrl-car/i.test(hay)) {
      return {
        brochure: HOMEOWNER_PAGES.carrierThermostats,
        spec: HOMEOWNER_PAGES.carrierLitSearch,
        install: HOMEOWNER_PAGES.carrierLitSearch,
      };
    }
    return {
      brochure: HOMEOWNER_PAGES.carrierHome,
      spec: HOMEOWNER_PAGES.carrierLitSearch,
      install: HOMEOWNER_PAGES.carrierLitSearch,
    };
  }

  // Controls
  if (/nest/i.test(hay)) {
    return {
      brochure: /learning/i.test(hay)
        ? HOMEOWNER_PAGES.nestLearning
        : HOMEOWNER_PAGES.nestThermostat,
      spec: HOMEOWNER_PAGES.nestInstall,
      install: HOMEOWNER_PAGES.nestInstall,
    };
  }
  if (/ecobee/i.test(hay)) {
    return {
      brochure: /premium/i.test(hay)
        ? HOMEOWNER_PAGES.ecobeePremium
        : HOMEOWNER_PAGES.ecobeeEnhanced,
      spec: HOMEOWNER_PAGES.ecobeeSupport,
      install: HOMEOWNER_PAGES.ecobeeSupport,
    };
  }

  // IAQ
  if (/iqair|perfect 16|iq-p16/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.iqairPerfect16,
      spec: HOMEOWNER_PAGES.iqairPerfect16,
      install: HOMEOWNER_PAGES.iqairPerfect16,
    };
  }
  if (/he360|he240|humidif/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.honeywellHe360,
      spec: HOMEOWNER_PAGES.honeywellHe360,
      install: HOMEOWNER_PAGES.honeywellHe360,
    };
  }
  if (/truefresh|hrv|erv/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.honeywellTrueFresh,
      spec: HOMEOWNER_PAGES.honeywellTrueFresh,
      install: HOMEOWNER_PAGES.honeywellTrueFresh,
    };
  }
  if (/aprilaire/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.aprilaireFilters,
      spec: HOMEOWNER_PAGES.aprilaireHome,
      install: HOMEOWNER_PAGES.aprilaireHome,
    };
  }
  if (/broan|nutone/i.test(hay)) {
    return {
      brochure: HOMEOWNER_PAGES.broanHome,
      spec: HOMEOWNER_PAGES.broanHome,
      install: HOMEOWNER_PAGES.broanHome,
    };
  }

  return {};
}

/**
 * Always try to give Brochure / Spec / Install.
 * Prefers product.manufacturerLinks and productInfoUrl, then series page,
 * then the brand literature/support hub (downloads live there).
 */
export function resolveProductDocs(product: Product): ProductDocLink[] {
  const resolved = resolveManufacturerLinks(product);
  const hubs = brandDocHubs(product);
  const byKind: Partial<Record<ProductDocKind, ProductDocLink>> = {};

  for (const l of product.manufacturerLinks || []) {
    const k = kindFromLabel(l.label);
    if (k && l.url && !byKind[k]) {
      byKind[k] = { kind: k, label: l.label, url: l.url, note: l.note };
    }
  }
  for (const l of resolved) {
    const k = kindFromLabel(l.label) || "brochure";
    if (l.url && !byKind[k]) {
      byKind[k] = { kind: k, label: l.label, url: l.url, note: l.note };
    }
  }

  const primary =
    product.productInfoUrl || resolved[0]?.url || hubs.brochure || "";

  const fill = (
    kind: ProductDocKind,
    label: string,
    url?: string,
    note?: string,
  ) => {
    if (byKind[kind] || !url) return;
    byKind[kind] = { kind, label, url, note };
  };

  fill("brochure", "Brochure / product page", primary || hubs.brochure);
  fill(
    "spec",
    "Spec / literature",
    hubs.spec || primary,
    "Opens the manufacturer literature page — pick this model’s PDF",
  );
  fill(
    "install",
    "Install manual",
    hubs.install || hubs.spec || primary,
    "Opens manufacturer support / install docs",
  );

  const order: ProductDocKind[] = ["brochure", "spec", "install"];
  return order.map((k) => byKind[k]).filter(Boolean) as ProductDocLink[];
}
