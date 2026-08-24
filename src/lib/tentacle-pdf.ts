import { jsPDF } from "jspdf";
import { MEASURE_FAMILIES } from "./quote-wizard";
import { tentacleForest, type TentacleNode } from "./tentacle-tree";

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW) as string[];
}

export function downloadTentaclesPdf() {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const bottom = pageH - 28;
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
  doc.rect(0, 0, pageW, 52, "F");
  doc.setTextColor(153, 246, 228);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TENTACLES", margin, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Whole-app path map", margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(stamp, pageW - margin, 40, { align: "right" });
  y = 68;

  const drawNode = (node: TentacleNode, indent: number) => {
    const maxW = pageW - margin * 2 - indent;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const ask = wrap(doc, "ASK  " + node.prompt, maxW);
    need(ask.length * 13 + 8);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin + indent, y, maxW, ask.length * 13 + 10, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    ask.forEach((line, i) => {
      doc.text(line, margin + indent + 8, y + 14 + i * 13);
    });
    y += ask.length * 13 + 16;

    for (const o of node.options) {
      const label = o.next.length
        ? `${o.label}  → ${o.next.length} more`
        : `${o.label}  (ends)`;
      doc.setFont("helvetica", o.next.length ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(o.next.length ? 15 : 71, o.next.length ? 23 : 85, o.next.length ? 42 : 105);
      const lines = wrap(doc, "•  " + label, maxW - 10);
      need(lines.length * 13 + 4);
      lines.forEach((line) => {
        doc.text(line, margin + indent + 14, y + 10);
        y += 13;
      });
      y += 4;
      for (const child of o.next) drawNode(child, indent + 22);
    }
  };

  for (const f of MEASURE_FAMILIES) {
    const forest = tentacleForest(f.id);
    const title = f.label.split("(")[0].trim();
    need(36);
    doc.setFillColor(204, 251, 241);
    doc.roundedRect(margin, y, pageW - margin * 2, 26, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 10, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const tag = forest.mapped
      ? forest.trunk.length
        ? `${forest.trunk.length} starting ask${forest.trunk.length === 1 ? "" : "s"}`
        : "mapped · no live questions"
      : "not mapped yet";
    doc.text(tag, pageW - margin - 10, y + 17, { align: "right" });
    y += 34;

    if (!forest.mapped || !forest.trunk.length) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(
        forest.mapped ? "No live questions on this tree." : "On the sales tool. Question tree not built yet.",
        margin + 8,
        y + 10,
      );
      y += 22;
      continue;
    }
    for (const n of forest.trunk) drawNode(n, 0);
    y += 10;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Acme HVAC · manager copy · no PIN required yet", margin, pageH - 14);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 14, { align: "right" });
  }

  const file = `TENTACLES-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(file);
}
