/**
 * “Size for this home” helper — layman household → gallon / tankless class chips.
 * Ported from session UX into MASTER.
 */

export type WhHomeSizingAnswers = {
  bathrooms: number;
  showers: number;
  hasTub: boolean;
  people: number;
  inlet: "cold" | "average" | "warm";
  completedAt?: string;
};

export const DEFAULT_WH_HOME_SIZING: WhHomeSizingAnswers = {
  bathrooms: 2,
  showers: 2,
  hasTub: false,
  people: 3,
  inlet: "average",
};

export function blankWhHomeSizing(): WhHomeSizingAnswers {
  return { ...DEFAULT_WH_HOME_SIZING, completedAt: undefined };
}

/** Storage / hybrid → gallon chips */
export function suggestGallons(answers: WhHomeSizingAnswers): number[] {
  const { bathrooms, people, hasTub } = answers;
  let gal = 40;
  if (people >= 5 || bathrooms >= 3) gal = 80;
  else if (people >= 4 || bathrooms >= 3) gal = 75;
  else if (people >= 3 || bathrooms >= 2) gal = 50;
  else gal = 40;

  if (hasTub && gal < 50) gal = 50;
  if (hasTub && people >= 4 && gal < 65) gal = 65;

  if (people === 3 && bathrooms === 2 && !hasTub) return [50, 65];
  if (people >= 4 && bathrooms >= 2 && gal >= 65) return [65, 80];
  if (gal >= 75) return [65, 80];
  if (gal >= 50) return [50, 65];
  return [40, 50];
}

/**
 * Tankless “manufacturer class” style (150 / 180 / 210 / 240).
 * Returns class numbers for chip keys — mapped to gallon-filter loosely via GPM.
 */
export function suggestTanklessClasses(answers: WhHomeSizingAnswers): number[] {
  const { bathrooms, showers, hasTub, inlet } = answers;
  let score = bathrooms + showers * 0.75 + (hasTub ? 1 : 0);
  if (inlet === "cold") score += 0.75;
  if (inlet === "warm") score -= 0.35;

  // Map demand → Navien-style class
  let primary = 150;
  if (score >= 5.5) primary = 240;
  else if (score >= 4) primary = 210;
  else if (score >= 2.5) primary = 180;
  else primary = 150;

  const ladder = [150, 180, 210, 240];
  const idx = ladder.indexOf(primary);
  const out = [primary];
  if (idx < ladder.length - 1 && score > idx + 1.8) out.push(ladder[idx + 1]);
  if (idx > 0 && score < idx + 0.6) out.unshift(ladder[idx - 1]);
  return [...new Set(out)];
}

/** Map tankless class → approximate filter capacity (gallons field reused loosely) */
export function tanklessClassToFilterValue(cls: number): number {
  // Encode class as pseudo-gallon for chip multi-select reuse: 150→15, 180→18…
  return Math.round(cls / 10);
}

export function filterValueToTanklessClass(n: number): number | null {
  if (n >= 14 && n <= 25) return n * 10;
  if ([150, 180, 210, 240].includes(n)) return n;
  return null;
}
