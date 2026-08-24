import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { COMPANY as FACTORY } from "./company";

export type CompanyFields = {
  name: string;
  shortName: string;
  phone: string;
  email: string;
  website: string;
  contractorLicense: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  logoUrl: string;
};

function fromFactory(): CompanyFields {
  return {
    name: FACTORY.name,
    shortName: FACTORY.shortName,
    phone: FACTORY.phone,
    email: FACTORY.email,
    website: FACTORY.website,
    contractorLicense: FACTORY.contractorLicense,
    tagline: FACTORY.tagline,
    addressLine1: FACTORY.addressLine1,
    addressLine2: FACTORY.addressLine2,
    logoUrl: FACTORY.logoUrl,
  };
}

type State = {
  fields: CompanyFields;
  setField: <K extends keyof CompanyFields>(k: K, v: CompanyFields[K]) => void;
  reset: () => void;
};

export const useCompanyStore = create<State>()(
  persist(
    (set) => ({
      fields: fromFactory(),
      setField: (k, v) =>
        set((s) => ({ fields: { ...s.fields, [k]: v } })),
      reset: () => set({ fields: fromFactory() }),
    }),
    {
      name: "acme-company-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function liveCompany(): CompanyFields {
  try {
    return useCompanyStore.getState().fields;
  } catch {
    return fromFactory();
  }
}
