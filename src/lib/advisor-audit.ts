/**
 * Manager audit trail — what the comfort advisor did on a quote.
 * Used to catch corner-cutting, train sales, and review commissions after sign-off.
 */
import type { Product, Proposal, QuoteLine, SignatureRecord } from "./proposal-types";
import { calcTotals, normalizeLine } from "./proposal-types";
import { formatCurrency } from "./utils";
/** Minimal wizard shape for audit (avoids circular import with quote-wizard). */
export type WizardAuditInput = {
  discountPercent?: number;
  heatingPath?: string;
  goals?: string[];
  paymentTerms?: string;
  padMode?: string;
  measureAdjustments?: Record<
    string,
    { extraLaborHours?: number; extraMaterialCost?: number }
  >;
  measureInstances?: {
    id: string;
    productId?: string | null;
    scopeAnswers?: Record<string, unknown>;
  }[];
};

export type AuditFlagSeverity = "info" | "watch" | "alert";

export type AuditFlag = {
  id: string;
  severity: AuditFlagSeverity;
  title: string;
  detail: string;
};

export type MeasureAuditRow = {
  lineId: string;
  name: string;
  role: string;
  optional: boolean;
  productId: string | null;
  sku: string | null;
  /** Catalog list sell (if product found) */
  catalogUnitPrice: number | null;
  /** Price on the quote line */
  quoteUnitPrice: number;
  /** Delta quote − catalog (positive = higher sell; negative = cut) */
  priceDelta: number | null;
  catalogLaborHours: number | null;
  quoteLaborHours: number;
  laborDelta: number | null;
  catalogMaterialCost: number | null;
  quoteMaterialCost: number;
  materialDelta: number | null;
  /** Nested options offered / selected on line */
  options: {
    id: string;
    title: string;
    priceDelta: number;
    selected: boolean;
  }[];
  /** Scope / site answer summary if stored */
  scopeSummary: string[];
  extraLaborFromScope: number;
  extraMaterialFromScope: number;
  languageCustomized: boolean;
  workScopePreview: string;
  benefitsCount: number;
  catalogWorkScope: string;
  quoteWorkScope: string;
  scopeLinesRemoved: string[];
  scopeLinesAdded: string[];
};

export type AdvisorAuditReport = {
  version: 1;
  generatedAt: string;
  proposalId: string;
  proposalNumber: string;
  title: string;
  status: string;
  clientName: string;
  propertyLine: string;
  salespersonName: string;
  salespersonEmail: string;
  salespersonSignedAt: string | null;
  customerSignedAt: string | null;
  customerSignerName: string | null;
  /** Snapshot of wizard commercial choices when available */
  discountDollars: number;
  discountPercentEstimate: number | null;
  showMeasurePrices: boolean;
  taxRate: number;
  packageSubtotal: number;
  finalTotal: number | null;
  amountDueNow: number | null;
  financingSelected: string | null;
  customerSelectedOptionalIds: string[];
  customerSelectedNestedKeys: string[];
  measures: MeasureAuditRow[];
  flags: AuditFlag[];
  /** Freeform notes for manager */
  managerNotes?: string;
  /** Raw wizard crumbs when finish() stored them */
  wizardSnapshot?: {
    discountPercent?: number;
    heatingPath?: string;
    goals?: string[];
    paymentTerms?: string;
    padMode?: string;
    measureCount?: number;
    optionalMeasureCount?: number;
  } | null;
};

function money(n: number) {
  return formatCurrency(n);
}

function productById(
  products: Product[],
  id: string | null | undefined,
): Product | undefined {
  if (!id) return undefined;
  return products.find((p) => p.id === id);
}

function copyLines(raw: string): string[] {
  return String(raw || "")
    .split(/\n+/)
    .map((s) => s.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

function lineKey(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function languageCustomized(line: QuoteLine, product: Product | undefined): boolean {
  if (!product) return Boolean(line.benefits?.length || line.workScope);
  const nameDiff = (line.name || "").trim() !== (product.name || "").trim();
  const scopeDiff =
    (line.workScope || "").trim() !== (product.workScope || "").trim();
  const bLine = JSON.stringify(line.benefits || []);
  const bProd = JSON.stringify(product.benefits || []);
  return nameDiff || scopeDiff || bLine !== bProd;
}

/**
 * Build a full manager audit from a proposal (+ catalog for baselines).
 * Optionally merge wizard answers when finishing a quote.
 */
export function buildAdvisorAuditReport(
  proposal: Proposal,
  products: Product[],
  wizard?: Partial<WizardAuditInput> | null,
): AdvisorAuditReport {
  const lines = (proposal.lineItems || []).map(normalizeLine);
  const productMap = new Map(products.map((p) => [p.id, p]));

  const selectedOptIds = new Set(proposal.signature?.selectedOptionalIds || []);
  const selectedNested = proposal.signature?.selectedNestedOptionKeys || [];

  const measures: MeasureAuditRow[] = lines.map((line) => {
    const product = line.productId
      ? productMap.get(line.productId)
      : undefined;
    const catalogUnit = product != null ? Number(product.unitPrice) || 0 : null;
    const quoteUnit = Number(line.unitPrice) || 0;
    const catHrs = product != null ? Number(product.laborHours) || 0 : null;
    const quoteHrs = Number(line.laborHours) || 0;
    const catMat = product != null ? Number(product.materialCost) || 0 : null;
    const quoteMat = Number(line.materialCost) || 0;

    // Scope extras stored only on wizard snapshot if present
    const instId = line.id.replace(/^li_/, "");
    const scopeAdj = wizard?.measureAdjustments?.[instId] ||
      wizard?.measureAdjustments?.[line.productId || ""] || {
        extraLaborHours: 0,
        extraMaterialCost: 0,
      };
    const scopeAnswers =
      wizard?.measureInstances?.find((m) => m.id === instId || m.productId === line.productId)
        ?.scopeAnswers || {};
    const scopeSummary = Object.entries(scopeAnswers)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);

    const selectedIds = new Set(line.selectedOptionIds || []);
    const options = (line.options || []).map((o) => ({
      id: o.id,
      title: o.title,
      priceDelta: Number(o.priceDelta) || 0,
      selected: selectedIds.has(o.id),
    }));

    const quoteScope = line.workScope || "";
    const catalogScope = product?.workScope || "";
    const qLines = copyLines(quoteScope);
    const cLines = copyLines(catalogScope);
    const qKeys = new Set(qLines.map(lineKey));
    const cKeys = new Set(cLines.map(lineKey));
    const scopeLinesRemoved = cLines.filter((l) => !qKeys.has(lineKey(l)));
    const scopeLinesAdded = qLines.filter((l) => !cKeys.has(lineKey(l)));

    return {
      lineId: line.id,
      name: line.name,
      role: line.role || (line.optional ? "optional" : "included"),
      optional: Boolean(line.optional || line.role === "optional"),
      productId: line.productId,
      sku: product?.sku || null,
      catalogUnitPrice: catalogUnit,
      quoteUnitPrice: quoteUnit,
      priceDelta:
        catalogUnit != null
          ? Math.round((quoteUnit - catalogUnit) * 100) / 100
          : null,
      catalogLaborHours: catHrs,
      quoteLaborHours: quoteHrs,
      laborDelta:
        catHrs != null ? Math.round((quoteHrs - catHrs) * 100) / 100 : null,
      catalogMaterialCost: catMat,
      quoteMaterialCost: quoteMat,
      materialDelta:
        catMat != null ? Math.round((quoteMat - catMat) * 100) / 100 : null,
      options,
      scopeSummary,
      extraLaborFromScope: Number(scopeAdj.extraLaborHours) || 0,
      extraMaterialFromScope: Number(scopeAdj.extraMaterialCost) || 0,
      languageCustomized: languageCustomized(line, product),
      workScopePreview: (line.workScope || "").slice(0, 280),
      benefitsCount: (line.benefits || []).filter(Boolean).length,
      catalogWorkScope: catalogScope,
      quoteWorkScope: quoteScope,
      scopeLinesRemoved,
      scopeLinesAdded,
    };
  });

  const totals = calcTotals(proposal, [...selectedOptIds], selectedNested);
  const packageSubtotal = totals.subtotal;
  const discount = Number(proposal.discount) || 0;
  const discountPct =
    packageSubtotal > 0
      ? Math.round((discount / packageSubtotal) * 1000) / 10
      : wizard?.discountPercent ?? null;

  const flags = buildAuditFlags({
    proposal,
    measures,
    discount,
    discountPct: discountPct ?? 0,
    packageSubtotal,
    wizard,
  });

  const propertyLine = [
    proposal.propertyStreet,
    proposal.propertyCity,
    proposal.propertyState,
    proposal.propertyZip,
  ]
    .filter(Boolean)
    .join(", ");

  const optionalCount = measures.filter((m) => m.optional).length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    proposalId: proposal.id,
    proposalNumber: proposal.proposalNumber || proposal.id.slice(0, 8),
    title: proposal.title,
    status: proposal.status,
    clientName:
      proposal.clientContact || proposal.clientCompany || "Customer",
    propertyLine,
    salespersonName: proposal.salesperson?.name || "—",
    salespersonEmail: proposal.salesperson?.email || "",
    salespersonSignedAt: proposal.salesperson?.signedAt || null,
    customerSignedAt: proposal.signature?.signedAt || null,
    customerSignerName: proposal.signature?.signerName || null,
    discountDollars: discount,
    discountPercentEstimate:
      discountPct != null && Number.isFinite(discountPct) ? discountPct : null,
    showMeasurePrices: Boolean(proposal.showMeasurePrices),
    taxRate: Number(proposal.taxRate) || 0,
    packageSubtotal,
    finalTotal: proposal.signature?.finalTotal ?? totals.total,
    amountDueNow: proposal.signature?.amountDueNow ?? null,
    financingSelected: proposal.signature?.selectedFinancingId || null,
    customerSelectedOptionalIds: [...selectedOptIds],
    customerSelectedNestedKeys: selectedNested,
    measures,
    flags,
    wizardSnapshot: wizard
      ? {
          discountPercent: wizard.discountPercent,
          heatingPath: wizard.heatingPath,
          goals: wizard.goals,
          paymentTerms: wizard.paymentTerms,
          padMode: wizard.padMode,
          measureCount: measures.length,
          optionalMeasureCount: optionalCount,
        }
      : proposal.advisorAudit?.wizardSnapshot || null,
  };
}

function buildAuditFlags(input: {
  proposal: Proposal;
  measures: MeasureAuditRow[];
  discount: number;
  discountPct: number;
  packageSubtotal: number;
  wizard?: Partial<WizardAuditInput> | null;
}): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const { measures, discount, discountPct, packageSubtotal, proposal } = input;

  if (discountPct >= 15) {
    flags.push({
      id: "discount_high",
      severity: "alert",
      title: "High discount",
      detail: `${discountPct}% off package (${money(discount)} on ${money(packageSubtotal)}). Review commission impact.`,
    });
  } else if (discountPct >= 8) {
    flags.push({
      id: "discount_watch",
      severity: "watch",
      title: "Meaningful discount",
      detail: `${discountPct}% / ${money(discount)}. Confirm manager approval if required.`,
    });
  }

  for (const m of measures) {
    if (m.role === "info") continue;

    // Sell below catalog
    if (m.priceDelta != null && m.priceDelta < -50) {
      flags.push({
        id: `price_cut_${m.lineId}`,
        severity: m.priceDelta < -500 ? "alert" : "watch",
        title: `Sell price below catalog — ${m.name}`,
        detail: `Quote ${money(m.quoteUnitPrice)} vs catalog ${money(m.catalogUnitPrice || 0)} (${money(m.priceDelta)}).`,
      });
    }

    // Labor cut vs catalog
    if (m.laborDelta != null && m.laborDelta < -0.5) {
      flags.push({
        id: `labor_cut_${m.lineId}`,
        severity: m.laborDelta <= -2 ? "alert" : "watch",
        title: `Labor hours reduced — ${m.name}`,
        detail: `Quote ${m.quoteLaborHours} hr vs catalog ${m.catalogLaborHours} hr (${m.laborDelta} hr). Possible corner-cutting.`,
      });
    }

    // Material reduced (should be rare — we forbid reduce in UI but audit catches it)
    if (m.materialDelta != null && m.materialDelta < -1) {
      flags.push({
        id: `mat_cut_${m.lineId}`,
        severity: "alert",
        title: `Material cost reduced — ${m.name}`,
        detail: `Quote ${money(m.quoteMaterialCost)} vs catalog ${money(m.catalogMaterialCost || 0)}.`,
      });
    }

    if (m.scopeLinesRemoved?.length) {
      flags.push({
        id: `scope_cut_${m.lineId}`,
        severity: m.scopeLinesRemoved.length >= 2 ? "alert" : "watch",
        title: `Work scope shortened — ${m.name}`,
        detail: `Advisor removed ${m.scopeLinesRemoved.length} catalog line(s): ${m.scopeLinesRemoved
          .slice(0, 3)
          .join(" · ")}`,
      });
    } else if (m.languageCustomized) {
      flags.push({
        id: `scope_edit_${m.lineId}`,
        severity: "info",
        title: `Language edited — ${m.name}`,
        detail:
          m.scopeLinesAdded.length
            ? `Added ${m.scopeLinesAdded.length} work-scope line(s).`
            : "Title, benefits, or work scope differs from catalog.",
      });
    }
    if (
      m.optional &&
      /heat pump|furnace|air handler|condenser|ductless|mini-?split/i.test(
        m.name,
      )
    ) {
      flags.push({
        id: `major_optional_${m.lineId}`,
        severity: "watch",
        title: `Measure marked optional — ${m.name}`,
        detail:
          "Core equipment as optional can suppress package total until customer checks it. Confirm intent.",
      });
    }
  }

  if (!proposal.showMeasurePrices) {
    flags.push({
      id: "prices_hidden",
      severity: "info",
      title: "Line prices hidden on customer packet",
      detail: "Customer sees Included for package measures (commercials toggle).",
    });
  }

  const optionalCount = measures.filter((m) => m.optional).length;
  if (optionalCount >= 4) {
    flags.push({
      id: "many_optionals",
      severity: "info",
      title: "Many optional measures",
      detail: `${optionalCount} optional lines — verify customer can understand choices at signing.`,
    });
  }

  if (proposal.status === "signed" || proposal.signature) {
    flags.push({
      id: "signed_review",
      severity: "info",
      title: "Customer signed — final review",
      detail: `Signer: ${proposal.signature?.signerName || "—"}. Final total: ${money(proposal.signature?.finalTotal || 0)}.`,
    });
  }

  // Sort alerts first
  const order = { alert: 0, watch: 1, info: 2 };
  flags.sort((a, b) => order[a.severity] - order[b.severity]);
  return flags;
}

/** Refresh audit after signing ceremony (customer selections). */
export function refreshAuditAfterSignature(
  proposal: Proposal,
  products: Product[],
  previous?: AdvisorAuditReport | null,
): AdvisorAuditReport {
  const base = buildAdvisorAuditReport(proposal, products, null);
  return {
    ...base,
    wizardSnapshot: previous?.wizardSnapshot || base.wizardSnapshot,
    // Keep pre-sign measure rows if richer; else use rebuilt
    measures: base.measures,
  };
}

export function auditFlagCounts(report: AdvisorAuditReport): {
  alert: number;
  watch: number;
  info: number;
} {
  return {
    alert: report.flags.filter((f) => f.severity === "alert").length,
    watch: report.flags.filter((f) => f.severity === "watch").length,
    info: report.flags.filter((f) => f.severity === "info").length,
  };
}

export function formatAuditSummaryLine(report: AdvisorAuditReport): string {
  const c = auditFlagCounts(report);
  const parts = [];
  if (c.alert) parts.push(`${c.alert} alert`);
  if (c.watch) parts.push(`${c.watch} watch`);
  if (!parts.length) parts.push("clean");
  return `${report.salespersonName} · ${parts.join(", ")} · ${money(report.finalTotal || report.packageSubtotal)}`;
}
