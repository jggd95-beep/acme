/**
 * Durable in-progress quote for the sales wizard.
 * Survives reloads, remounts, accidental navigation, and product catalog rehydration.
 */
import type { WizardAnswers } from "./quote-wizard";
import { fieldIdbGet, fieldIdbRemove, fieldIdbSet } from "./field-idb";

export const WIZARD_DRAFT_KEY = "acme_wizard_live_draft_v2_field";

export type WizardDraft = {
  version: 1;
  answers: WizardAnswers;
  stepIdx: number;
  /** Live proposal id once a draft proposal row exists */
  proposalId: string | null;
  updatedAt: string;
  /** If true, user explicitly started a test run */
  testMode?: boolean;
};

export function loadWizardDraft(): WizardDraft | null {
  try {
    const raw =
      sessionStorage.getItem(WIZARD_DRAFT_KEY) ||
      localStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardDraft;
    if (!parsed || parsed.version !== 1 || !parsed.answers) return null;
    if (!draftHasWork(parsed.answers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Phone reopen: localStorage first, then IndexedDB if Safari wiped LS. */
export async function loadWizardDraftDurable(): Promise<WizardDraft | null> {
  const local = loadWizardDraft();
  if (local) return local;
  try {
    const raw = await fieldIdbGet(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardDraft;
    if (!parsed || parsed.version !== 1 || !parsed.answers) return null;
    if (!draftHasWork(parsed.answers)) return null;
    try {
      sessionStorage.setItem(WIZARD_DRAFT_KEY, raw);
      localStorage.setItem(WIZARD_DRAFT_KEY, raw);
    } catch {
      /* quota — IDB still holds it */
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveWizardDraft(draft: WizardDraft): void {
  try {
    if (!draftHasWork(draft.answers)) {
      // Never erase a richer in-progress job with an empty customer shell.
      const existing = (() => {
        try {
          const raw =
            sessionStorage.getItem(WIZARD_DRAFT_KEY) ||
            localStorage.getItem(WIZARD_DRAFT_KEY);
          if (!raw) return null;
          return JSON.parse(raw) as WizardDraft;
        } catch {
          return null;
        }
      })();
      if (existing?.answers && draftHasWork(existing.answers)) return;
      return;
    }
    const payload = JSON.stringify({
      ...draft,
      version: 1 as const,
      updatedAt: new Date().toISOString(),
    });
    try {
      sessionStorage.setItem(WIZARD_DRAFT_KEY, payload);
      localStorage.setItem(WIZARD_DRAFT_KEY, payload);
    } catch {
      const slim = JSON.stringify({
        ...draft,
        version: 1 as const,
        updatedAt: new Date().toISOString(),
        answers: slimAnswersForStorage(draft.answers),
      });
      sessionStorage.setItem(WIZARD_DRAFT_KEY, slim);
      localStorage.setItem(WIZARD_DRAFT_KEY, slim);
    }
    fieldIdbSet(WIZARD_DRAFT_KEY, payload);
  } catch {
    /* quota / private mode */
  }
}

function slimAnswersForStorage(answers: WizardAnswers): WizardAnswers {
  return {
    ...answers,
    measureInstances: (answers.measureInstances || []).map((m) => ({
      ...m,
      workShots: (m.workShots || []).map((s) => ({
        ...s,
        dataUrl: s.dataUrl && s.dataUrl.length > 4000 ? "" : s.dataUrl,
      })),
    })),
  };
}

export const FRESH_TOKEN_KEY = "acme_wizard_force_fresh";

export function clearWizardDraft(): void {
  try {
    sessionStorage.removeItem(WIZARD_DRAFT_KEY);
    localStorage.removeItem(WIZARD_DRAFT_KEY);
    sessionStorage.removeItem("acme_wizard_live_draft_v1");
    localStorage.removeItem("acme_wizard_live_draft_v1");
    sessionStorage.removeItem("aarvaks_wizard_draft");
    localStorage.removeItem("aarvaks_wizard_draft");
    fieldIdbRemove(WIZARD_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** New quote: park is done; this stamp is the only job the next mount may start. */
export function beginFreshQuote(stamp: string): void {
  try {
    sessionStorage.setItem(FRESH_TOKEN_KEY, stamp);
  } catch {
    /* ignore */
  }
  clearWizardDraft();
}

export function consumeFreshQuote(): boolean {
  try {
    const v = sessionStorage.getItem(FRESH_TOKEN_KEY);
    if (!v) return false;
    sessionStorage.removeItem(FRESH_TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isFreshQuotePending(): boolean {
  try {
    return Boolean(sessionStorage.getItem(FRESH_TOKEN_KEY));
  } catch {
    return false;
  }
}

/** Reject session junk like "HDs-gbo320" as a customer name */
export function looksLikeCustomerLabel(raw: string | null | undefined): boolean {
  const t = (raw || "").trim();
  if (t.length < 2) return false;
  if (t.length > 80) return false;
  if (/^[A-Za-z0-9]{1,4}[-_][A-Za-z0-9]{3,}$/.test(t) && !/\s/.test(t)) {
    return false;
  }
  if (/^[A-Z]{2,}[a-z]?[-_][a-z0-9]{4,}$/.test(t)) return false;
  if ((t.match(/[A-Za-z]/g) || []).length < 2) return false;
  return true;
}

export function draftCustomerLabel(answers: WizardAnswers | null | undefined): string {
  if (!answers) return "In-progress quote";
  const contact = (answers.clientContact || "").trim();
  const company = (answers.clientCompany || "").trim();
  const street = (answers.propertyStreet || "").trim();
  if (looksLikeCustomerLabel(contact)) return contact;
  if (looksLikeCustomerLabel(company)) return company;
  if (street.length >= 4) return street;
  const city = (answers.propertyCity || "").trim();
  if (city) return `Job in ${city}`;
  if ((answers.measureInstances || []).some((m) => m.productId || m.familyId)) {
    return "In-progress quote";
  }
  return "In-progress quote";
}

export function draftHasWork(answers: WizardAnswers | null | undefined): boolean {
  if (!answers) return false;
  if (looksLikeCustomerLabel(answers.clientCompany)) return true;
  if (looksLikeCustomerLabel(answers.clientContact)) return true;
  if ((answers.clientEmail || "").trim().includes("@")) return true;
  if ((answers.clientPhone || "").replace(/\D/g, "").length >= 7) return true;
  if ((answers.propertyStreet || "").trim().length >= 4) return true;
  if ((answers.measureInstances || []).some((m) => m.productId)) return true;
  if (
    (answers.measureInstances || []).some(
      (m) => m.scopeAnswers && Object.keys(m.scopeAnswers).length > 0,
    )
  )
    return true;
  if ((answers.selectedMeasureFamilies || []).length > 0) return true;
  if ((answers.goals || []).length > 0) return true;
  if (Object.keys(answers.optionSelections || {}).length > 0) return true;
  if (Object.keys(answers.measureAdjustments || {}).length > 0) return true;
  return false;
}

export function draftStepLabel(stepIdx: number | null | undefined): string {
  const n = Math.max(0, Number(stepIdx) || 0) + 1;
  return `Step ${n}`;
}

/** V1, V2… from answers.quoteVersion (defaults to 1). */
export function draftVersionLabel(
  answers: WizardAnswers | null | undefined,
): string {
  const n = Math.max(1, Math.floor(Number(answers?.quoteVersion) || 1));
  return `V${n}`;
}

/**
 * One-line home card: Name · V1 · City
 */
export function draftHomeHeadline(
  answers: WizardAnswers | null | undefined,
): string {
  const name = draftCustomerLabel(answers);
  const ver = draftVersionLabel(answers);
  const city = (answers?.propertyCity || "").trim();
  return city ? `${name} · ${ver} · ${city}` : `${name} · ${ver}`;
}

/** List title so two Maria Rivera tests are not identical. */
export function liveQuoteTitle(
  answers: WizardAnswers | null | undefined,
): string {
  const name = draftCustomerLabel(answers);
  const fams = [
    ...new Set([
      ...((answers?.selectedMeasureFamilies || []) as string[]),
      ...((answers?.measureInstances || []).map((m) => m.familyId) as string[]),
    ]),
  ].filter((id) => id && id !== "permits" && id !== "install");
  const hint = fams
    .slice(0, 3)
    .map((id) => id.replace(/_/g, " "))
    .join(" + ");
  const n = answers?.measureInstances?.length || 0;
  const bits = [name];
  if (hint) bits.push(hint);
  if (n) bits.push(`${n} on job`);
  return bits.join(" · ");
}
