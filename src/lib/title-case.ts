/**
 * Consistent measure / product title casing for customer packets.
 * Applied whenever titles are set, saved, or written to the catalog.
 */

const SMALL = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
  "via",
  "with",
  "without",
]);

/** Known HVAC / brand tokens to keep uppercase or special-cased */
const SPECIAL: Record<string, string> = {
  hvac: "HVAC",
  seer: "SEER",
  seer2: "SEER2",
  hspf: "HSPF",
  hspf2: "HSPF2",
  afue: "AFUE",
  eer: "EER",
  btuh: "BTUH",
  btu: "BTU",
  ton: "Ton",
  tons: "Tons",
  ac: "AC",
  hp: "HP",
  ah: "AH",
  iaq: "IAQ",
  merv: "MERV",
  pvc: "PVC",
  ng: "NG",
  lp: "LP",
  aka: "AKA",
  vs: "vs",
  "mini-split": "Mini-Split",
  minisplit: "Mini-Split",
  "heat-pump": "Heat-Pump",
  ecobee: "ecobee",
  nest: "Nest",
  carrier: "Carrier",
  mitsubishi: "Mitsubishi",
  bosch: "Bosch",
  aprilaire: "AprilAire",
  honeywell: "Honeywell",
  williams: "Williams",
  navien: "Navien",
  infinity: "Infinity",
  performance: "Performance",
  comfort: "Comfort",
  acme: "Acme",
};

function tokenize(raw: string): string[] {
  // Keep hyphenated and slash units together as words
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function titleWord(word: string, index: number, total: number): string {
  if (!word) return word;

  // Preserve pure numbers / sizes like 3-ton, 2½, 17.5"
  if (/^[\d¼½¾./\-"+x×]+$/i.test(word)) return word;
  if (/^\d/.test(word) && /ton/i.test(word)) {
    return word.replace(/ton(s)?$/i, (_, s) => (s ? "Tons" : "Ton"));
  }

  const lower = word.toLowerCase();
  if (SPECIAL[lower]) return SPECIAL[lower];

  // Multi-part with hyphen
  if (word.includes("-") && word.length > 1) {
    return word
      .split("-")
      .map((part, i) => titleWord(part, i === 0 ? index : 1, total))
      .join("-");
  }

  const isEdge = index === 0 || index === total - 1;
  if (!isEdge && SMALL.has(lower)) {
    return lower;
  }
  // First/last small words still capitalize
  if (isEdge && SMALL.has(lower)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  // Preserve real acronyms (e.g. HVAC, SEER) — not normal words typed in caps
  if (
    word.length >= 2 &&
    word.length <= 5 &&
    word === word.toUpperCase() &&
    /[A-Z]/.test(word) &&
    !SMALL.has(lower) &&
    // no lowercase vowels as full word → likely acronym; skip common english words
    !/^(THE|AND|FOR|WITH|FROM|INTO|THAT|THIS|YOUR|HOME|UNIT|ONLY|PLUS)$/i.test(
      word,
    )
  ) {
    // If it has a vowel and is a common English word length, title-case it
    if (/[AEIOU]/.test(word) && word.length >= 4 && !SPECIAL[lower]) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return word;
  }

  // Standard title case (also normalizes ALL CAPS sentences)
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Title-case a measure / product name for the packet and catalog.
 * Empty / whitespace-only returns "".
 */
export function formatMeasureTitle(input: string | null | undefined): string {
  if (input == null) return "";
  const raw = String(input).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const words = tokenize(raw);
  return words.map((w, i) => titleWord(w, i, words.length)).join(" ");
}

/** Apply title case only when the string has content; otherwise keep as-is. */
export function formatMeasureTitleOrEmpty(
  input: string | null | undefined,
): string {
  const t = formatMeasureTitle(input);
  return t;
}
