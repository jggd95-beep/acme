/**
 * ENERGY STAR marking for advisor product cards + benefits.
 * Explicit product.energyStar wins. Inference is conservative class-level
 * (not an AHRI lookup) — owner can override in Backend.
 */
import type { Product } from "./proposal-types";
import { isLockableEquipment } from "./locked-benefits";

export const ENERGY_STAR_BENEFIT = "ENERGY STAR® certified";

export function inferEnergyStar(p: Product): boolean {
  const blob = [
    p.name,
    p.sku,
    p.category,
    p.description,
    p.tierLabel,
    (p.benefits || []).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  // Explicit non-qualifiers
  if (
    /gravity|atmospheric|draft hood|80% afue|80 afue|proline atmospheric/.test(
      blob,
    ) &&
    !/hpwh|hybrid|npe-|heat pump/.test(blob)
  ) {
    return false;
  }
  if (/wall heater|wall furnace|williams|cozy/.test(blob) && !/energysaver|rinnai/.test(blob)) {
    return false;
  }
  if (/electric storage|electric water heater/.test(blob) && !/hpwh|hybrid|heat pump/.test(blob)) {
    return false;
  }
  if (/uln|ultra-low nox/.test(blob) && /tank/.test(blob) && !/hpwh|hybrid/.test(blob)) {
    return false;
  }

  // Strong yes
  if (/hpwh|voltex|signature 900|hybrid heat pump water/.test(blob)) return true;
  if (/npe-1|npe-2|npe-150|npe-180|npe-210|npe-240/.test(blob)) return true;
  if (/naz-|navien.*heat pump/.test(blob)) return true;
  if (/mitsubishi|msz-|mux-|svz-|suz-|puz-|pva-/.test(blob)) return true;
  if (/bosch ids|bosch.*heat pump/.test(blob)) return true;
  if (/infinity|greenspeed|25vna|24vna/.test(blob)) return true;
  if (/performance™|performance heat pump|25tpa|25hpa/.test(blob)) return true;
  if (/96%|97%|95% afue|condensing gas boiler|nfb-|nhb-/.test(blob)) return true;
  if (/energysaver|rinnai.*dtn/.test(blob)) return true;
  if (/\bnest\b|ecobee/.test(blob)) return true;
  if (
    (p.equipmentKind === "furnace" || /furnace/.test(blob)) &&
    /9[5-9]\s*%|95%|96%|97%|98%|99%|afue 9[5-9]/.test(blob)
  ) {
    return true;
  }
  if (p.equipmentKind === "ductless" || /mini.?split|msz-|muz-|mxz-|45mph|45mah/.test(blob)) {
    if (p.seer2 != null && p.seer2 >= 15.2) return true;
    if (/mitsubishi|carrier|infinity|performance/.test(blob)) return true;
  }
  if (p.seer2 != null && p.seer2 >= 15.2) {
    if (
      p.equipmentKind === "heat_pump" ||
      p.equipmentKind === "ac" ||
      p.equipmentKind === "ductless"
    ) {
      return true;
    }
  }
  return false;
}

export function productIsEnergyStar(p: Product | null | undefined): boolean {
  if (!p) return false;
  if (p.energyStar === true) return true;
  if (p.energyStar === false) return false;
  return inferEnergyStar(p);
}

export function withEnergyStarBenefit(
  benefits: string[],
  certified: boolean,
): string[] {
  const rest = (benefits || []).filter((b) => !/energy.?star/i.test(b));
  if (!certified) return rest;
  return [ENERGY_STAR_BENEFIT, ...rest];
}

export function stampEnergyStar(p: Product): Product {
  const certified = p.energyStar ?? inferEnergyStar(p);
  const next: Product = { ...p, energyStar: certified };
  // Locked equipment keeps the 4-line benefit contract — badge lives on the product, not in benefits.
  if (isLockableEquipment(p)) {
    return { ...next, benefits: (p.benefits || []).filter((b) => !/energy.?star/i.test(b)) };
  }
  return {
    ...next,
    benefits: withEnergyStarBenefit(p.benefits || [], certified),
  };
}
