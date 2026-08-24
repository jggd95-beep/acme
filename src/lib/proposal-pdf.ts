/**
 * Landscape client PDF — matches on-screen packet:
 * header, benefits|scope columns, in-measure options, investment, CA notices.
 */
import { jsPDF } from "jspdf";
import { COMPANY } from "./company";
import {
  calcTotals,
  californiaDisclosures,
  customerMeasures,
  normalizeLine,
  selectedOptionsDelta,
  type Proposal,
  type QuoteLine,
} from "./proposal-types";
import { formatCurrency, formatDate } from "./utils";
import { packetPackagesForProposal } from "./packet-packages";
import { foldStandalonePadIntoOwner } from "./equipment-catalog";
import { useProposalStore } from "./proposal-store";
import { SAMPLE_PRODUCTS } from "./proposal-types";

const CYAN = [0, 212, 245] as const;
const INK = [15, 23, 42] as const;
const MUTED = [100, 116, 139] as const;
const SOFT = [240, 253, 250] as const;
const AMBER = [251, 191, 36] as const;
const CYAN_SOFT = [224, 249, 255] as const;
const HEADER_BG = [11, 18, 32] as const;

function money(n: number, currency?: string) {
  return formatCurrency(n, currency || COMPANY.currency);
}

export function proposalPdfFileName(p: Proposal): string {
  const num = (p.proposalNumber || p.id || "draft").replace(/[^\w.-]+/g, "-");
  const who = (p.clientCompany || p.clientContact || "customer")
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 40);
  return `Acme-HVAC-Proposal-${num}-${who}.pdf`;
}

async function fetchAssetDataUrl(src: string): Promise<string | null> {
  try {
    const url = src.startsWith("http")
      ? src
      : `${typeof window !== "undefined" ? window.location.origin : ""}${src}`;
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (typeof FileReader !== "undefined") {
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || "") || null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const mime = blob.type || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function fetchLogoDataUrl(): Promise<string | null> {
  return fetchAssetDataUrl(COMPANY.logoUrl);
}

function stripScopeLine(s: string): string {
  return s.replace(/^\s*\d+[\.)]\s*/, "").trim();
}

/** Word-wrap only — never split a word. Boxes grow up instead. */
function wrapWords(doc: jsPDF, text: string, width: number): string[] {
  const clean = String(text || "")
    .replace(/[▸•]/g, "-")
    .replace(/[™®]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (doc.getTextWidth(next) <= width * 0.9) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildProposalPdfBlob(p: Proposal): Promise<Blob> {
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "landscape",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  const contentW = pageW - margin * 2;
  let y = margin;
  const logoData = await fetchLogoDataUrl();

  // Landscape: benefits ⅓ · work scope ⅔
  const benefitsW = Math.floor(contentW * (1 / 3));
  const colGap = 10;
  const scopeW = contentW - benefitsW - colGap;
  const tabW = 64;
  const showPrices = Boolean(p.showMeasurePrices);
  const currency = p.currency || COMPANY.currency;

  const setY = (n: number) => {
    y = n;
  };
  const getY = () => y;
  /** Bottom safe zone for a single footer line (page numbers stamped once at end). */
  const FOOTER_Y = pageH - 18;
  const CONTENT_BOTTOM = pageH - 40;
  const newPage = () => {
    doc.addPage();
    y = margin;
    // Do NOT draw footer here — final pass stamps one clean "Page X of Y" per page
  };
  const ensure = (need: number) => {
    if (y + need > CONTENT_BOTTOM) newPage();
  };

  // ═══ PAGE 1 — J5 cover (print-light) ═══
  const coName = (
    p.companyName || COMPANY.shortName
  )
    .replace(/Heating and Air Conditioning/i, "")
    .trim() || COMPANY.shortName;
  doc.setDrawColor(17, 17, 17);
  doc.setLineWidth(2.4);
  const coverTop = 48;
  const coverMid = 132;
  doc.line(margin, coverTop, pageW - margin, coverTop);
  doc.line(margin, coverMid, pageW - margin, coverMid);
  doc.setTextColor(17, 17, 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text(coName.toUpperCase(), pageW / 2, 88, { align: "center" });
  doc.setFontSize(13);
  doc.text(`SINCE ${COMPANY.since}`, pageW / 2, 112, { align: "center" });

  const coverColW = 460; // cover column only — do not reuse name colW
  const colX = (pageW - coverColW) / 2;

  let cy = 162;
  doc.setFontSize(10);
  doc.text("PREPARED FOR:", colX, cy);
  cy += 24;
  doc.setFontSize(24);
  doc.text(p.clientContact || p.clientCompany || "Homeowner", colX, cy);
  cy += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const siteStreet = (p.propertyStreet || "").trim();
  const siteCity = [p.propertyCity, p.propertyState, p.propertyZip]
    .filter(Boolean)
    .join(", ");
  const coverLines: string[] = [];
  if (siteStreet) coverLines.push(siteStreet);
  if (siteCity) coverLines.push(siteCity);
  if (!siteStreet && (p.clientAddress || "").trim()) {
    coverLines.push((p.clientAddress || "").trim());
  }
  if ((p.clientPhone || "").trim()) coverLines.push(p.clientPhone!.trim());
  if ((p.clientEmail || "").trim()) coverLines.push(p.clientEmail!.trim());
  for (const line of coverLines) {
    doc.text(line, colX, cy);
    cy += 14;
  }

  cy += 12;
  const summary = (p.executiveSummary || "").trim();
  if (summary) {
    doc.setFontSize(11);
    const ov = doc.splitTextToSize(summary, coverColW);
    doc.text(ov, colX, cy);
  }

  doc.setLineWidth(1.1);
  doc.line(margin, pageH - 56, pageW - margin, pageH - 56);
  doc.setFontSize(9);
  doc.text(`CSLB ${p.contractorLicense || COMPANY.contractorLicense}`, margin, pageH - 40);
  doc.text(COMPANY.addressLine2 || "Berkeley, CA", margin, pageH - 28);
  doc.text(p.proposalNumber || "", pageW - margin, pageH - 40, { align: "right" });
  doc.text(p.createdAt ? formatDate(p.createdAt) : "", pageW - margin, pageH - 28, {
    align: "right",
  });

  newPage();

  // ═══ PAGE 2+ measures ═══
  const liveCatalog = [
    ...(useProposalStore.getState().products || []),
    ...SAMPLE_PRODUCTS,
  ];
  const pkgs = packetPackagesForProposal(p, liveCatalog);
  const pkgPhotoData = new Map<string, string>();
  if (pkgs.length) {
    for (const pkg of pkgs) {
      for (const ph of (pkg.photos || []).slice(0, 2)) {
        if (!ph?.url || pkgPhotoData.has(ph.url)) continue;
        const data = await fetchAssetDataUrl(ph.url);
        if (data) pkgPhotoData.set(ph.url, data);
      }
    }
  }
  if (pkgs.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(8, 145, 178);
    doc.text("CHOOSE YOUR SYSTEM", margin, y);
    y += 6;
    doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.setLineWidth(1.2);
    doc.line(margin, y, margin + 148, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const n = pkgs.length;
    const intro = doc.splitTextToSize(
      n === 1
        ? "One complete job from Acme HVAC. Same crew, same permit, same startup."
        : n === 2
          ? "Two complete jobs from Acme HVAC. Same crew, same permit, same startup. Pick the system."
          : "Complete jobs from Acme HVAC. Same crew, same permit, same startup. Pick the system. Options sit on every card.",
      contentW,
    );
    doc.text(intro, margin, y);
    y += intro.length * 11 + 8;

    const cols = n === 4 ? 2 : Math.min(n, 3);
    const gap = 10;
    const boxW = (contentW - gap * (cols - 1)) / cols;
    const inner = boxW - 24;

    type Block = { kind: "h" | "b" | "n" | "p" | "m"; text: string; size: number };
    const blocksFor = (pkg: (typeof pkgs)[number]): Block[] => {
      const out: Block[] = [];
      out.push({
        kind: "h",
        text:
          n === 1
            ? "YOUR SYSTEM"
            : (pkg.rankLabel || pkg.badge || pkg.label).toUpperCase(),
        size: 7,
      });
      if (pkg.popular) {
        out.push({ kind: "m", text: "MOST POPULAR", size: 7 });
      } else if (pkg.recommended) {
        out.push({ kind: "m", text: "RECOMMENDED", size: 7 });
      }
      if (pkg.subtitle && pkg.subtitle !== pkg.headline) {
        out.push({ kind: "n", text: pkg.subtitle, size: 8 });
      }
      out.push({ kind: "b", text: pkg.headline || pkg.label, size: 11 });
      if (pkg.why) out.push({ kind: "n", text: pkg.why, size: 8 });
      if (pkg.price != null && pkg.price > 0) {
        out.push({ kind: "b", text: money(pkg.price, currency), size: 13 });
      }
      if (pkg.rebateInstant && pkg.rebateInstant > 0) {
        out.push({
          kind: "p",
          text: `After estimated incentives ${money(pkg.priceAfterRebates ?? pkg.price! - pkg.rebateInstant, currency)}`,
          size: 8,
        });
      }
      if (pkg.rebateDeferred && pkg.rebateDeferred > 0) {
        out.push({
          kind: "n",
          text: `Plus about ${money(pkg.rebateDeferred, currency)} back later when paperwork clears`,
          size: 7.5,
        });
      }
      if (pkg.rebateHighlight) {
        out.push({ kind: "n", text: pkg.rebateHighlight, size: 7.5 });
      }
      if (pkg.warrantyLine) {
        out.push({ kind: "p", text: pkg.warrantyLine, size: 8 });
      }
      for (const t of (pkg.points || []).slice(0, 3)) {
        out.push({ kind: "n", text: `▸  ${t}`, size: 8 });
      }
      if (pkg.items?.length) {
        out.push({ kind: "m", text: "THIS SYSTEM", size: 7 });
        for (const t of pkg.items.slice(0, 8)) {
          out.push({ kind: "n", text: t, size: 7.5 });
        }
      }
      if (pkg.addOns?.length) {
        const extras = pkg.addOns.filter(
          (o) => o.optional && Number(o.price) > 0,
        );
        if (extras.length) {
          out.push({ kind: "m", text: "ADD IF YOU WANT IT", size: 7 });
          for (const o of extras) {
            out.push({
              kind: "n",
              text: `${o.name}  +${money(o.price ?? 0, currency)}`,
              size: 7.5,
            });
          }
        }
      }
      if (pkg.optionalProducts?.length) {
        out.push({ kind: "m", text: "ALSO AVAILABLE", size: 7 });
        for (const op of pkg.optionalProducts) {
          out.push({
            kind: "n",
            text: `${op.name}  +${money(op.price, currency)}`,
            size: 7.5,
          });
        }
      }
      return out;
    };

    const wrapBlock = (b: Block): string[] => {
      doc.setFont(
        "helvetica",
        b.kind === "b" || b.kind === "h" || b.kind === "m" || b.kind === "p"
          ? "bold"
          : "normal",
      );
      doc.setFontSize(b.size);
      return wrapWords(doc, b.text, inner);
    };

    const PHOTO_H = 64;

    const heightFor = (pkg: (typeof pkgs)[number]) => {
      let h = 16;
      const hasPhoto = (pkg.photos || []).some((ph) => pkgPhotoData.has(ph.url));
      if (hasPhoto) h += PHOTO_H + 10;
      for (const b of blocksFor(pkg)) {
        const wrap = wrapBlock(b);
        const lh = b.size + 3;
        h += wrap.length * lh + 2;
      }
      return h + 10;
    };

    // One row of cards per page so each box can grow with its copy.
    // Never force two rows onto a landscape page — that was the overflow.
    let i = 0;
    while (i < pkgs.length) {
      const rowCount = Math.min(cols, pkgs.length - i);
      const natural = Math.max(...pkgs.slice(i, i + rowCount).map(heightFor), 120);
      if (y + Math.min(natural, 200) > CONTENT_BOTTOM) newPage();
      const top = y;
      const rowH = Math.min(natural, CONTENT_BOTTOM - top);
      for (let c = 0; c < rowCount; c++) {
        const pkg = pkgs[i + c];
        const x = margin + c * (boxW + gap);
        const rec = Boolean(pkg.recommended);
        if (rec) {
          doc.setFillColor(CYAN_SOFT[0], CYAN_SOFT[1], CYAN_SOFT[2]);
          doc.setDrawColor(8, 145, 178);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(17, 17, 17);
        }
        doc.setLineWidth(1.5);
        doc.roundedRect(x, top, boxW, rowH, 5, 5, "FD");

        let iy = top + 14;
        const livePhotos = (pkg.photos || [])
          .map((ph) => ({ ...ph, data: pkgPhotoData.get(ph.url) }))
          .filter((ph) => ph.data)
          .slice(0, 2);
        if (livePhotos.length) {
          const slot = (boxW - 24) / livePhotos.length;
          livePhotos.forEach((ph, pi) => {
            const px = x + 10 + pi * slot;
            const pw = slot - 6;
            try {
              const fmt = /\.jpe?g/i.test(ph.url) ? "JPEG" : "PNG";
              doc.addImage(ph.data as string, fmt, px, iy, pw, PHOTO_H, undefined, "FAST");
            } catch {
              /* skip a bad frame */
            }
          });
          iy += PHOTO_H + 10;
        }
        const floor = top + rowH - 10;
        for (const b of blocksFor(pkg)) {
          if (b.kind === "b") {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(INK[0], INK[1], INK[2]);
          } else if (b.kind === "p") {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(8, 145, 178);
          } else if (b.kind === "h" || b.kind === "m") {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
          } else {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 65, 85);
          }
          doc.setFontSize(b.size);
          const lines = wrapBlock(b);
          const lh = b.size + 3;
          for (const line of lines) {
            if (iy + lh > floor) break;
            doc.text(line, x + 9, iy);
            iy += lh;
          }
          iy += 2;
        }
      }
      y = top + rowH + 8;
      i += rowCount;
    }

    const extras = pkgs[0];
    if (extras?.includedInEvery?.length) {
      ensure(28 + extras.includedInEvery.length * 11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("EVERY PACKAGE INCLUDES", margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      for (const t of extras.includedInEvery) {
        doc.text(t, margin, y);
        y += 11;
      }
      y += 8;
    }
    ensure(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `LICENSED & INSURED · CSLB ${p.contractorLicense || COMPANY.contractorLicense}   ·   FACTORY-TRAINED   ·   QUALITY INSTALL   ·   TRUSTED LOCALLY SINCE ${COMPANY.since}`,
      margin,
      y,
    );
    y += 16;
  }

  ensure(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(8, 145, 178);
  doc.text("YOUR MEASURES", margin, y);
  y += 6;
  doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
  doc.setLineWidth(1.2);
  doc.line(margin, y, margin + 120, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    showPrices
      ? "Prices aligned in the right column. Optional items show price until selected at signing."
      : "Included measures show INCLUDED; turn on show prices to put $ in that same column.",
    margin,
    y,
  );
  y += 14;

  const measures = foldStandalonePadIntoOwner(
    customerMeasures(p.lineItems || []),
  );
  const ctx: Ctx = {
    margin,
    contentW,
    benefitsW,
    scopeW,
    colGap,
    tabW,
    showPrices,
    currency,
    pageH,
    ensure,
    getY,
    setY,
    newPage,
  };
  for (const raw of measures) {
    // normalizeLine scrubs duplicate / wrong warranty lines (e.g. 3× labor on permit)
    const line = normalizeLine(raw);
    drawMeasureBlock(doc, line, ctx);
  }

  // ═══ INVESTMENT (clean table — right-aligned $ column, no strike-through lines) ═══
  ensure(130);
  y = getY() + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(8, 145, 178);
  doc.text("INVESTMENT SUMMARY", margin, y);
  y += 5;
  doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
  doc.setLineWidth(1.5);
  doc.line(margin, y, margin + 160, y);
  y += 12;

  const totals = calcTotals(p, [], []);
  const taxRate = Math.max(0, Number(p.taxRate) || 0);
  type InvRow = {
    label: string;
    value: string;
    kind: "normal" | "total" | "muted";
  };
  const invRows: InvRow[] = [
    {
      label: "Measures subtotal",
      value: money(totals.subtotal, currency),
      kind: "normal",
    },
  ];
  if (totals.discount > 0) {
    invRows.push({
      label: "Job discount",
      value: "−" + money(totals.discount, currency),
      kind: "muted",
    });
  }
  invRows.push({
    label: `Tax (${taxRate.toFixed(2)}%)`,
    value: money(totals.tax, currency),
    kind: "normal",
  });
  invRows.push({
    label: "Contract total",
    value: money(totals.total, currency),
    kind: "total",
  });

  const rowH = 20;
  const tableH = invRows.length * rowH + 4;
  const amountColW = 110;
  const amountX = margin + contentW - 12; // right edge for $ amounts
  const labelX = margin + 12;

  // Outer card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.rect(margin, y, contentW, tableH, "FD");

  let ry = y;
  for (const row of invRows) {
    if (row.kind === "total") {
      // Solid total bar — no line through text
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, ry, contentW, rowH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text(row.label.toUpperCase(), labelX, ry + 13.5);
      doc.text(row.value, amountX, ry + 13.5, { align: "right" });
    } else {
      doc.setFont("helvetica", row.kind === "muted" ? "normal" : "normal");
      doc.setFontSize(9.5);
      if (row.kind === "muted") {
        doc.setTextColor(100, 116, 139);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(row.label, labelX, ry + 13.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(row.value, amountX, ry + 13.5, { align: "right" });
      // hairline separator under normal rows (not through text — full width under)
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin + 8, ry + rowH, margin + contentW - 8, ry + rowH);
    }
    ry += rowH;
  }
  y = ry + 16;

  // ═══ WARRANTY ═══
  if (p.warranty?.trim()) {
    ensure(50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(8, 145, 178);
    doc.text("WARRANTY", margin, y);
    y += 5;
    doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + 90, y);
    y += 12;
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    const wLines = doc.splitTextToSize(p.warranty.trim(), contentW - 20);
    const showW = wLines.slice(0, 10);
    const wBoxH = showW.length * 10 + 16;
    doc.rect(margin, y, contentW, wBoxH, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(showW, margin + 10, y + 12);
    y += wBoxH + 14;
  }

  // ═══ SIGNATURES — matching light cards, no black panel ═══
  ensure(130);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(8, 145, 178);
  doc.text("SIGNATURES", margin, y);
  y += 5;
  doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
  doc.setLineWidth(1.5);
  doc.line(margin, y, margin + 100, y);
  y += 12;

  const sigColW = (contentW - 16) / 2;
  const sigH = 108;
  const sp = p.salesperson;
  const cust = p.signature;

  const drawSigCard = (
    x: number,
    role: string,
    opts: {
      companyLine?: string;
      signedName?: string;
      printedName: string;
      subLine?: string;
      dateLine: string;
      signatureDataUrl?: string | null;
      blank?: boolean;
    },
  ) => {
    // Always light card — never black
    doc.setFillColor(252, 253, 254);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.7);
    doc.rect(x, y, sigColW, sigH, "FD");

    // Role header strip
    doc.setFillColor(240, 249, 255);
    doc.rect(x + 0.5, y + 0.5, sigColW - 1, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(8, 145, 178);
    doc.text(role.toUpperCase(), x + 10, y + 12);

    if (opts.companyLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(opts.companyLine, x + 10, y + 32);
    }

    // Signature area
    const sigLineY = y + 62;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.6);
    doc.line(x + 10, sigLineY, x + sigColW - 10, sigLineY);

    if (opts.signatureDataUrl) {
      try {
        doc.addImage(opts.signatureDataUrl, "PNG", x + 12, y + 36, 110, 24);
      } catch {
        /* ignore */
      }
    } else if (opts.signedName && !opts.blank) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(opts.signedName, x + 12, sigLineY - 6);
    } else {
      // Light placeholder — not a black box
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("Sign here", x + 12, sigLineY - 6);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(opts.printedName, x + 10, y + 78);
    if (opts.subLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(opts.subLine, x + 10, y + 90);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(opts.dateLine, x + 10, y + 102);
  };

  drawSigCard(margin, "Contractor / Comfort Advisor", {
    companyLine: p.companyName || COMPANY.name,
    signedName: sp?.name || "Comfort Advisor",
    printedName: sp?.name || "Comfort Advisor",
    subLine: sp?.title || "Comfort Advisor",
    dateLine: "Date: " + (sp?.signedAt ? formatDate(sp.signedAt) : formatDate(p.createdAt)),
    signatureDataUrl: sp?.signatureDataUrl,
    blank: false,
  });

  drawSigCard(margin + sigColW + 16, "Customer / Homeowner", {
    companyLine: undefined,
    signedName: cust?.signerName,
    printedName: cust?.signerName || p.clientContact || "Homeowner",
    subLine: cust?.signerEmail || p.clientEmail || undefined,
    dateLine:
      "Date: " + (cust?.signedAt ? formatDate(cust.signedAt) : "____________"),
    signatureDataUrl: cust?.signatureDataUrl,
    blank: !cust,
  });

  y += sigH + 16;

  // ═══ CALIFORNIA NOTICES ═══
  newPage();
  doc.setTextColor(8, 145, 178);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const notices = californiaDisclosures({
    companyName: p.companyName,
    contractorLicense: p.contractorLicense,
    companyPhone: p.companyPhone,
  });
  doc.text(
    (notices.sectionTitle || "CALIFORNIA NOTICES").toUpperCase(),
    margin,
    y,
  );
  y += 6;
  doc.setDrawColor(CYAN[0], CYAN[1], CYAN[2]);
  doc.setLineWidth(1.2);
  doc.line(margin, y, margin + 200, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const introLines = doc.splitTextToSize(
    notices.sectionIntro ||
      "Required home-improvement contract disclosures.",
    contentW,
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 11 + 8;

  const caRows: { label: string; text: string; notice?: boolean }[] =
    (notices.rows || []).map((r) => ({
      label: r.label,
      text: r.text,
      notice: r.statutory,
    }));

  // Visual hierarchy for CA: statutory slightly larger; keep readable
  const colW = (contentW - 10) / 2;
  let col = 0;
  let colY = [y, y];
  for (const r of caRows) {
    const x = margin + col * (colW + 10);
    const titleSize = r.notice ? 10 : 9;
    const bodySize = r.notice ? 9 : 8.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    const body = doc.splitTextToSize(r.text, colW - 14);
    const lineH = bodySize + 2;
    const boxH = 16 + body.length * lineH + 10;
    if (colY[col] + boxH > pageH - 36) {
      newPage();
      colY = [margin, margin];
    }
    const by = colY[col];
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 251, 252);
    doc.rect(x, by, colW, boxH, "FD");
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    doc.text(r.label, x + 7, by + 14);
    doc.setFont("helvetica", r.notice ? "bold" : "normal");
    doc.setFontSize(bodySize);
    doc.text(body, x + 7, by + 28);
    colY[col] = by + boxH + 8;
    if (colY[0] <= colY[1]) col = 0;
    else col = 1;
  }

  // Single footer pass — one line only (no double stamp)
  const totalPages = doc.getNumberOfPages();
  const brand = `${p.companyName || COMPANY.name} · ${COMPANY.websiteLabel}`;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Clear a thin strip so nothing underlays the footer
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageH - 28, pageW, 28, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 26, pageW - margin, pageH - 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(brand, margin, FOOTER_Y);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, FOOTER_Y, {
      align: "right",
    });
  }

  return doc.output("blob");
}

type Ctx = {
  margin: number;
  contentW: number;
  benefitsW: number;
  scopeW: number;
  colGap: number;
  tabW: number;
  showPrices: boolean;
  currency: string;
  pageH: number;
  ensure: (n: number) => void;
  getY: () => number;
  setY: (n: number) => void;
  newPage: () => void;
};

function drawMeasureBlock(doc: jsPDF, line: QuoteLine, ctx: Ctx) {
  const {
    margin,
    contentW,
    benefitsW,
    scopeW,
    colGap,
    tabW,
    showPrices,
    currency,
    pageH,
    ensure,
    getY,
    setY,
    newPage,
  } = ctx;

  const isOpt = line.role === "optional";
  const infoOnly =
    line.unitPrice === 0 &&
    line.showPrice === false &&
    /guide|vs gas|education|info/i.test(line.name + (line.description || ""));

  const benefits = (line.benefits || []).filter(Boolean);
  const scopeLines = (line.workScope || "")
    .split(/\n+/)
    .map(stripScopeLine)
    .filter(Boolean);
  const scopeFallback =
    !scopeLines.length && line.description ? [line.description] : scopeLines;
  const options = line.options || [];

  // Column text widths — never cross the vertical divider
  const padX = 6;
  const benefitsTextW = Math.max(40, benefitsW - padX * 2);
  const scopeTextW = Math.max(40, scopeW - padX * 2);
  const benefitsX = margin + padX;
  const scopeX = margin + benefitsW + colGap + padX;

  // Hierarchy: measure title > body > column headers / options
  const TITLE_PT = 12;
  const COL_HEAD_PT = 8;
  const BODY_PT = 9;
  const OPT_TITLE_PT = 9;
  const OPT_BODY_PT = 8;
  const bodyLineH = BODY_PT + 2;
  const optLineH = OPT_BODY_PT + 2;

  // CRITICAL: wrap at the same font size we draw (was measuring 8pt, drawing 10pt → overflow)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_PT);
  const bChunks = benefits.map((b) => wrapWords(doc, `• ${b}`, benefitsTextW));
  const sChunks = scopeFallback.map((s, i) =>
    wrapWords(doc, `${i + 1}. ${s}`, scopeTextW),
  );
  const bH = bChunks.reduce((s, c) => s + c.length * bodyLineH, 0) || 12;
  const sH = sChunks.reduce((s, c) => s + c.length * bodyLineH, 0) || 12;
  const nameH = 26;
  const colHeadH = 14;
  const bodyH = Math.max(bH, sH) + 14;

  const optionRows = options.map((o) => {
    const isPad =
      o.kind === "pad" || /custom concrete pad|concrete pad/i.test(o.title);
    const preIncluded =
      isPad && (line.selectedOptionIds || []).includes(o.id);
    const optBody = String(o.body || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(OPT_BODY_PT);
    // Included package items: compact title only (no multi-line dump)
    const bodyLines =
      preIncluded || !optBody
        ? []
        : doc.splitTextToSize(optBody, contentW - tabW - 48).slice(0, 2);
    const rowH = Math.max(
      22,
      12 + (bodyLines.length ? bodyLines.length * optLineH + 4 : 0),
    );
    return { o, isPad, preIncluded, bodyLines, rowH };
  });
  const optHeaderH = options.length ? 14 : 0;
  const optH = optHeaderH + optionRows.reduce((s, r) => s + r.rowH, 0);
  const blockH = nameH + colHeadH + bodyH + optH + 8;

  ensure(Math.min(blockH, pageH - 70));
  let y = getY();
  if (y + Math.min(blockH, 80) > pageH - 36) {
    newPage();
    y = getY();
  }

  // Name bar
  if (isOpt) doc.setFillColor(255, 247, 237);
  else doc.setFillColor(CYAN_SOFT[0], CYAN_SOFT[1], CYAN_SOFT[2]);
  doc.rect(margin, y, contentW, nameH, "F");

  const total =
    (line.showPrice === false ? 0 : line.unitPrice * (line.quantity || 1)) +
    selectedOptionsDelta(line, []);
  const showMoney =
    !infoOnly && line.showPrice !== false && (isOpt || showPrices);

  if (infoOnly) {
    doc.setFillColor(100, 116, 139);
  } else if (showMoney) {
    if (isOpt) doc.setFillColor(255, 247, 237);
    else doc.setFillColor(CYAN_SOFT[0], CYAN_SOFT[1], CYAN_SOFT[2]);
  } else if (isOpt) {
    doc.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
  } else {
    doc.setFillColor(8, 145, 178);
  }
  doc.rect(margin + contentW - tabW, y, tabW, nameH, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin + contentW - tabW, y, margin + contentW - tabW, y + nameH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_PT);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const label = isOpt ? `Optional · ${line.name}` : line.name;
  const titleLines = doc.splitTextToSize(label, contentW - tabW - 14);
  doc.text(
    titleLines.slice(0, 2),
    margin + 6,
    y + (titleLines.length > 1 ? 11 : 16),
  );

  if (infoOnly) {
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("INFO", margin + contentW - tabW / 2, y + 16, { align: "center" });
  } else if (showMoney) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(money(total, currency), margin + contentW - 5, y + 16, {
      align: "right",
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(isOpt ? 26 : 255, isOpt ? 26 : 255, isOpt ? 26 : 255);
    doc.text(
      isOpt ? "OPTIONAL" : "INCLUDED",
      margin + contentW - tabW / 2,
      y + 16,
      { align: "center" },
    );
  }
  y += nameH;

  // Column headers — smaller than measure title
  doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
  doc.rect(margin, y, contentW, colHeadH, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin + benefitsW, y, margin + benefitsW, y + colHeadH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(COL_HEAD_PT);
  doc.setTextColor(8, 145, 178);
  doc.text("BENEFITS", benefitsX, y + 10);
  doc.text("WORK SCOPE", scopeX, y + 10);
  y += colHeadH;

  const bodyTop = y;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.rect(margin, bodyTop, contentW, bodyH, "S");
  doc.line(margin + benefitsW, bodyTop, margin + benefitsW, bodyTop + bodyH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_PT);
  let by = bodyTop + 11;
  if (!benefits.length) {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("—", benefitsX, by);
  } else {
    doc.setTextColor(INK[0], INK[1], INK[2]);
    for (const chunk of bChunks) {
      for (const line of chunk) {
        if (by + bodyLineH > bodyTop + bodyH - 3) break;
        doc.text(line, benefitsX, by);
        by += bodyLineH;
      }
    }
  }

  let sy = bodyTop + 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_PT);
  if (!scopeFallback.length) {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("—", scopeX, sy);
  } else {
    doc.setTextColor(INK[0], INK[1], INK[2]);
    for (const chunk of sChunks) {
      for (const line of chunk) {
        if (sy + bodyLineH > bodyTop + bodyH - 3) break;
        doc.text(line, scopeX, sy);
        sy += bodyLineH;
      }
    }
  }
  y = bodyTop + bodyH;

  if (optionRows.length) {
    doc.setFillColor(255, 247, 237);
    doc.rect(margin, y, contentW, optHeaderH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(COL_HEAD_PT);
    doc.setTextColor(146, 64, 14);
    doc.text(
      "OPTIONS — checkboxes only on optional upgrades; package items show INCLUDED",
      margin + 6,
      y + 10,
    );
    y += optHeaderH;

    for (const row of optionRows) {
      const { o, isPad, preIncluded, bodyLines, rowH } = row;
      if (y + rowH > pageH - 36) {
        newPage();
        y = getY();
      }

      doc.setDrawColor(226, 232, 240);
      if (preIncluded) {
        doc.setFillColor(CYAN_SOFT[0], CYAN_SOFT[1], CYAN_SOFT[2]);
      } else {
        doc.setFillColor(255, 254, 251);
      }
      doc.rect(margin, y, contentW, rowH, "FD");

      const textLeft = margin + (preIncluded ? 8 : 22);

      if (!preIncluded) {
        // Empty checkbox — customer may select at signing
        doc.setDrawColor(INK[0], INK[1], INK[2]);
        doc.setLineWidth(0.8);
        doc.rect(margin + 6, y + 6, 8, 8, "S");
      }
      // preIncluded: no checkbox, no X — not an "option to select"

      doc.setFont("helvetica", "bold");
      doc.setFontSize(OPT_TITLE_PT);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const titleMax = contentW - tabW - (preIncluded ? 20 : 36);
      const titleLine =
        doc.splitTextToSize(
          o.title || (isPad ? "Custom concrete pad" : "Option"),
          titleMax,
        )[0] || o.title;
      doc.text(titleLine, textLeft, y + 12);

      if (!preIncluded && bodyLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(OPT_BODY_PT);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(bodyLines, textLeft, y + 22);
      }

      const priceText =
        (o.priceDelta || 0) > 0
          ? "+" + money(o.priceDelta || 0, currency)
          : "No charge";

      if (preIncluded) {
        doc.setFillColor(8, 145, 178);
        doc.rect(margin + contentW - tabW, y, tabW, rowH, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text("INCLUDED", margin + contentW - tabW / 2, y + rowH / 2 + 2.5, {
          align: "center",
        });
      } else {
        doc.setFillColor(255, 247, 237);
        doc.rect(margin + contentW - tabW, y, tabW, rowH, "F");
        doc.setDrawColor(203, 213, 225);
        doc.line(
          margin + contentW - tabW,
          y,
          margin + contentW - tabW,
          y + rowH,
        );
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text(priceText, margin + contentW - 5, y + rowH / 2 + 2.5, {
          align: "right",
        });
      }

      y += rowH;
    }
  }

  setY(y + 8);
}

export async function downloadProposalPdf(p: Proposal): Promise<number> {
  const blob = await buildProposalPdfBlob(p);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = proposalPdfFileName(p);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}

function emailBody(p: Proposal): string {
  const totals = calcTotals(p, [], []);
  return [
    `Hello ${p.clientContact || "there"},`,
    "",
    `Please find your proposal from ${COMPANY.name}.`,
    "",
    `Proposal: ${p.title || p.proposalNumber || p.id}`,
    `Estimated total: ${money(totals.total, p.currency)}`,
    "",
    "This email was sent from the sales tool for testing. Attach the PDF you downloaded, or use your company mail system for production send.",
    "",
    `— ${COMPANY.shortName}`,
    COMPANY.phone,
    COMPANY.websiteLabel,
  ].join("\n");
}

export async function emailProposalPdf(
  p: Proposal,
  opts?: { to?: string },
): Promise<{
  ok: boolean;
  method: "mailto" | "share" | "none";
  message: string;
  error?: string;
}> {
  try {
    await downloadProposalPdf(p);
  } catch {
    /* still open mailto */
  }
  const to = (opts?.to || p.clientEmail || "").trim();
  const subject = encodeURIComponent(
    `${COMPANY.shortName} proposal — ${p.title || p.proposalNumber || ""}`.trim(),
  );
  const body = encodeURIComponent(emailBody(p));
  if (typeof window !== "undefined") {
    // Prefer Web Share with file when available (mobile)
    try {
      const blob = await buildProposalPdfBlob(p);
      const file = new File([blob], proposalPdfFileName(p), {
        type: "application/pdf",
      });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: p.title || "Proposal",
          text: emailBody(p),
        });
        return {
          ok: true,
          method: "share",
          message: "Shared via device share sheet.",
        };
      }
    } catch {
      /* fall through to mailto */
    }
    const href = to
      ? `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = href;
    return {
      ok: true,
      method: "mailto",
      message: "PDF downloaded and email draft opened.",
    };
  }
  return {
    ok: false,
    method: "none",
    message: "Email not available here.",
    error: "Email not available here.",
  };
}
