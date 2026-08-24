/**
 * Live walk pin — the exact question on screen, so Flag / Notes
 * and the next Build turn open the same page Mike is looking at.
 */
import { fieldIdbGet, fieldIdbSet } from "./field-idb";
import {
  draftHasWork,
  saveWizardDraft,
  WIZARD_DRAFT_KEY,
  type WizardDraft,
} from "./wizard-draft";

export const WALK_NOTE_PATH = "/__acme/walk-note";
const WALK_PIN_LOCAL_KEY = "acme_walk_pin_v1";

type PinInst = {
  id?: string;
  familyId?: string | null;
  advisorReopen?: string | null;
  wallVentStyle?: string | null;
  jobPath?: string | null;
  whJobType?: string | null;
  selectedBrands?: string[] | null;
  selectedCapacities?: number[] | null;
  productId?: string | null;
  equipmentConfirmed?: boolean | null;
  workShots?: { dataUrl?: string }[];
};

type PinDraft = {
  version?: number;
  stepIdx?: number;
  proposalId?: string | null;
  updatedAt?: string;
  testMode?: boolean;
  answers?: {
    focusMeasureId?: string | null;
    measureInstances?: PinInst[];
    [k: string]: unknown;
  };
};

export type WalkPin = {
  at: string;
  path: string;
  hash: string;
  prompt: string;
  ticket: string;
  familyId: string | null;
  reopen: string | null;
  wallVentStyle: string | null;
  jobPath: string | null;
  brands: string[];
  sizes: number[];
  productId: string | null;
  equipmentConfirmed: boolean;
  note: string;
  draft: PinDraft | null;
};

function readDraft(): PinDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(WIZARD_DRAFT_KEY) ||
      localStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PinDraft;
  } catch {
    return null;
  }
}

function slimDraft(draft: PinDraft | null): PinDraft | null {
  if (!draft?.answers) return draft;
  try {
    return {
      ...draft,
      answers: {
        ...draft.answers,
        measureInstances: (draft.answers.measureInstances || []).map((m) => ({
          ...m,
          workShots: (m.workShots || []).map((s) => ({
            ...s,
            dataUrl: s.dataUrl && s.dataUrl.length > 800 ? "" : s.dataUrl,
          })),
        })),
      },
    };
  } catch {
    return draft;
  }
}

export function captureWalkPin(partial?: {
  prompt?: string;
  ticket?: string;
  inst?: PinInst | null;
  note?: string;
}): WalkPin {
  const promptFromDom =
    typeof document !== "undefined"
      ? (document.querySelector("[data-qa=live-prompt]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  const ticketFromDom =
    typeof document !== "undefined"
      ? (document.querySelector("[data-qa=walk-ticket]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  const draft = slimDraft(readDraft());
  const focusId = draft?.answers?.focusMeasureId;
  const inst =
    partial?.inst ||
    draft?.answers?.measureInstances?.find((m) => m.id === focusId) ||
    draft?.answers?.measureInstances?.[0] ||
    null;
  const path =
    typeof window !== "undefined" ? window.location.pathname || "/wizard" : "/wizard";
  const hash =
    typeof window !== "undefined" ? window.location.hash || "" : "";
  return {
    at: new Date().toISOString(),
    path,
    hash,
    prompt: (partial?.prompt || promptFromDom || "").trim(),
    ticket: (partial?.ticket || ticketFromDom || "").trim(),
    familyId: inst?.familyId || null,
    reopen: inst?.advisorReopen || null,
    wallVentStyle: inst?.wallVentStyle || null,
    jobPath: inst?.jobPath || inst?.whJobType || null,
    brands: [...(inst?.selectedBrands || [])],
    sizes: [...(inst?.selectedCapacities || [])],
    productId: inst?.productId || null,
    equipmentConfirmed: Boolean(inst?.equipmentConfirmed),
    note: (partial?.note || "").trim(),
    draft,
  };
}

export function formatWalkPinLine(pin: WalkPin): string {
  const bits = [
    pin.prompt || "page",
    pin.familyId,
    pin.reopen,
    pin.wallVentStyle,
    pin.jobPath,
    pin.brands.join("+"),
    pin.sizes.length ? pin.sizes.join(",") : "",
  ].filter(Boolean);
  return bits.join(" · ");
}

let lastPosted = "";
let postTimer: ReturnType<typeof setTimeout> | null = null;

export function postWalkPin(pin: WalkPin, immediate = false): void {
  if (typeof window === "undefined") return;
  const key = [
    pin.prompt,
    pin.familyId,
    pin.reopen,
    pin.productId,
    pin.note,
  ].join("|");
  const send = () => {
    lastPosted = key;
    try {
      const raw = JSON.stringify(pin);
      localStorage.setItem(WALK_PIN_LOCAL_KEY, raw);
      fieldIdbSet(WALK_PIN_LOCAL_KEY, raw);
    } catch {
      /* quota */
    }
    fetch(WALK_NOTE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pin),
      keepalive: true,
    }).catch(() => {});
  };
  if (immediate) {
    if (postTimer) clearTimeout(postTimer);
    send();
    return;
  }
  if (key === lastPosted) return;
  if (postTimer) clearTimeout(postTimer);
  postTimer = setTimeout(send, 280);
}

export function stampWalkHash(familyId: string | undefined, prompt: string): void {
  if (typeof window === "undefined") return;
  const slug = `${familyId || "ask"}/${encodeURIComponent(prompt).slice(0, 56)}`;
  const next = `#${slug}`;
  if (window.location.hash === next) return;
  try {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${next}`,
    );
  } catch {
    /* ignore */
  }
}

export function applyWalkPinDraft(pin: WalkPin): boolean {
  if (typeof window === "undefined") return false;
  if (!pin.draft?.answers) return false;
  const draft: WizardDraft = {
    version: 1,
    answers: pin.draft.answers as WizardDraft["answers"],
    stepIdx: Math.max(0, Number(pin.draft.stepIdx) || 0),
    proposalId: pin.draft.proposalId ?? null,
    updatedAt: pin.draft.updatedAt || pin.at,
    testMode: pin.draft.testMode,
  };
  if (!draftHasWork(draft.answers)) return false;
  saveWizardDraft(draft);
  return true;
}

export async function fetchLatestWalkPin(): Promise<WalkPin | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch(WALK_NOTE_PATH, { cache: "no-store" });
    if (r.status === 200) {
      const text = await r.text();
      if (text.trim()) {
        const pin = JSON.parse(text) as WalkPin;
        if (pin && typeof pin === "object" && pin.draft) return pin;
      }
    }
  } catch {
    /* live site has no walk-note server — use the phone copy */
  }
  try {
    const raw =
      localStorage.getItem(WALK_PIN_LOCAL_KEY) ||
      (await fieldIdbGet(WALK_PIN_LOCAL_KEY));
    if (!raw) return null;
    const pin = JSON.parse(raw) as WalkPin;
    if (!pin || typeof pin !== "object") return null;
    return pin;
  } catch {
    return null;
  }
}

/** Empty local draft → last Flag / walk pin. `force` overwrites local. */
export async function hydrateFromWalkPin(opts?: {
  force?: boolean;
}): Promise<WalkPin | null> {
  if (typeof window === "undefined") return null;
  if (!opts?.force) {
    const local = readDraft();
    if (local?.answers && draftHasWork(local.answers as WizardDraft["answers"])) {
      return null;
    }
  }
  const pin = await fetchLatestWalkPin();
  if (!pin) return null;
  if (!applyWalkPinDraft(pin)) return null;
  return pin;
}
