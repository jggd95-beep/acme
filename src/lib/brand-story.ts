/**
 * Acme HVAC homeowner-facing story — used on the customer packet
 * to build trust and contrast against low-bid / one-call competitors.
 */
import { COMPANY } from "./company";

export const BRAND_STORY = {
  headline: "East Bay comfort, built the right way since 1929",
  subhead:
    "Nearly a century in Berkeley. Neighbors first. Clear scope. Real warranties. No mystery invoices.",
  sinceLine: `Family-rooted heating & air for the ${COMPANY.serviceArea} since ${COMPANY.since}`,
  promise:
    "This proposal is written so you can see exactly what we install, why it helps your home, and what it costs — before you sign. No bait-and-switch line items. No disappearing after install day.",

  pillars: [
    {
      title: "Almost 100 years here",
      body: `We've served East Bay homes from ${COMPANY.addressLine1} since ${COMPANY.since}. We're not a pop-up crew that vanishes when the job gets hard.`,
    },
    {
      title: "Scope you can read",
      body: "Every measure lists benefits and work steps side by side. Optional upgrades stay optional until you check them — and your total updates live when you sign.",
    },
    {
      title: "Right-sized, not oversold",
      body: "Load-aware design and matched equipment so you're not paying for tonnage you don't need — or suffering with a system that's too small.",
    },
    {
      title: "Warranty that means something",
      body: "Manufacturer parts coverage (e.g. Carrier 10-year) plus Acme HVAC labor protection on the work we stand behind.",
    },
  ],

  differentiators: [
    {
      them: "Low bid, vague “install included”",
      us: "Itemized measures with work scope you can follow",
    },
    {
      them: "Pressure to decide same day",
      us: "Clear options you control at e-sign — no surprise add-ons",
    },
    {
      them: "Unknown subcontractors",
      us: "Acme HVAC team, local address, CSLB on every page",
    },
    {
      them: "Gone after final payment",
      us: "Labor warranty path + service relationship that lasts",
    },
  ],

  process: [
    {
      step: "1",
      title: "Review this plan",
      body: "Read benefits, work scope, and options for your home.",
    },
    {
      step: "2",
      title: "Choose what fits",
      body: "Check only the upgrades you want. Totals update live.",
    },
    {
      step: "3",
      title: "Sign with confidence",
      body: "E-sign locks scope, price path, and warranty terms.",
    },
    {
      step: "4",
      title: "We install & stand behind it",
      body: "Permits, commissioning, walkthrough, and warranty support.",
    },
  ],

  signCloser: {
    title: "Why homeowners sign with Acme HVAC",
    body: "You're not buying a box off a truck — you're choosing a local contractor who writes the work down, prices the options honestly, and still answers the phone after the install. That is the difference between a receipt and a relationship.",
    cta: "When you're ready, check the options you want and sign. We'll take care of the rest.",
  },

  trustChips: [
    `Est. ${COMPANY.since}`,
    `${COMPANY.serviceArea} locals`,
    `CSLB ${COMPANY.contractorLicense}`,
    COMPANY.phone,
    COMPANY.websiteLabel,
  ],
} as const;

export function defaultExecutiveSummary(clientFirstName?: string): string {
  const who = clientFirstName?.trim() || "your family";
  return (
    `Thank you for inviting ${COMPANY.shortName} into your home. This plan is written for ${who} — not a generic template. ` +
    `Below you'll find each measure with real benefits, a clear work scope, and optional upgrades you control. ` +
    BRAND_STORY.promise +
    ` We've been the East Bay's neighbors since ${COMPANY.since}; our job is to make your comfort investment feel obvious, fair, and lasting.`
  );
}
