import { formatInches, type EquipmentDimensions } from "./equipment-dimensions";

/**
 * Bath-fan sizing — room size → CFM chips.
 * HVI rule of thumb: 1 CFM per sq ft, 50 CFM minimum.
 * Also check 8 air changes/hour: (L × W × H × 8) / 60.
 * Advisor can skip and tap 50 / 80 / 110.
 */

export const BATH_FAN_CFM_CHIPS = [50, 80, 110] as const;
export type BathFanCfm = (typeof BATH_FAN_CFM_CHIPS)[number];

export const BATH_DIM_FT = [5, 6, 7, 8, 10, 12] as const;
export const BATH_HEIGHT_FT = [8, 9, 10] as const;

export type BathFanCfmRange = { min: number; max: number };

const FAN_CFM_BY_SKU: Record<string, BathFanCfmRange> = {
  "FAN-PANA-VKS3": { min: 50, max: 110 },
  "FAN-PANA-VKSL3": { min: 50, max: 110 },
  "FAN-PANA-WC80": { min: 80, max: 80 },
  "FAN-PANA-WC110L": { min: 110, max: 110 },
  "FAN-PANA-SENSE": { min: 80, max: 110 },
};

/** Panasonic Whisper housing — same 10¼ box across this line. */
export const BATH_FAN_HOUSING: EquipmentDimensions = {
  widthIn: 10.25,
  depthIn: 10.25,
  heightIn: 7.375,
};

/** Standard Whisper grille — hangs past the housing (~1½" each side). */
export const BATH_FAN_GRILLE = { widthIn: 13, depthIn: 13 };

export function bathFanHousing(
  dims?: EquipmentDimensions | null,
): EquipmentDimensions {
  if (
    dims &&
    Number(dims.widthIn) > 0 &&
    Number(dims.depthIn) > 0 &&
    Number(dims.heightIn) > 0
  ) {
    return dims;
  }
  return BATH_FAN_HOUSING;
}

export function formatBathFanFit(
  dims?: EquipmentDimensions | null,
): string {
  const h = bathFanHousing(dims);
  const g = BATH_FAN_GRILLE;
  return `Housing ${formatInches(h.widthIn)} W × ${formatInches(h.depthIn)} D × ${formatInches(h.heightIn)} H · Grille ${formatInches(g.widthIn)} × ${formatInches(g.depthIn)}`;
}

export function bathFanCfmRange(
  sku: string | null | undefined,
): BathFanCfmRange | null {
  if (!sku) return null;
  return FAN_CFM_BY_SKU[sku.toUpperCase()] || null;
}

export function fanCoversCfm(
  sku: string | null | undefined,
  cfm: number | null | undefined,
): boolean {
  if (cfm == null) return true;
  const r = bathFanCfmRange(sku);
  if (!r) return true;
  return cfm >= r.min - 0.5 && cfm <= r.max + 0.5;
}

export function fanHasSelectableCfm(sku: string | null | undefined): boolean {
  const r = bathFanCfmRange(sku);
  return Boolean(r && r.max > r.min);
}

export function formatFanCfm(sku: string | null | undefined): string {
  const r = bathFanCfmRange(sku);
  if (!r) return "";
  if (r.min === r.max) return `${r.min} CFM`;
  return `${r.min}–${r.max} CFM`;
}

/** Snap a raw CFM to the sellable 50 / 80 / 110 ladder (never below 50). */
export function snapBathCfm(raw: number): BathFanCfm {
  if (raw <= 65) return 50;
  if (raw <= 95) return 80;
  return 110;
}

export function recommendedBathCfm(
  lengthFt: number,
  widthFt: number,
  heightFt = 8,
): BathFanCfm {
  const area = Math.max(0, lengthFt) * Math.max(0, widthFt);
  const perSqFt = Math.max(50, area);
  const ach = (area * Math.max(7, heightFt) * 8) / 60;
  return snapBathCfm(Math.max(perSqFt, ach));
}

export function bathSizeLabel(
  lengthFt?: number | null,
  widthFt?: number | null,
  heightFt?: number | null,
): string {
  if (!lengthFt || !widthFt) return "";
  const h = heightFt && heightFt !== 8 ? ` × ${heightFt} ft ceiling` : "";
  return `${lengthFt} × ${widthFt} ft${h}`;
}