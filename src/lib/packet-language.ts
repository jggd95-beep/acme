/**
 * Customer-packet language rules.
 *
 * Advisor screens can say CFM, 1-to-1, SKU, joist. The packet cannot.
 * Every update runs these rules against compiled What-we-do, benefits,
 * names, blurbs, package cards, and option titles.
 *
 * MAJOR PACKET SPINE — every equipment measure, before it is shown:
 *  1. Stamp first: Acme HVAC will install a new [noun] to meet manufacturer
 *     and local code requirements, with Acme’s stamp of quality.
 *  2. Then: Install a new [product face name]. Never a bare model sitting
 *     there with no verb. Same on every major.
 *  3. Combine like work into one sentence. All cut-ins together. Feet +
 *     material together. Both hoods / penetrations together.
 *  4. Aim for 6–10 numbered lines, not a grocery list.
 *  5. Close with: Check, test, adjust, and start the new [noun]. Confirm
 *     proper operation. Clean / haul only when we actually demo equipment.
 *  6. Benefits: size first. What it does. Sold material (KD, etc.) next.
 *     Warranty is always last — nothing after it.
 *  7. Stamp of quality is numbered line 1. Product is line 2. Same voice
 *     as the rest of the contract — not a second writer.
 *  8. Never print work that was not selected. Mixed wire names only
 *     the zones that get new cable.
 *  9. Benefits are not a reprint of the work scope. They are why this
 *     option is the one to pick.
 * 10. No shop talk on the packet: run, cable pull, on this job,
 *     walk the home, sealed at the takeoff.
 */
export const MAJOR_PACKET_SPINE = [
  "stamp-first",
  "product-face",
  "combine-like-work",
  "six-to-ten-lines",
  "check-test-adjust-close",
  "benefits-tight",
  "one-voice",
] as const;
export type PacketHit = {
  rule: string;
  match: string;
  where: string;
  snippet: string;
};

export type PacketRule = {
  id: string;
  re: RegExp;
  /** Why this fails — printed on the gate. */
  why: string;
};

export const PACKET_RULES: PacketRule[] = [
  {
    id: "furnish",
    re: /furnish and install|furnish and implement/i,
    why: "Never say furnish and install. Acme HVAC will install…",
  },
  {
    id: "wrong-company",
    re: /acme rvac/i,
    why: "Company name is only Acme HVAC.",
  },
  {
    id: "sku-word",
    re: /\bSKU\b/,
    why: "SKU is shop. Customers never see a SKU.",
  },
  {
    id: "advisor-voice",
    re: /comfort advisor confirmed|comfort advisor must/i,
    why: "Advisor notes stay off the packet.",
  },
  {
    id: "see-option",
    re: /see the option on this measure/i,
    why: "Say the option is priced on this proposal.",
  },
  {
    id: "ampacity",
    re: /\bampacity\b/i,
    why: "Say the circuit is sized and protected.",
  },
  {
    id: "required-cfm",
    re: /required CFM/i,
    why: "Say the airflow this equipment needs.",
  },
  {
    id: "boot-s",
    re: /boot\(s\)/i,
    why: "Spell boots or boot. No (s) on the packet.",
  },
  {
    id: "awkward-plural",
    re: /\b(?:run|head|grille|joist)\(s\)/i,
    why: "Spell the plural. No (s) on the packet.",
  },
  {
    id: "damper-s",
    re: /damper\(s\)/i,
    why: "Spell dampers or damper. No (s) on the packet.",
  },
  {
    id: "pick-a-flow",
    re: /Pick-A-Flow/i,
    why: "Shop name. Say the airflow we set for this bathroom.",
  },
  {
    id: "shop-sku",
    re: /\bCAR-(?:HP|AH|AC)-[A-Z0-9-]+\b/,
    why: "Shop SKU stays off the packet. Series name and chassis model stay.",
  },
  {
    id: "one-to-one",
    re: /\b1-to-1\b/,
    why: "Shop size class. Use 12,000 BTU / one indoor.",
  },
  {
    id: "weigh-in",
    re: /weigh in charge/i,
    why: "Say evacuate the lines and charge the system.",
  },
  {
    id: "static-ui",
    re: /static-pressure|Infinity UI/i,
    why: "Shop commissioning. Say it in home language.",
  },
  {
    id: "pac-mka",
    re: /PAC-MKA/i,
    why: "Say distribution box.",
  },
  {
    id: "mxz",
    re: /\bMXZ(?:-SM|-C|-class)?\b/i,
    why: "Model family stays off the packet.",
  },
  {
    id: "registration",
    re: /registr(?:y|ation)?\s+required|must register|register(?:ed|ation) required|extend.{0,24}warrant/i,
    why: "CA warranties never require registration.",
  },
  {
    id: "sku-code",
    re: /\b(?:SVC|CAR|MIT|BOS|FUR|WTR|AOS|ZONE|FAN|ELEC|CTRL|NAV|STAT|AA)-\s?[A-Z0-9-]{2,}\b/,
    why: "Catalog codes stay off the packet.",
  },
  {
    id: "kd-shop",
    re: /\b26-gauge\b|\bKD steel\b/i,
    why: "Say fire-rated steel duct with a jacket.",
  },
  {
    id: "mini-split-shop",
    re: /k Mini-Split|Mini-Split \(\d|Mini-Split Outdoor/i,
    why: "Say ductless heat pump.",
  },
  {
    id: "ton-class",
    re: /~\s*\d+(?:\.\d+)?\s*ton class/i,
    why: "Ton class is shop sizing.",
  },
  {
    id: "wiring-diagrams",
    re: /wiring diagrams/i,
    why: "Manufacturer diagrams stay off the packet.",
  },
  {
    id: "shop-model",
    re: /\b[A-Z]{2,3}-\d{2}[A-Z]{2,}\d?\b/,
    why: "Looks like a model number.",
  },
  {
    id: "named-below",
    re: /equipment named below|implement the equipment/i,
    why: "Old lead. Use Acme HVAC will install a new…",
  },
  {
    id: "on-this-job",
    re: /\bon this job\b/i,
    why: "Shop voice. Say the house, the equipment, or drop it.",
  },
  {
    id: "walk-the-home",
    re: /walk the home/i,
    why: "Does not tell the client what we are doing.",
  },
  {
    id: "as-sold",
    re: /install location \(as sold\)/i,
    why: "Placement stays on the job card, not the packet.",
  },
  {
    id: "npe-model",
    re: /\bNPE-\d{3}[A-Z]\d\b/i,
    why: "Navien model codes stay off the packet. Say condensing tankless water heater.",
  },
  {
    id: "aarvaks",
    re: /aarvaks/i,
    why: "Company name is only Acme HVAC.",
  },
  {
    id: "mxz-face",
    re: /Mitsubishi MXZ/i,
    why: "Say Mitsubishi multi-zone. MXZ is a model family.",
  },
];

function snippetAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + len + 40);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function scanPacketCopy(text: string, where: string): PacketHit[] {
  const src = String(text || "");
  if (!src.trim()) return [];
  const hits: PacketHit[] = [];
  for (const rule of PACKET_RULES) {
    rule.re.lastIndex = 0;
    const m = rule.re.exec(src);
    if (!m || m.index == null) continue;
    hits.push({
      rule: rule.id,
      match: m[0],
      where,
      snippet: snippetAround(src, m.index, m[0].length),
    });
  }
  return hits;
}

export function scanPacketFields(
  fields: Record<string, string | string[] | null | undefined>,
  prefix: string,
): PacketHit[] {
  const hits: PacketHit[] = [];
  for (const [key, val] of Object.entries(fields)) {
    if (val == null) continue;
    const parts = Array.isArray(val) ? val : [val];
    parts.forEach((part, i) => {
      const label = parts.length > 1 ? `${prefix}.${key}[${i}]` : `${prefix}.${key}`;
      hits.push(...scanPacketCopy(String(part), label));
    });
  }
  return hits;
}

/** Self-check: the scanner must still catch the leaks we already burned on. */
export function packetLanguageSelfTest(): string[] {
  const fails: string[] = [];
  const expectHit = (sample: string, rule: string) => {
    const hits = scanPacketCopy(sample, "self");
    if (!hits.some((h) => h.rule === rule)) {
      fails.push(`self-test missed ${rule} in: ${sample}`);
    }
  };
  const expectClean = (sample: string) => {
    const hits = scanPacketCopy(sample, "self");
    if (hits.length) {
      fails.push(`self-test false hit ${hits[0].rule} in: ${sample}`);
    }
  };
  expectHit("Furnish and install a wall controller", "furnish");
  expectHit("Comfort advisor confirmed the throw", "advisor-voice");
  expectHit("Verify ampacity and protection", "ampacity");
  expectHit("required CFM for this equipment", "required-cfm");
  expectHit("4 new register boot(s)", "boot-s");
  expectHit("Install new motorized damper(s) for each zone", "damper-s");
  expectHit("Set Pick-A-Flow CFM for this bath", "pick-a-flow");
  expectHit("Mitsubishi 12k Mini-Split (1-to-1)", "one-to-one");
  expectHit("Set the PAC-MKA box", "pac-mka");
  expectHit("Registration required to keep the warranty", "registration");
  expectHit("SKU CAR-MS-INF-12 on the card", "sku-word");
  expectHit("Acme RVAC will install", "wrong-company");
  expectHit("See the option on this measure", "see-option");
  expectHit("Evacuate, weigh in charge per the manufacturer", "weigh-in");
  expectHit("Carrier Comfort™ 16 Air Conditioner 26SCA5", "series-code");
  expectHit("Walk the home and note damper locations", "walk-the-home");
  expectHit("Pad included on this job", "on-this-job");
  expectHit("WHAT AARVAKS SETS UP", "aarvaks");
  expectHit("Install a new Navien NPE-180S2 Tankless Water Heater", "npe-model");
  expectHit("Mitsubishi MXZ multi-zone ductless", "mxz-face");
  expectClean("Mitsubishi MUZ-FS12NA (12,000 BTU)");
  expectClean("Carrier Performance™ 38MARB (12,000 BTU)");
  expectClean("Carrier Infinity® 37MAHA (12,000 BTU)");
  expectClean("Carrier Comfort™ 16 Heat Pump (3 ton)");
  expectClean(
    "Acme HVAC will install a new ductless system to meet manufacturer and local code requirements, with Acme’s stamp of quality.",
  );
  expectClean("Install new motorized dampers for each zone. Seal all new connections.");
  expectClean(
    "Connect the new unit to the existing 240-volt circuit and confirm it is sized and protected for this equipment.",
  );
  expectClean("Cut in 4 new register boots and install new grilles.");
  expectClean(
    "Acme does not warranty existing infrastructure — path, copper, insulation, or interconnect wiring. Warranty covers new equipment and the work performed this visit.",
  );
  expectClean("Set up the handheld remote and Wi-Fi on the indoor you can see. Show you heat, cool, and the app.");
  expectClean("Set the fan to 80 CFM for this bathroom.");
  return fails;
}
