/**
 * Signed-quote pull list (exact products sold).
 *
 * Only signed / accepted contracts. Options and optional measures appear
 * only if the customer selected them at signing.
 *
 * Destinations: signed-quote UI now; warehouse / purchasing later via
 * serializePullList + emitPullList(dest).
 */
import type { Product, Proposal, QuoteLine } from "./proposal-types";
import { normalizeLine } from "./proposal-types";
import { formatDimensions } from "./equipment-dimensions";

export type PullListDestination =
  | "signed-quote"
  | "warehouse"
  | "download"
  | "clipboard";

export type PullListLine = {
  lineId: string;
  kind: "equipment" | "accessory" | "language";
  sku: string;
  name: string;
  qty: number;
  unit: string;
  productId: string | null;
  manufacturer: string;
  model: string;
  dimensions: string;
  notes: string;
};

export type PullListSnapshot = {
  proposalId: string;
  proposalNumber: string;
  clientName: string;
  jobAddress: string;
  signedAt: string;
  signerName: string;
  lines: PullListLine[];
  generatedAt: string;
};

export function isSignedForPullList(p: Proposal | null | undefined): boolean {
  if (!p) return false;
  return (
    (p.status === "signed" || p.status === "accepted") && Boolean(p.signature)
  );
}

function brandFromProduct(p: Product | undefined, name: string): string {
  if (p?.name) {
    const first = p.name.split(/\s+/)[0] || "";
    if (first.length > 1) return first;
  }
  const m = name.match(
    /^(Carrier|Mitsubishi|Navien|Bosch|Rinnai|Cozy|Honeywell|AprilAire|IQAir|Williams)\b/i,
  );
  return m?.[1] || "";
}

function modelFromProduct(p: Product | undefined, name: string): string {
  if (p?.sku) return p.sku;
  const m = name.match(/\b([A-Z0-9][A-Z0-9-]{3,})\b/);
  return m?.[1] || "";
}

function signedMeasureOn(line: QuoteLine, proposal: Proposal): boolean {
  const n = normalizeLine(line);
  if (n.role === "info" || n.role === "parked") return false;
  if (n.role === "optional" || n.optional) {
    const ids = proposal.signature?.selectedOptionalIds || [];
    if (n.customerSelected) return true;
    return ids.includes(n.id);
  }
  return true;
}

function selectedOptionIds(line: QuoteLine, proposal: Proposal): string[] {
  const n = normalizeLine(line);
  const fromLine = n.selectedOptionIds || [];
  const nested = proposal.signature?.selectedNestedOptionKeys || [];
  const fromSign = nested
    .filter((k) => k.startsWith(`${n.id}::`))
    .map((k) => k.slice(n.id.length + 2));
  return [...new Set([...fromLine, ...fromSign])];
}

/** Build a frozen pull list. Returns null if the quote is not signed. */
export function buildPullList(
  proposal: Proposal,
  products: Product[],
): PullListSnapshot | null {
  if (!isSignedForPullList(proposal)) return null;
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: PullListLine[] = [];

  for (const raw of proposal.lineItems) {
    const line = normalizeLine(raw);
    if (!signedMeasureOn(line, proposal)) continue;

    const product = line.productId ? byId.get(line.productId) : undefined;
    const qty = Math.max(1, Number(line.quantity) || 1);

    if (product || line.productId) {
      lines.push({
        lineId: line.id,
        kind: "equipment",
        sku: (product?.sku || "").trim(),
        name: product?.name || line.name,
        qty,
        unit: line.unit || product?.unit || "each",
        productId: line.productId,
        manufacturer: brandFromProduct(product, product?.name || line.name),
        model: modelFromProduct(product, product?.name || line.name),
        dimensions: formatDimensions(product?.dimensions ?? line.dimensions),
        notes: "",
      });
    } else if (line.role === "included") {
      lines.push({
        lineId: line.id,
        kind: "language",
        sku: "",
        name: line.name,
        qty: 1,
        unit: "ea",
        productId: null,
        manufacturer: "",
        model: "",
        dimensions: "",
        notes: "Language / labor line — no catalog SKU",
      });
    }

    const opted = selectedOptionIds(line, proposal);
    for (const opt of line.options || []) {
      if (!opted.includes(opt.id)) continue;
      lines.push({
        lineId: `${line.id}::${opt.id}`,
        kind: "accessory",
        sku: "",
        name: `${opt.title} (on ${product?.name || line.name})`,
        qty: 1,
        unit: "ea",
        productId: null,
        manufacturer: "",
        model: "",
        dimensions: "",
        notes: (opt.body || "").slice(0, 160),
      });
    }
  }

  const addr = [
    proposal.propertyStreet,
    proposal.propertyCity,
    proposal.propertyState,
    proposal.propertyZip,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    proposalId: proposal.id,
    proposalNumber: proposal.proposalNumber || proposal.id,
    clientName: proposal.clientContact || proposal.clientCompany || "Client",
    jobAddress: addr || proposal.clientAddress || "",
    signedAt: proposal.signature!.signedAt,
    signerName: proposal.signature!.signerName,
    lines,
    generatedAt: new Date().toISOString(),
  };
}

export function serializePullList(list: PullListSnapshot): {
  json: string;
  text: string;
} {
  const header = [
    `PULL LIST — ${list.proposalNumber}`,
    `Client: ${list.clientName}`,
    list.jobAddress ? `Job: ${list.jobAddress}` : "",
    `Signed: ${new Date(list.signedAt).toLocaleString()} by ${list.signerName}`,
    "",
  ].filter(Boolean);

  const body = list.lines.map((l, i) => {
    const sku = l.sku ? `  SKU ${l.sku}` : "";
    const dim = l.dimensions ? `  ${l.dimensions}` : "";
    return `${i + 1}. ${l.qty} ${l.unit} — ${l.name}${sku}${dim}${
      l.notes ? `\n    ${l.notes}` : ""
    }`;
  });

  return {
    json: JSON.stringify(list, null, 2),
    text: [...header, ...body, "", `${list.lines.length} line(s)`].join("\n"),
  };
}

/**
 * Future warehouse / purchasing hook.
 * signed-quote and download are live; warehouse is a no-op stub until dest exists.
 */
export function emitPullList(
  list: PullListSnapshot,
  dest: PullListDestination,
): { ok: boolean; payload: string } {
  const { json, text } = serializePullList(list);
  if (dest === "warehouse") {
    return { ok: true, payload: json };
  }
  if (dest === "download") {
    return { ok: true, payload: text };
  }
  return { ok: true, payload: dest === "clipboard" ? text : json };
}
