/**
 * Manager / creator access for the product backend.
 *
 * Advisors sell quotes. Managers & creators open Backend.
 * Session unlock uses a PIN. Default / recovery PIN is always "owner".
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useOwnerSettings } from "./owner-settings";

export type StaffRole = "advisor" | "manager" | "creator";

/** Always works for this sales tool demo so owners never get locked out. */
export const BACKEND_DEMO_PIN = "owner";

export type BackendTabId =
  | "home"
  | "products"
  | "measures"
  | "families"
  | "pairing"
  | "ladders"
  | "questions"
  | "job-goals"
  | "financials"
  | "financing"
  | "rebates"
  | "terms"
  | "audits"
  | "team"
  | "closing"
  | "company";

export const BACKEND_TABS: {
  id: BackendTabId;
  label: string;
  blurb: string;
  /** Placeholder tabs are visible but not fully built */
  status: "live" | "soon";
}[] = [
  {
    id: "home",
    label: "Home",
    blurb: "Everything you can change without calling Build",
    status: "live",
  },
  {
    id: "company",
    label: "Company",
    blurb: "Name, phone, license, logo",
    status: "live",
  },
  {
    id: "job-goals",
    label: "Job packages",
    blurb: "Buttons on Job builder — rename, reorder, add your own",
    status: "live",
  },
  {
    id: "products",
    label: "Products",
    blurb: "Catalog SKUs, benefits, work scope, hours, dollars",
    status: "live",
  },
  {
    id: "families",
    label: "Measure chips",
    blurb: "Show or hide chips and rename them for the sales tool",
    status: "live",
  },
  {
    id: "pairing",
    label: "Pairing",
    blurb: "Match a heat pump outdoor to its air handler. Same brand, same tons.",
    status: "live",
  },
  {
    id: "ladders",
    label: "Packages",
    blurb: "Same-box upgrades AND different-install paths the customer must pick",
    status: "live",
  },
  {
    id: "questions",
    label: "Questions",
    blurb: "Numbered work-list lines the customer sees, plus advisor questions",
    status: "live",
  },
  {
    id: "measures",
    label: "Language",
    blurb: "The words on the customer packet — opening, close, pad copy",
    status: "live",
  },
  {
    id: "financials",
    label: "Labor & markup",
    blurb: "Hourly rate, material markup, labor divisor, man-day profit",
    status: "live",
  },
  {
    id: "financing",
    label: "Financing",
    blurb: "Programs shown at signing",
    status: "live",
  },
  {
    id: "rebates",
    label: "Rebates",
    blurb: "Incentives — add, change, turn off",
    status: "live",
  },
  {
    id: "terms",
    label: "Terms",
    blurb: "Contract language and notices",
    status: "live",
  },
  {
    id: "closing",
    label: "Present / close",
    blurb: "Client Present view, financing apply link, later comparison",
    status: "live",
  },
  {
    id: "audits",
    label: "Audits",
    blurb: "What the advisor changed on a quote",
    status: "live",
  },
  {
    id: "team",
    label: "Team",
    blurb: "Who can open Backend and the PIN",
    status: "live",
  },
];

type ManagerAccessState = {
  /**
   * Session unlock for Backend (not persisted — re-lock on reload).
   * Also mirrored via owner-settings.unlocked for divisor editing.
   */
  backendUnlocked: boolean;
  /** PIN shared by managers/creators (persisted). Default: owner */
  pin: string;
  /** Emails (lowercase) that always count as creators when signed in */
  creatorEmails: string[];
  /** Emails that count as managers when signed in */
  managerEmails: string[];
  unlock: (pin: string) => boolean;
  /** One-tap demo access — no typing required */
  unlockDemo: () => void;
  /** Reset stored PIN back to demo default and unlock */
  resetPinAndUnlock: () => void;
  lock: () => void;
  setPin: (pin: string) => void;
  setCreatorEmails: (emails: string[]) => void;
  setManagerEmails: (emails: string[]) => void;
  addCreatorEmail: (email: string) => void;
  addManagerEmail: (email: string) => void;
  removeCreatorEmail: (email: string) => void;
  removeManagerEmail: (email: string) => void;
};

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

function parseEmailList(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const e = normalizeEmail(r);
    if (!e || !e.includes("@") || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

function mirrorOwnerUnlock(pin: string) {
  try {
    const os = useOwnerSettings.getState();
    // Force owner store to the same PIN so divisors stay editable
    if (os.pin !== pin) os.setPin(pin);
    os.unlock(pin);
  } catch {
    /* ignore */
  }
}

function pinAccepted(attempt: string, stored: string): boolean {
  const a = attempt.trim();
  if (!a) return false;
  // Case-insensitive so "Owner" / "OWNER" still work
  const al = a.toLowerCase();
  if (al === stored.trim().toLowerCase()) return true;
  // Recovery master always works so owners never get locked out of their tool
  if (al === BACKEND_DEMO_PIN) return true;
  try {
    const ownerPin = useOwnerSettings.getState().pin?.trim().toLowerCase();
    if (ownerPin && al === ownerPin) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export const useManagerAccess = create<ManagerAccessState>()(
  persist(
    (set, get) => ({
      backendUnlocked: false,
      pin: BACKEND_DEMO_PIN,
      creatorEmails: [],
      managerEmails: [],
      unlock: (attempt) => {
        if (!pinAccepted(attempt, get().pin)) return false;
        set({ backendUnlocked: true });
        // If they used the recovery PIN, normalize stored PIN so next time is easy
        const used = attempt.trim().toLowerCase();
        if (used === BACKEND_DEMO_PIN && get().pin !== BACKEND_DEMO_PIN) {
          set({ pin: BACKEND_DEMO_PIN });
        }
        mirrorOwnerUnlock(get().pin === BACKEND_DEMO_PIN ? BACKEND_DEMO_PIN : attempt.trim());
        return true;
      },
      unlockDemo: () => {
        set({ backendUnlocked: true, pin: BACKEND_DEMO_PIN });
        mirrorOwnerUnlock(BACKEND_DEMO_PIN);
      },
      resetPinAndUnlock: () => {
        set({ pin: BACKEND_DEMO_PIN, backendUnlocked: true });
        mirrorOwnerUnlock(BACKEND_DEMO_PIN);
      },
      lock: () => {
        set({ backendUnlocked: false });
        try {
          useOwnerSettings.getState().lock();
        } catch {
          /* ignore */
        }
      },
      setPin: (pin) => {
        const next = pin.trim() || BACKEND_DEMO_PIN;
        set({ pin: next });
        try {
          useOwnerSettings.getState().setPin(next);
        } catch {
          /* ignore */
        }
      },
      setCreatorEmails: (emails) =>
        set({ creatorEmails: parseEmailList(emails) }),
      setManagerEmails: (emails) =>
        set({ managerEmails: parseEmailList(emails) }),
      addCreatorEmail: (email) => {
        const e = normalizeEmail(email);
        if (!e) return;
        const list = get().creatorEmails;
        if (list.includes(e)) return;
        set({ creatorEmails: [...list, e] });
      },
      addManagerEmail: (email) => {
        const e = normalizeEmail(email);
        if (!e) return;
        const list = get().managerEmails;
        if (list.includes(e)) return;
        set({ managerEmails: [...list, e] });
      },
      removeCreatorEmail: (email) =>
        set({
          creatorEmails: get().creatorEmails.filter(
            (e) => e !== normalizeEmail(email),
          ),
        }),
      removeManagerEmail: (email) =>
        set({
          managerEmails: get().managerEmails.filter(
            (e) => e !== normalizeEmail(email),
          ),
        }),
    }),
    {
      name: "aarvaks-manager-access-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        pin: s.pin,
        creatorEmails: s.creatorEmails,
        managerEmails: s.managerEmails,
      }),
    },
  ),
);

/** Resolve role from signed-in email + session unlock. */
export function resolveStaffRole(input: {
  email?: string | null;
  backendUnlocked: boolean;
  creatorEmails: string[];
  managerEmails: string[];
}): StaffRole {
  const email = normalizeEmail(input.email || "");
  if (email && input.creatorEmails.includes(email)) return "creator";
  if (email && input.managerEmails.includes(email)) return "manager";
  if (input.backendUnlocked) return "manager";
  return "advisor";
}

export function canAccessBackend(role: StaffRole): boolean {
  return role === "manager" || role === "creator";
}

export function canAlterBackend(role: StaffRole): boolean {
  return role === "manager" || role === "creator";
}
