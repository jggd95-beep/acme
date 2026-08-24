/** Seller brand — Acme HVAC */
export const COMPANY = {
  name: "Acme HVAC Heating and Air Conditioning",
  shortName: "Acme HVAC",
  legalName: "Acme HVAC Heating and Air Conditioning",
  tagline: "Serving the East Bay since 1929",
  addressLine1: "731 Dwight Way",
  addressLine2: "Berkeley, California",
  city: "Berkeley",
  state: "CA",
  zip: "",
  serviceArea: "East Bay",
  since: "1929",
  email: "quotes@acmehvac.com",
  phone: "(510) 848-5010",
  website: "https://acmehvac.com",
  websiteLabel: "acmehvac.com",
  logoUrl: "/acme-rvacs-logo.svg",
  appName: "Acme HVAC Quotes",
  currency: "USD",
  defaultTaxRate: 10.25,
  contractorLicense: "C-20",
} as const;

export function companyAddressBlock(): string {
  return `${COMPANY.addressLine1}, ${COMPANY.addressLine2}`;
}
