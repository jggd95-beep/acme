/**
 * Backend-editable Terms & Conditions + California notices.
 * Proposals and PDFs always read live values from this store (not hardcoded UI).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { COMPANY } from "./company";

export type CaNoticeKey =
  | "filledInCopy"
  | "downPayment"
  | "progressPayments"
  | "cslb"
  | "cancel3"
  | "cancel5Senior"
  | "mechanicsLien"
  | "cgl"
  | "permits"
  | "electronic"
  | "notLegalAdvice";

export type CaNoticeDef = {
  key: CaNoticeKey;
  /** Short label on the packet */
  label: string;
  /** Body text. Supports {{companyName}} {{license}} {{phone}} */
  text: string;
  /** Statutory notices that must print larger / bold */
  statutory: boolean;
};

export type TermsConfig = {
  /** Commercial terms shown on every new proposal */
  commercialTerms: string;
  /** Intro under Signatures */
  signatureIntro: string;
  /** Intro under California notices heading */
  caSectionTitle: string;
  caSectionIntro: string;
  /** Ordered CA notice blocks */
  caNotices: CaNoticeDef[];
  updatedAt: string;
};

const now = () => new Date().toISOString();

export const FACTORY_CA_NOTICES: CaNoticeDef[] = [
  {
    key: "filledInCopy",
    label: "Filled-in copy",
    text: "You are entitled to a completely filled-in copy of this agreement, signed by both you and the contractor, before any work may be started.",
    statutory: true,
  },
  {
    key: "downPayment",
    label: "Down payment",
    text: "The down payment may not exceed $1,000 or 10 percent of the contract price, whichever is less, for home improvement contracts subject to B&P §7159.",
    statutory: true,
  },
  {
    key: "progressPayments",
    label: "Progress payments",
    text: "Progress payments may not be required that exceed the value of work performed and materials delivered at the time payment is due.",
    statutory: true,
  },
  {
    key: "cslb",
    label: "CSLB",
    text: "{{companyName}} is licensed by the Contractors State License Board (CSLB). License {{license}}.{{phoneClause}} Verify at www.cslb.ca.gov.",
    statutory: false,
  },
  {
    key: "cancel3",
    label: "3-day cancel",
    text: "You may cancel this transaction without penalty within three business days if signed away from our place of business (Civil Code notice applies).",
    statutory: true,
  },
  {
    key: "cancel5Senior",
    label: "5-day senior cancel",
    text: "If you are age 65 or older, a five-business-day cancellation right may apply to certain home improvement contracts.",
    statutory: true,
  },
  {
    key: "mechanicsLien",
    label: "Mechanics lien",
    text: "Anyone who helps improve your property but is not paid may record a mechanic's lien. Protect yourself by getting unconditional lien releases as you pay.",
    statutory: false,
  },
  {
    key: "cgl",
    label: "Insurance",
    text: "{{companyName}} maintains commercial general liability insurance and workers' compensation as required. Certificates available on request.",
    statutory: false,
  },
  {
    key: "permits",
    label: "Permits",
    text: "Unless otherwise stated, permits required for this work will be obtained by the contractor before work begins.",
    statutory: false,
  },
  {
    key: "electronic",
    label: "E-sign",
    text: "Electronic signatures and records have the same legal effect as paper under applicable e-sign laws when you consent to electronic delivery.",
    statutory: false,
  },
  {
    key: "notLegalAdvice",
    label: "Disclaimer",
    text: "These notices summarize common California home-improvement requirements and are not legal advice. Ask your advisor or counsel for your situation.",
    statutory: false,
  },
];

export const FACTORY_TERMS: TermsConfig = {
  commercialTerms:
    "Payment due per agreed schedule. Equipment remains property of contractor until paid in full. Manufacturer warranties apply as published. In California, registration is not required to receive the warranty. Work is performed to manufacturer specifications and applicable California code. Change orders must be approved in writing. This proposal is valid for 30 days unless otherwise noted.",
  signatureIntro:
    "Contractor signature is applied when this proposal is created. The homeowner signs electronically to accept the checked options and investment total.",
  caSectionTitle: "California notices (B&P Code §7159)",
  caSectionIntro:
    "Required home-improvement contract disclosures. Statutory notices use bold type at required size.",
  caNotices: FACTORY_CA_NOTICES.map((n) => ({ ...n })),
  updatedAt: now(),
};

export function applyTermsPlaceholders(
  text: string,
  opts?: {
    companyName?: string;
    license?: string;
    contractorLicense?: string;
    companyPhone?: string;
  },
): string {
  const companyName = opts?.companyName || COMPANY.name;
  const license = opts?.contractorLicense || opts?.license || "C-20";
  const phone = (opts?.companyPhone || COMPANY.phone || "").trim();
  const phoneClause = phone ? ` Phone: ${phone}.` : "";
  return text
    .replace(/\{\{companyName\}\}/g, companyName)
    .replace(/\{\{license\}\}/g, license)
    .replace(/\{\{phone\}\}/g, phone)
    .replace(/\{\{phoneClause\}\}/g, phoneClause);
}

export type ResolvedCaNotices = Record<CaNoticeKey, string> & {
  /** Ordered rows for packet rendering */
  rows: { key: CaNoticeKey; label: string; text: string; statutory: boolean }[];
  sectionTitle: string;
  sectionIntro: string;
  signatureIntro: string;
  commercialTerms: string;
};

export function resolveTermsForPacket(opts?: {
  companyName?: string;
  license?: string;
  contractorLicense?: string;
  companyPhone?: string;
}): ResolvedCaNotices {
  const cfg = useTermsStore.getState().config;
  const rows = (cfg.caNotices || FACTORY_CA_NOTICES).map((n) => ({
    key: n.key,
    label: n.label,
    text: applyTermsPlaceholders(n.text, opts),
    statutory: n.statutory,
  }));
  const byKey = {} as Record<CaNoticeKey, string>;
  for (const r of rows) byKey[r.key] = r.text;
  // Ensure every key exists even if removed in UI
  for (const f of FACTORY_CA_NOTICES) {
    if (!byKey[f.key]) {
      byKey[f.key] = applyTermsPlaceholders(f.text, opts);
    }
  }
  return {
    ...byKey,
    rows,
    sectionTitle: cfg.caSectionTitle || FACTORY_TERMS.caSectionTitle,
    sectionIntro: cfg.caSectionIntro || FACTORY_TERMS.caSectionIntro,
    signatureIntro: cfg.signatureIntro || FACTORY_TERMS.signatureIntro,
    commercialTerms: cfg.commercialTerms || FACTORY_TERMS.commercialTerms,
  };
}

/** Default commercial terms for new proposals */
export function getDefaultCommercialTerms(): string {
  return (
    useTermsStore.getState().config.commercialTerms ||
    FACTORY_TERMS.commercialTerms
  );
}

type TermsState = {
  config: TermsConfig;
  updateConfig: (patch: Partial<TermsConfig>) => void;
  updateCaNotice: (
    key: CaNoticeKey,
    patch: Partial<Pick<CaNoticeDef, "label" | "text" | "statutory">>,
  ) => void;
  reorderCaNotice: (key: CaNoticeKey, dir: "up" | "down") => void;
  resetAll: () => void;
  resetCaNotices: () => void;
};

function cloneFactory(): TermsConfig {
  return JSON.parse(JSON.stringify(FACTORY_TERMS));
}

export const useTermsStore = create<TermsState>()(
  persist(
    (set, get) => ({
      config: cloneFactory(),

      updateConfig: (patch) => {
        set({
          config: {
            ...get().config,
            ...patch,
            updatedAt: now(),
          },
        });
      },

      updateCaNotice: (key, patch) => {
        const notices = get().config.caNotices.map((n) =>
          n.key === key ? { ...n, ...patch } : n,
        );
        set({
          config: {
            ...get().config,
            caNotices: notices,
            updatedAt: now(),
          },
        });
      },

      reorderCaNotice: (key, dir) => {
        const list = [...get().config.caNotices];
        const i = list.findIndex((n) => n.key === key);
        if (i < 0) return;
        const j = dir === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        set({
          config: { ...get().config, caNotices: list, updatedAt: now() },
        });
      },

      resetAll: () => set({ config: cloneFactory() }),

      resetCaNotices: () =>
        set({
          config: {
            ...get().config,
            caNotices: FACTORY_CA_NOTICES.map((n) => ({ ...n })),
            updatedAt: now(),
          },
        }),
    }),
    {
      name: "aarvaks-terms-config-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ config: s.config }),
      merge: (persisted, current) => {
        const p = persisted as { config?: Partial<TermsConfig> } | undefined;
        const base = cloneFactory();
        if (!p?.config) return { ...current, config: base };
        const merged: TermsConfig = {
          ...base,
          ...p.config,
          caNotices:
            p.config.caNotices && p.config.caNotices.length
              ? p.config.caNotices.map((n) => ({
                  ...FACTORY_CA_NOTICES.find((f) => f.key === n.key),
                  ...n,
                }))
              : base.caNotices,
        };
        return { ...current, config: merged };
      },
    },
  ),
);
