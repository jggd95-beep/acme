import { jsPDF } from "jspdf";
import {
  allZoningScenarios,
  zoningReviewSummary,
  type ZoningScenario,
} from "./zoning-review";

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW) as string[];
}

export function buildZoningReviewPdf() {
  const list = allZoningScenarios();
  const sum = zoningReviewSummary(list);
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const bottom = pageH - 32;
  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };
  const need = (h: number) => {
    if (y + h > bottom) newPage();
  };

  const stamp = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 58, "F");
  doc.setTextColor(153, 246, 228);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ZONING · CUSTOMER PACKET", margin, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Every question path — compiled, not invented", margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(stamp, pageW - margin, 42, { align: "right" });
  y = 76;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    `${sum.total} packets · ${sum.passed} passed · ${sum.failed} failed`,
    margin,
    y,
  );
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const intro = wrap(
    doc,
    "Each box is one complete walk: zone count, Honeywell or Infinity, new vs replace, dampers, relief, stats, and wire. Work scope and benefits come from compileScopeAnswers. Rooms are Zone 1–n in order so you can see the labels. If a box failed our rules it is marked FAIL.",
    pageW - margin * 2,
  );
  intro.forEach((line) => {
    doc.text(line, margin, y);
    y += 12;
  });
  y += 10;

  const drawCard = (s: ZoningScenario) => {
    const scope = s.scope.map((l, i) => `${i + 1}. ${l}`);
    const ben = s.benefits.map((l) => "•  " + l);
    const head = `${s.count} zone · ${s.brand} · ${s.job} · ${s.dampers} · ${s.story}`;
    const headLines = wrap(doc, head, pageW - margin * 2 - 16);
    const titleLines = wrap(doc, s.title, pageW - margin * 2 - 16);
    const scopeLines = scope.flatMap((l) => wrap(doc, l, pageW - margin * 2 - 20));
    const benLines = ben.flatMap((l) => wrap(doc, l, pageW - margin * 2 - 20));
    const h =
      18 +
      headLines.length * 11 +
      titleLines.length * 13 +
      scopeLines.length * 11 +
      benLines.length * 11 +
      28;
    need(Math.min(h, pageH - margin - 20));
    if (y + 80 > bottom) newPage();

    const fail = s.fails.length > 0;
    const startY = y + 8;
    y = startY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(fail ? 153 : 13, fail ? 27 : 148, fail ? 27 : 136);
    headLines.forEach((line) => {
      doc.text(line, margin + 8, y + 8);
      y += 11;
    });
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    titleLines.forEach((line) => {
      doc.text(line, margin + 8, y + 8);
      y += 13;
    });
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("WORK SCOPE", margin + 8, y + 8);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    scopeLines.forEach((line) => {
      need(14);
      doc.text(line, margin + 8, y + 8);
      y += 11;
    });
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("BENEFITS", margin + 8, y + 8);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    benLines.forEach((line) => {
      need(14);
      doc.text(line, margin + 8, y + 8);
      y += 11;
    });
    if (fail) {
      y += 4;
      doc.setTextColor(153, 27, 27);
      doc.setFont("helvetica", "bold");
      wrap(doc, "FAIL  " + s.fails.join(" · "), pageW - margin * 2 - 16).forEach(
        (line) => {
          need(12);
          doc.text(line, margin + 8, y + 8);
          y += 11;
        },
      );
    }
    y += 10;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  for (const s of list) drawCard(s);
  return { doc, ...sum };
}

export function downloadZoningReviewPdf() {
  const { doc, ...sum } = buildZoningReviewPdf();
  const file = `ZONING-PACKETS-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
  return { file, ...sum };
}
