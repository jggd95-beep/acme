/**
 * Walk zoning paths through compileScopeAnswers. Packet text is compiled.
 * Per-zone cartesian is huge — we cover every decision type plus mixed stories.
 */
import { compileScopeAnswers, type ScopeAnswers } from "./scope-wizard";
import { equipmentLeadLines, customerInstallName } from "./equipment-scope-lead";
import { applyWarrantyToBenefits, resolveWarranty } from "./warranty";
import { liveCompany } from "./company-store";
import { ROOM_OPTS } from "./zoning-scope";
import type { Product } from "./proposal-types";

const COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
const JOBS = ["new", "replace"] as const;
const DAMPERS = ["new_each", "mix", "reuse"] as const;

export type ZoneBrand = "honeywell" | "infinity" | "both";

export type ControlStory = {
  id: string;
  label: string;
  stat: "new_wired" | "reuse" | "wireless" | "mix";
  wire: "easy" | "typical" | "hard" | "mix";
  inf?: "wireless" | "wall" | "mix" | "skip";
};

const STORIES: ControlStory[] = [
  { id: "new-typ", label: "All new wired · typical", stat: "new_wired", wire: "typical", inf: "wall" },
  { id: "reuse-easy", label: "All reuse · easy wire", stat: "reuse", wire: "easy", inf: "wall" },
  { id: "wireless", label: "All wireless", stat: "wireless", wire: "typical", inf: "wireless" },
  { id: "hard-mix", label: "Mixed — Z1 wireless, rest hard wired", stat: "mix", wire: "mix", inf: "mix" },
  { id: "inf-wire", label: "Infinity wall + new wired", stat: "new_wired", wire: "typical", inf: "wall" },
];

const ROOM_CYCLE = ROOM_OPTS.map((o) => o.id);

export type ZoningScenario = {
  id: string;
  count: number;
  brand: ZoneBrand;
  job: (typeof JOBS)[number];
  dampers: (typeof DAMPERS)[number];
  story: string;
  title: string;
  benefits: string[];
  scope: string[];
  missing: string[];
  fails: string[];
};

function zoneProduct(brand: ZoneBrand, n: number): Product {
  const inf = brand !== "honeywell";
  const name = inf
    ? `Carrier Infinity® ${n}-Zone System`
    : `Honeywell ${n}-Zone Comfort System`;
  const sku = inf ? `ZONE-INF-${n}` : `ZONE-HW-${n}`;
  return {
    id: `review_${sku}_${brand}`,
    name,
    sku,
    category: inf ? "Zoning · Carrier Infinity" : "Zoning · Honeywell",
    description: "",
    unitPrice: 1,
    unit: "system",
    materialCost: 1,
    laborHours: 1,
    familyId: inf ? "carrier-infinity-zone" : "honeywell-zone",
    equipmentKind: "other",
    benefits: [],
    options: [],
    createdAt: "",
    updatedAt: "",
  } as Product;
}

function fillControls(
  a: ScopeAnswers,
  count: number,
  story: ControlStory,
  brand: ZoneBrand,
) {
  for (let i = 1; i <= count; i++) {
    a[`zone_r${i}`] = ROOM_CYCLE[(i - 1) % ROOM_CYCLE.length];
    const stat =
      story.stat === "mix" ? (i === 1 ? "wireless" : "new_wired") : story.stat;
    const wire =
      story.wire === "mix" ? (i === 1 ? "easy" : "hard") : story.wire;
    a[`zone_s${i}_stat`] = stat;
    if (stat !== "wireless") a[`zone_s${i}_wire`] = wire;
    if (brand === "infinity" || brand === "both") {
      const inf =
        story.inf === "mix"
          ? i === 1
            ? "wireless"
            : "wall"
          : story.inf === "skip"
            ? ""
            : story.inf || "wireless";
      if (inf) a[`zone_s${i}_inf`] = inf;
    }
  }
}

function answersFor(s: {
  count: number;
  brand: ZoneBrand;
  job: string;
  dampers: string;
  story: ControlStory;
}): ScopeAnswers {
  const a: ScopeAnswers = {
    zone_count: String(s.count),
    zone_mfr: s.brand,
    zone_job: s.job,
    zone_dampers: s.dampers,
  };
  fillControls(a, s.count, s.story, s.brand);
  return a;
}

function zoningBenefits(
  n: number,
  brand: ZoneBrand,
  answers: ScopeAnswers,
): string[] {
  const lines = [
    "Acme sizes each zone to the rooms it serves so the equipment matches how you live.",
  ];
  if (brand === "infinity" || brand === "both") {
    lines.push(
      "Carrier Infinity holds each area within ½° of the setting and turns the system up and down to match.",
      "Carrier Infinity zone control matched to the equipment — full humidity control. One control operates the equipment and the zones.",
    );
  } else {
    lines.push(
      "Honeywell multi-stage operation lets the system stay unloaded when only one zone is calling — more even comfort, quieter operation.",
    );
  }
  return applyWarrantyToBenefits(
    lines,
    resolveWarranty({
      sku: brand === "honeywell" ? `ZONE-HW-${n}` : `ZONE-INF-${n}`,
      name: brand === "honeywell" ? "Honeywell zone" : "Infinity zone",
      familyId: "zoning",
    } as Product),
  ).map((l) => l.replace(/on equipment$/i, "on the zoning we install"));
}

export function assembleZoningPacket(
  brand: ZoneBrand,
  count: number,
  answers: ScopeAnswers,
): { title: string; benefits: string[]; scope: string[]; missing: string[] } {
  const product = zoneProduct(brand === "both" ? "infinity" : brand, count);
  const compiled = compileScopeAnswers("zoning", answers);
  const lead = equipmentLeadLines(product, "zoning");
  const faceTitle =
    brand === "honeywell"
      ? `Honeywell ${count}-zone comfort system`
      : brand === "both"
        ? `Honeywell + Carrier Infinity ${count}-zone system`
        : `Carrier Infinity ${count}-zone system`;
  const productLine =
    answers.zone_job === "replace"
      ? `Replace the existing zone panel with a new ${brand === "honeywell" ? `Honeywell ${count}-zone comfort system` : `Carrier Infinity ${count}-zone system`}.`
      : `Install a new ${brand === "honeywell" ? `Honeywell ${count}-zone comfort system` : brand === "both" ? `${count}-zone system — Honeywell and Infinity options` : `Carrier Infinity ${count}-zone system`}.`;
  const stamp =
    lead[0] ||
    `${liveCompany().shortName} will install a new zone system to meet manufacturer and local code requirements, with Acme’s stamp of quality.`;
  const body = (compiled.scopeLines || [])
    .map((l) => l.replace(/^\d+[\.)]\s*/, "").trim())
    .filter(Boolean)
    .filter(
      (l) =>
        !/new zone system on this equipment|Replace the existing zone panel with the new control/i.test(
          l,
        ),
    );
  void customerInstallName;
  return {
    title: faceTitle,
    benefits: zoningBenefits(count, brand, answers),
    scope: [stamp, productLine, ...body],
    missing: compiled.missingRequired || [],
  };
}

const BAD = [
  { re: /\$\d|unitPrice|material cost/i, why: "dollar amount in customer packet" },
  { re: /\brun\b/i, why: "uses the word run" },
  { re: /published (seer|hspf)/i, why: "published rating fluff" },
  { re: /dump zone/i, why: "dump zone still in packet" },
  { re: /walk the home/i, why: "walk the home" },
  { re: /sealed at the takeoff/i, why: "sealed at the takeoff" },
  { re: /cable pull/i, why: "cable pull shop talk" },
  { re: /install the zone control panel/i, why: "redundant panel line" },
  { re: /bypass from supply/i, why: "relief / bypass still in packet" },
  { re: /mechanical permit|pull a permit/i, why: "permit language in this measure" },
  { re: /\bCFM\b/, why: "CFM on a zoning packet" },
];

export function checkZoningPacket(s: {
  title: string;
  benefits: string[];
  scope: string[];
  missing: string[];
  count: number;
  job: string;
  brand: ZoneBrand;
  dampers: string;
}): string[] {
  const fails: string[] = [];
  const all = [...s.scope, ...s.benefits, s.title].join("\n");
  if (s.missing.length) fails.push("missing required: " + s.missing.join(", "));
  if (!s.scope[0] || !/stamp of quality/i.test(s.scope[0])) {
    fails.push("stamp of quality is not the first line");
  }
  if (s.job === "replace" && !/Replace the existing zone panel/i.test(s.scope[1] || "")) {
    fails.push("replace path does not say replace on line 2");
  }
  if (s.job === "new" && !/^Install a new /i.test(s.scope[1] || "")) {
    fails.push("new path does not start line 2 with Install a new");
  }
  if (!/heats and cools properly/i.test(s.scope[s.scope.length - 1] || "")) {
    fails.push("closer missing properly");
  }
  if (!s.benefits.some((b) => /warranty/i.test(b))) fails.push("no warranty in benefits");
  if (!s.benefits.some((b) => /sizes each zone/i.test(b))) {
    fails.push("no sizing / design benefit first");
  }
  if (s.benefits.some((b) => /damper/i.test(b))) fails.push("damper reprint in benefits");
  if (s.benefits.some((b) => /own temperature control/i.test(b))) {
    fails.push("temperature reprint in benefits");
  }
  if (/[()]|~/.test(s.title) && !/\+/.test(s.title)) fails.push("title has parentheses or tilde");
  if (!s.scope.some((l) => /Zone 1 in /i.test(l))) fails.push("rooms are not labeled Zone 1 in …");
  if (
    (s.dampers === "reuse" || s.dampers === "mix") &&
    !s.scope.some((l) => /not covered by the Acme contract warranty/i.test(l))
  ) {
    fails.push("existing-damper path missing warranty note");
  }
  if (s.dampers === "new_each" && s.scope.some((l) => /not covered by the Acme contract warranty/i.test(l))) {
    fails.push("new dampers should not carry the existing-damper note");
  }
  for (const b of BAD) {
    if (b.re.test(all)) fails.push(b.why);
  }
  if (s.scope.length < 5) fails.push("work scope too thin");
  if (s.scope.length > 18) fails.push("work scope too long / redundant");
  return fails;
}

export function allZoningScenarios(): ZoningScenario[] {
  const out: ZoningScenario[] = [];
  for (const count of COUNTS) {
    const brands: ZoneBrand[] =
      count === 3 || count === 4
        ? ["honeywell", "infinity", "both"]
        : ["infinity"];
    for (const brand of brands) {
      for (const job of JOBS) {
        for (const dampers of DAMPERS) {
          for (const story of STORIES) {
            if (story.id === "inf-wire" && brand === "honeywell") continue;
            const answers = answersFor({ count, brand, job, dampers, story });
            const pack = assembleZoningPacket(brand, count, answers);
            const row: ZoningScenario = {
              id: `${brand}-${count}-${job}-${dampers}-${story.id}`,
              count,
              brand,
              job,
              dampers,
              story: story.label,
              ...pack,
              fails: [],
            };
            row.fails = checkZoningPacket(row);
            out.push(row);
          }
        }
      }
    }
  }
  return out;
}

export function zoningReviewSummary(list: ZoningScenario[]) {
  const failed = list.filter((s) => s.fails.length);
  const byFail: Record<string, number> = {};
  for (const s of failed) {
    for (const f of s.fails) byFail[f] = (byFail[f] || 0) + 1;
  }
  return {
    total: list.length,
    passed: list.length - failed.length,
    failed: failed.length,
    byFail,
  };
}
