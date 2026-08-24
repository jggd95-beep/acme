import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Sales-floor privacy: hide labor hours, labor $, and materials $
 * when a customer is looking over the advisor's shoulder.
 * Sell price always stays visible.
 */
type PrivacyState = {
  hideInternalCosts: boolean;
  setHideInternalCosts: (v: boolean) => void;
  toggle: () => void;
};

export const useSalesPrivacy = create<PrivacyState>()(
  persist(
    (set, get) => ({
      hideInternalCosts: false,
      setHideInternalCosts: (v) => set({ hideInternalCosts: v }),
      toggle: () => set({ hideInternalCosts: !get().hideInternalCosts }),
    }),
    {
      name: "axme-sales-privacy-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ hideInternalCosts: s.hideInternalCosts }),
    },
  ),
);
