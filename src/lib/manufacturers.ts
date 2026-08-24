/** Brand mark colors + wordmark paths for manufacturer chips */

export interface ManufacturerMeta {
  id: string;
  /** Display name */
  name: string;
  /** 1–3 letter monogram */
  mark: string;
  /** Background for logo badge */
  bg: string;
  /** Foreground on badge */
  fg: string;
  /** Wordmark in /public/brands */
  logo?: string;
}

const META: Record<string, ManufacturerMeta> = {
  Carrier: {
    id: "carrier",
    name: "Carrier",
    mark: "C",
    bg: "#0B3D91",
    fg: "#FFFFFF",
    logo: "/brands/carrier.svg",
  },
  Bryant: {
    id: "bryant",
    name: "Bryant",
    mark: "Br",
    bg: "#003DA5",
    fg: "#FFFFFF",
    logo: "/brands/bryant.svg",
  },
  Trane: {
    id: "trane",
    name: "Trane",
    mark: "T",
    bg: "#C8102E",
    fg: "#FFFFFF",
    logo: "/brands/trane.svg",
  },
  Daikin: {
    id: "daikin",
    name: "Daikin",
    mark: "D",
    bg: "#00A0E3",
    fg: "#FFFFFF",
    logo: "/brands/daikin.svg",
  },
  Mitsubishi: {
    id: "mitsubishi",
    name: "Mitsubishi",
    mark: "M",
    bg: "#E60012",
    fg: "#FFFFFF",
    logo: "/brands/mitsubishi.svg",
  },
  Rheem: {
    id: "rheem",
    name: "Rheem",
    mark: "R",
    bg: "#E31837",
    fg: "#FFFFFF",
    logo: "/brands/rheem.svg",
  },
  Goodman: {
    id: "goodman",
    name: "Goodman",
    mark: "G",
    bg: "#003366",
    fg: "#FFFFFF",
    logo: "/brands/goodman.svg",
  },
  Bosch: {
    id: "bosch",
    name: "Bosch",
    mark: "B",
    bg: "#E20015",
    fg: "#FFFFFF",
    logo: "/brands/bosch.svg",
  },
  Lennox: {
    id: "lennox",
    name: "Lennox",
    mark: "L",
    bg: "#00205B",
    fg: "#FFFFFF",
    logo: "/brands/lennox.svg",
  },
  "American Standard": {
    id: "amstd",
    name: "American Standard",
    mark: "AS",
    bg: "#003366",
    fg: "#FFFFFF",
    logo: "/brands/amstd.svg",
  },
  Williams: {
    id: "williams",
    name: "Williams",
    mark: "W",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/williams.svg",
  },
  Cozy: {
    id: "cozy",
    name: "Cozy",
    mark: "Cz",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/cozy.svg",
  },
  "AO Smith": {
    id: "aosmith",
    name: "A. O. Smith",
    mark: "AO",
    bg: "#C41230",
    fg: "#FFFFFF",
    logo: "/brands/aosmith.svg",
  },
  "A.O. Smith": {
    id: "aosmith",
    name: "A. O. Smith",
    mark: "AO",
    bg: "#C41230",
    fg: "#FFFFFF",
    logo: "/brands/aosmith.svg",
  },
  "A. O. Smith": {
    id: "aosmith",
    name: "A. O. Smith",
    mark: "AO",
    bg: "#C41230",
    fg: "#FFFFFF",
    logo: "/brands/aosmith.svg",
  },
  "Bradford White": {
    id: "bw",
    name: "Bradford White",
    mark: "BW",
    bg: "#003366",
    fg: "#FFFFFF",
    logo: "/brands/bw.svg",
  },
  Rinnai: {
    id: "rinnai",
    name: "Rinnai",
    mark: "Ri",
    bg: "#C8102E",
    fg: "#FFFFFF",
    logo: "/brands/rinnai.svg",
  },
  Navien: {
    id: "navien",
    name: "Navien",
    mark: "Na",
    bg: "#0033A0",
    fg: "#FFFFFF",
    logo: "/brands/navien.svg",
  },
  Noritz: {
    id: "noritz",
    name: "Noritz",
    mark: "No",
    bg: "#0055A5",
    fg: "#FFFFFF",
    logo: "/brands/noritz.svg",
  },
  Eemax: {
    id: "eemax",
    name: "Eemax",
    mark: "Ee",
    bg: "#E65C00",
    fg: "#FFFFFF",
    logo: "/brands/eemax.svg",
  },
  "Stiebel Eltron": {
    id: "stiebel",
    name: "Stiebel Eltron",
    mark: "SE",
    bg: "#C41230",
    fg: "#FFFFFF",
    logo: "/brands/stiebel.svg",
  },
  Stiebel: {
    id: "stiebel",
    name: "Stiebel Eltron",
    mark: "SE",
    bg: "#C41230",
    fg: "#FFFFFF",
    logo: "/brands/stiebel.svg",
  },
  State: {
    id: "state",
    name: "State",
    mark: "ST",
    bg: "#1B4F72",
    fg: "#FFFFFF",
    logo: "/brands/state.svg",
  },
  GE: {
    id: "ge",
    name: "GE",
    mark: "GE",
    bg: "#3B73B9",
    fg: "#FFFFFF",
    logo: "/brands/ge.svg",
  },
  Honeywell: {
    id: "honeywell",
    name: "Honeywell",
    mark: "H",
    bg: "#CF0A2C",
    fg: "#FFFFFF",
    logo: "/brands/honeywell.svg",
  },
  Panasonic: {
    id: "panasonic",
    name: "Panasonic",
    mark: "Pa",
    bg: "#003DA5",
    fg: "#FFFFFF",
    logo: "/brands/panasonic.svg",
  },
  Broan: {
    id: "broan",
    name: "Broan",
    mark: "Br",
    bg: "#C8102E",
    fg: "#FFFFFF",
    logo: "/brands/broan.svg",
  },
  NuTone: {
    id: "nutone",
    name: "NuTone",
    mark: "Nu",
    bg: "#C8102E",
    fg: "#FFFFFF",
    logo: "/brands/nutone.svg",
  },
  Werner: {
    id: "werner",
    name: "Werner",
    mark: "We",
    bg: "#F5C518",
    fg: "#1A1A1A",
    logo: "/brands/werner.svg",
  },
  ChargePoint: {
    id: "chargepoint",
    name: "ChargePoint",
    mark: "CP",
    bg: "#2F7D32",
    fg: "#FFFFFF",
    logo: "/brands/chargepoint.svg",
  },
  Northridge: {
    id: "northridge",
    name: "Northridge",
    mark: "NQ",
    bg: "#1B4F72",
    fg: "#FFFFFF",
    logo: "/brands/northridge.svg",
  },
  Sanden: {
    id: "sanden",
    name: "Sanden",
    mark: "Sa",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/sanden.svg",
  },
  IQAir: {
    id: "iqair",
    name: "IQAir",
    mark: "IQ",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/iqair.svg",
  },
  ecobee: {
    id: "ecobee",
    name: "ecobee",
    mark: "eb",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/ecobee.svg",
  },
  Ecobee: {
    id: "ecobee",
    name: "ecobee",
    mark: "eb",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/ecobee.svg",
  },
  Nest: {
    id: "nest",
    name: "Nest",
    mark: "N",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/nest.svg",
  },
  Google: {
    id: "nest",
    name: "Nest",
    mark: "N",
    bg: "#111111",
    fg: "#FFFFFF",
    logo: "/brands/nest.svg",
  },
  AprilAire: {
    id: "aprilaire",
    name: "AprilAire",
    mark: "AA",
    bg: "#007A3D",
    fg: "#FFFFFF",
    logo: "/brands/aprilaire.svg",
  },
  "Field kit": {
    id: "field",
    name: "Field kit",
    mark: "FK",
    bg: "#6B7280",
    fg: "#FFFFFF",
  },
};

export function manufacturerMeta(brand: string): ManufacturerMeta {
  if (META[brand]) return META[brand];
  const hit = Object.keys(META).find(
    (k) => k.toLowerCase() === brand.toLowerCase(),
  );
  if (hit) return META[hit];
  const mark = brand
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    id: brand.toLowerCase().replace(/\s+/g, "-"),
    name: brand,
    mark: mark || "?",
    bg: "#374151",
    fg: "#FFFFFF",
  };
}