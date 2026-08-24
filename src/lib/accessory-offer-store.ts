import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AccessoryOfferState = {
  /** id → show Offer. Missing = use the accessory default. */
  offerFlags: Record<string, boolean>;
  setOfferFlag: (id: string, canOffer: boolean) => void;
  resetOfferFlags: () => void;
};

export const useAccessoryOfferStore = create<AccessoryOfferState>()(
  persist(
    (set) => ({
      offerFlags: {},
      setOfferFlag: (id, canOffer) =>
        set((s) => ({ offerFlags: { ...s.offerFlags, [id]: canOffer } })),
      resetOfferFlags: () => set({ offerFlags: {} }),
    }),
    {
      name: "acme-accessory-offer-flags",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function resolveCanOffer(
  id: string,
  defaultCanOffer: boolean | undefined,
  includeOnly?: boolean,
): boolean {
  if (includeOnly) return false;
  const over = useAccessoryOfferStore.getState().offerFlags[id];
  if (typeof over === "boolean") return over;
  return Boolean(defaultCanOffer);
}