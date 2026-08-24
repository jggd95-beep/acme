/**
 * Pair two short site questions on one screen when they fit a phone.
 * Big cards (run, pictures, long lists) stay alone.
 */
import type { ScopeQuestion } from "./scope-wizard";

export function isCompactSiteQuestion(q: ScopeQuestion | undefined): boolean {
  if (!q) return false;
  if (q.type !== "single" && q.type !== "boolean") return false;
  if ((q.options || []).some((o) => o.art)) return false;
  if (q.info) return false;
  const n = q.type === "boolean" ? 2 : (q.options || []).length;
  if (n < 2 || n > 4) return false;
  return true;
}

/** Two compact questions whose options still fit one phone screen. */
export function canPackSiteQuestions(
  a: ScopeQuestion | undefined,
  b: ScopeQuestion | undefined,
): boolean {
  if (!isCompactSiteQuestion(a) || !isCompactSiteQuestion(b)) return false;
  const n1 = a!.type === "boolean" ? 2 : (a!.options || []).length;
  const n2 = b!.type === "boolean" ? 2 : (b!.options || []).length;
  return n1 + n2 <= 6;
}
