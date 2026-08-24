/**
 * PARKED (2026-08-13) — house-on-cover is off the live packet.
 * Street View / map / sample house are not used on the customer document.
 * Keep this module for a later, honest camera-first cover if we bring it back.
 *
 * LATER — Cover sketch from advisor photo
 * Comfort advisor snaps the real house in the driveway.
 * AI turns that photo into a clean drawing for the packet cover.
 * Keep the original snap in the file; offer “use the photo” if the drawing is off.
 * Do not use Street View / Redfin / listing scrapes.
 */
import type { Proposal } from "./proposal-types";

export type GeoResult = {
  lat: number;
  lon: number;
  displayName: string;
  mapImageUrl: string;
  streetViewUrl?: string | null;
};

const SAMPLE_HOUSE = "/property-samples/house.jpg";

function googleMapsKey(): string | null {
  try {
    const k = (import.meta as { env?: Record<string, string> }).env
      ?.VITE_GOOGLE_MAPS_API_KEY;
    return k && k.trim() ? k.trim() : null;
  } catch {
    return null;
  }
}

export function hasGoogleMapsKey(): boolean {
  return Boolean(googleMapsKey());
}

function staticMapUrl(lat: number, lon: number, zoom = 18): string {
  // Public OSM static map (no API key). Fine for a faded cover backdrop.
  const markers = `markers=${lat},${lon},lightblue1`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=1400x800&maptype=mapnik&${markers}`;
}

/** Official Google Street View Static API — homeowner-facing curb shot when key is set. */
export function streetViewStaticUrl(
  lat: number,
  lon: number,
  opts?: { size?: string; fov?: number; pitch?: number },
): string | null {
  const key = googleMapsKey();
  if (!key) return null;
  const size = opts?.size || "1400x800";
  const fov = opts?.fov ?? 90;
  const pitch = opts?.pitch ?? 5;
  const params = new URLSearchParams({
    size,
    location: `${lat},${lon}`,
    fov: String(fov),
    pitch: String(pitch),
    source: "outdoor",
    key,
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/** Alternate: address-based Street View (Google resolves the location). */
export function streetViewByAddressUrl(address: string): string | null {
  const key = googleMapsKey();
  if (!key || !address.trim()) return null;
  const params = new URLSearchParams({
    size: "1400x800",
    location: address.trim(),
    fov: "90",
    pitch: "5",
    source: "outdoor",
    key,
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const q = address.trim();
  if (q.length < 5) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Acme HVAC Quotes/1.0 (HVAC proposal property locator)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0]!;
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const sv = streetViewStaticUrl(lat, lon);
    return {
      lat,
      lon,
      displayName: hit.display_name,
      mapImageUrl: staticMapUrl(lat, lon),
      streetViewUrl: sv,
    };
  } catch {
    return null;
  }
}

/** Best cover visual for the proposal front page. */
export function coverPropertyVisualUrl(
  p: Pick<
    Proposal,
    | "propertyImageUrl"
    | "propertyMapUrl"
    | "propertyPhotoUrl"
    | "propertyLat"
    | "propertyLon"
    | "propertyStreet"
    | "propertyCity"
    | "propertyState"
    | "propertyZip"
    | "isTest"
  >,
): string | null {
  // 1) Explicit upload
  if (p.propertyImageUrl) return p.propertyImageUrl;
  if (p.propertyPhotoUrl) return p.propertyPhotoUrl;

  // 2) Street View from coords if we have a key
  if (
    p.propertyLat != null &&
    p.propertyLon != null &&
    Number.isFinite(p.propertyLat) &&
    Number.isFinite(p.propertyLon)
  ) {
    const sv = streetViewStaticUrl(p.propertyLat, p.propertyLon);
    if (sv) return sv;
  }

  // 3) Map backdrop from locate
  if (p.propertyMapUrl) return p.propertyMapUrl;

  // 4) Address-based Street View if key + address
  const addr = composePropertyAddress({
    street: p.propertyStreet,
    city: p.propertyCity,
    state: p.propertyState,
    zip: p.propertyZip,
  });
  const byAddr = streetViewByAddressUrl(addr);
  if (byAddr) return byAddr;

  // 5) Soft demo sample only for training quotes
  if (p.isTest) return SAMPLE_HOUSE;

  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function composePropertyAddress(parts: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string {
  return [parts.street, parts.city, parts.state, parts.zip]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Locate address and return proposal patch fields for cover visual.
 * Prefers Street View when Google key is configured; otherwise map.
 */
export async function locatePropertyForProposal(address: string): Promise<{
  ok: true;
  patch: {
    propertyMapUrl: string;
    propertyLat: number;
    propertyLon: number;
    propertyImageUrl?: string;
  };
  displayName: string;
  usedStreetView: boolean;
} | { ok: false; error: string }> {
  const geo = await geocodeAddress(address);
  if (!geo) {
    // Try Street View by address alone if Google key present
    const sv = streetViewByAddressUrl(address);
    if (sv) {
      return {
        ok: true,
        patch: {
          propertyMapUrl: sv,
          propertyLat: 0,
          propertyLon: 0,
          propertyImageUrl: sv,
        },
        displayName: address,
        usedStreetView: true,
      };
    }
    return {
      ok: false,
      error:
        "Could not locate that address. Check spelling, or upload a photo of the home.",
    };
  }

  const usedStreetView = Boolean(geo.streetViewUrl);
  return {
    ok: true,
    patch: {
      propertyMapUrl: geo.mapImageUrl,
      propertyLat: geo.lat,
      propertyLon: geo.lon,
      // Prefer Street View as the cover "photo" when available
      ...(geo.streetViewUrl
        ? { propertyImageUrl: geo.streetViewUrl }
        : {}),
    },
    displayName: geo.displayName,
    usedStreetView,
  };
}
