/**
 * Closing / present settings — Backend-editable.
 * Live now: present view on/off, headline, financing apply URL.
 * Stubs reserved so later features don't need a new store.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ClosingSettingsState = {
  /** Show Present on On this job / Review */
  presentEnabled: boolean;
  /** Client headline under company name. Empty = company tagline. */
  presentHeadline: string;
  /** Opens in a new tab from Present (GreenSky / lender later). */
  financingApplyUrl: string;
  financingApplyLabel: string;
  /** Hide labor hours on the client Present view */
  presentHideHours: boolean;
  /** Future — comparison pick-one at signing */
  comparisonEnabled: boolean;
  /** Future — membership / Comfort Club offer on Present */
  membershipEnabled: boolean;
  membershipLabel: string;
  setPresentEnabled: (v: boolean) => void;
  setPresentHeadline: (v: string) => void;
  setFinancingApplyUrl: (v: string) => void;
  setFinancingApplyLabel: (v: string) => void;
  setPresentHideHours: (v: boolean) => void;
  setComparisonEnabled: (v: boolean) => void;
  setMembershipEnabled: (v: boolean) => void;
  setMembershipLabel: (v: string) => void;
};

export const useClosingSettings = create<ClosingSettingsState>()(
  persist(
    (set) => ({
      presentEnabled: true,
      presentHeadline: "",
      financingApplyUrl: "",
      financingApplyLabel: "See financing options",
      presentHideHours: true,
      comparisonEnabled: false,
      membershipEnabled: false,
      membershipLabel: "Comfort Club",
      setPresentEnabled: (presentEnabled) => set({ presentEnabled }),
      setPresentHeadline: (presentHeadline) => set({ presentHeadline }),
      setFinancingApplyUrl: (financingApplyUrl) => set({ financingApplyUrl }),
      setFinancingApplyLabel: (financingApplyLabel) =>
        set({ financingApplyLabel }),
      setPresentHideHours: (presentHideHours) => set({ presentHideHours }),
      setComparisonEnabled: (comparisonEnabled) => set({ comparisonEnabled }),
      setMembershipEnabled: (membershipEnabled) => set({ membershipEnabled }),
      setMembershipLabel: (membershipLabel) => set({ membershipLabel }),
    }),
    {
      name: "acme-closing-settings-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
