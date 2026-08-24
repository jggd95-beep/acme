/**
 * Customer packet packages — one honest story per real path.
 */
import type { Product, ProductOption, Proposal, QuoteLine } from "./proposal-types";
import { customerMeasures, SAMPLE_PRODUCTS } from "./proposal-types";
import { buildTierPacketPackages } from "./tier-packages";
import { resolveProductPhotoUrl, shouldShowProductPhoto } from "./product-photos";
import { COMPANY } from "./company";

export type PacketAddOn = {
  name: string;
  optional: boolean;
  price?: number;
};
export type PackageRank = "good" | "better" | "best" | "plus";
export type PacketPhoto = { url: string; label: string };
export type PacketOptionalProduct = {
  name: string;
  why: string;
  price: number;
  photo?: PacketPhoto;
};
export type PacketPackageCard = {
  letter: string;
  label: string;
  badge: string;
  headline: string;
  why: string;
  points: string[];
  items: string[];
  recommended?: boolean;
  price?: number;
  rebateInstant?: number;
  rebateDeferred?: number;
  priceAfterRebates?: number;
  rebateHighlight?: string;
  includedInEvery?: string[];
  addOns?: PacketAddOn[];
  optionalProducts?: PacketOptionalProduct[];
  rank?: PackageRank;
  rankLabel?: string;
  popular?: boolean;
  subtitle?: string;
  photos?: PacketPhoto[];
  warrantyLine?: string;
  selectKey?: string;
  outdoorSku?: string;
  indoorSku?: string;
  blurb?: string;
};

var BRAND_STORY = {
	headline: "East Bay comfort, built the right way since 1929",
	subhead: "Nearly a century in Berkeley. Neighbors first. Clear scope. Real warranties. No mystery invoices.",
	sinceLine: `Family-rooted heating & air for the ${COMPANY.serviceArea} since ${COMPANY.since}`,
	promise: "This proposal is written so you can see exactly what we install, why it helps your home, and what it costs — before you sign. No bait-and-switch line items. No disappearing after install day.",
	pillars: [
		{
			title: "Almost 100 years here",
			body: `We've served East Bay homes from ${COMPANY.addressLine1} since ${COMPANY.since}. We're not a pop-up crew that vanishes when the job gets hard.`
		},
		{
			title: "Scope you can read",
			body: "Every measure lists benefits and work steps side by side. Optional upgrades stay optional until you check them — and your total updates live when you sign."
		},
		{
			title: "Right-sized, not oversold",
			body: "Load-aware design and matched equipment so you're not paying for tonnage you don't need — or suffering with a system that's too small."
		},
		{
			title: "Warranty that means something",
			body: "Manufacturer parts coverage (e.g. Carrier 10-year) plus Acme HVAC labor protection on the work we stand behind."
		}
	],
	differentiators: [
		{
			them: "Low bid, vague “install included”",
			us: "Itemized measures with work scope you can follow"
		},
		{
			them: "Pressure to decide same day",
			us: "Clear options you control at e-sign — no surprise add-ons"
		},
		{
			them: "Unknown subcontractors",
			us: "Acme HVAC team, local address, CSLB on every page"
		},
		{
			them: "Gone after final payment",
			us: "Labor warranty path + service relationship that lasts"
		}
	],
	process: [
		{
			step: "1",
			title: "Review this plan",
			body: "Read benefits, work scope, and options for your home."
		},
		{
			step: "2",
			title: "Choose what fits",
			body: "Check only the upgrades you want. Totals update live."
		},
		{
			step: "3",
			title: "Sign with confidence",
			body: "E-sign locks scope, price path, and warranty terms."
		},
		{
			step: "4",
			title: "We install & stand behind it",
			body: "Permits, commissioning, walkthrough, and warranty support."
		}
	],
	signCloser: {
		title: "Why homeowners sign with Acme HVAC",
		body: "You're not buying a box off a truck — you're choosing a local contractor who writes the work down, prices the options honestly, and still answers the phone after the install. That is the difference between a receipt and a relationship.",
		cta: "When you're ready, check the options you want and sign. We'll take care of the rest."
	},
	trustChips: [
		`Est. ${COMPANY.since}`,
		`${COMPANY.serviceArea} locals`,
		`CSLB ${COMPANY.contractorLicense}`,
		COMPANY.phone,
		COMPANY.websiteLabel
	]
};
function defaultExecutiveSummary(clientFirstName?: string) {
	const who = clientFirstName?.trim() || "your family";
	return `Thank you for inviting ${COMPANY.shortName} into your home. This plan is written for ${who} — not a generic template. Below you'll find each measure with real benefits, a clear work scope, and optional upgrades you control. ` + BRAND_STORY.promise + ` We've been the East Bay's neighbors since ${COMPANY.since}; our job is to make your comfort investment feel obvious, fair, and lasting.`;
}
function isBakedIntoPackage(name: string) {
	return /load calc|load calculation|conversion language|what changes|what to expect|rebate|maintenance|startup package|^install$/i.test(name || "");
}
var MAJOR_RE = /heat pump|furnace|air handler|air condition|\bac\b|coil|ductless|mini.?split|water heater|tankless|hpwh|wall heater|wall furnace|monterey|package unit|bath fan|whispergreen|whisperceiling|whispersense/i;
var SKIP_NAME_RE = /permit|load calc|load calculation|conversion language|what to expect|what changes|rebate|maintenance|startup package/i;
function isMajorLine(line: QuoteLine) {
	if (line.role === "info" || line.role === "parked") return false;
	const blob = `${line.name} ${line.description || ""}`;
	if (SKIP_NAME_RE.test(blob)) return false;
	return MAJOR_RE.test(blob);
}
var ACCESSORY_NAME_RE = /filter|thermostat|ecobee|nest|media|april|humidifier|uv |iaq|comfort valve|expansion|stand|earthquake|strap|pad|sound wall|disguise/i;
function isPacketProductLine(line: QuoteLine) {
	if (line.role === "info" || line.role === "parked") return false;
	const blob = `${line.name} ${line.description || ""}`;
	if (SKIP_NAME_RE.test(blob) || isBakedIntoPackage(line.name)) return false;
	return isMajorLine(line) || ACCESSORY_NAME_RE.test(blob);
}
function lineIsOptional(line: QuoteLine) {
	return Boolean(line.optional) || line.role === "optional";
}
function shortName(s: string) {
	return (s || "").replace(/\s+/g, " ").trim();
}
function cleanUpgradeTitle(opt: ProductOption) {
	return shortName((opt.title || "").replace(/^Option:\s*/i, ""));
}
function friendlyGear(raw: string) {
	let s = shortName(raw).replace(/\s*\((NG|LP|Natural Gas)\)\s*/gi, "").replace(/\s*Natural Gas\s*/gi, " ").replace(/\s+/g, " ").trim();
	s = s.replace(/Williams\s+Monterey\s+([\d,]+)\s*BTU\s+Top-Vent\s+Wall Furnace/i, "Williams $1 BTU wall heater");
	s = s.replace(/Williams\s+([\d,]+)\s*BTU\s+Direct-?Vent/i, "Williams $1 BTU direct-vent wall heater");
	s = s.replace(/City\s*\/\s*County Permit Package/i, "Permits handled");
	if (/mini-?split|ductless/i.test(s)) s = s.replace(/\(1-to-1\)/gi, "").replace(/Mini-Split Outdoor/gi, "ductless heat pump").replace(/Mini-Split/gi, "ductless heat pump").replace(/\b(\d{1,2})k\b/gi, "$1,000 BTU").replace(/·\s*~\s*\d+(?:\.\d+)?\s*ton class/gi, "").replace(/·\s*distribution box/gi, "").replace(/\(\s*(\d+)-zone\s*\)/gi, "$1-zone").replace(/Multi-Zone\s+ductless heat pump\s+(\d+)-zone/gi, "$1-zone ductless heat pump").replace(/\s{2,}/g, " ").replace(/\s+·\s*$/g, "").replace(/\s+\(\s*\)/g, "").trim();
	return s;
}
function kindOf(name: string) {
	const n = name.toLowerCase();
	if (/sanden|sanco2/.test(n)) return "wh_sanden";
	if (/tankless|npe-|on-demand/.test(n)) return "wh_tl";
	if (/heat pump water|hpwh|voltex|hybrid water/.test(n)) return "wh_hp";
	if (/high.?eff|condensing|power.?vent/.test(n) && /water|gal/.test(n)) return "wh_he";
	if (/water heater|\bgallon\b|\bgal\b|proline/.test(n) && !/heat pump|air handler|furnace/.test(n)) return "wh_tank";
	if (/wall heater|wall furnace|monterey|direct.?vent|top-vent/.test(n)) return "wall";
	if (
		/mini.?split|ductless|\bmuz-|\bmsz-|\bmfz-|\bmlz-|\bsez-|\bsvz-|\bmxz-|38marb|38mura|37maha|37mpra|37mgr|40mah|40mb|45mph|45mah/i.test(n)
	)
		return "ductless";
	if (/heat pump/.test(n)) return "hp";
	if (/\bac\b|air condition|condenser/.test(n) && !/heat pump/.test(n)) return "ac";
	if (/furnace|80%|96%/.test(n) && !/wall/.test(n)) return "furnace";
	if (/air handler|fan coil/.test(n)) return "ah";
	return "other";
}
function isWh(k: ReturnType<typeof kindOf>) {
	return k === "wh_tank" || k === "wh_he" || k === "wh_tl" || k === "wh_hp" || k === "wh_sanden";
}
function pointFor(kind: ReturnType<typeof kindOf>) {
	switch (kind) {
		case "wh_sanden": return "Sanden SANCO2 — tank plus outdoor heat pump, not a gas tank";
		case "wh_tl": return "On-demand hot water — no tank to run out on back-to-back showers";
		case "wh_hp": return "Heat-pump water heating that cuts the operating cost of a tank";
		case "wh_he": return "High-efficiency tank — more hot water per therm, PVC vent";
		case "wh_tank": return "New gas tank, connected and started to code";
		case "wall": return "Dedicated heat in the room that actually gets used";
		case "furnace": return "Whole-home gas heat sized for this house";
		case "hp": return "Matched heat pump — heat and cool from one outdoor unit";
		case "ac": return "Right-sized cooling for the load we measured";
		case "ductless": return "Zone comfort without a full duct rebuild";
		case "ah": return "Indoor air handler matched to that outdoor unit";
		default: return "Installed to code with Acme’s stamp of quality";
	}
}
function conversionOn(p: Proposal | null | undefined) {
	if (!p) return false;
	const a = p.wizardSnapshot?.answers;
	if (a?.heatingPath === "heat_pump_conversion") return true;
	if (a?.activeJobGoalId === "hp_conversion") return true;
	if ((a?.goals || []).includes("hp_conversion")) return true;
	return (p.lineItems || []).some((l: QuoteLine) => /gas furnace vs heat pump|heat pump conversion|what changes|conversion language/i.test(`${l.name} ${l.description || ""}`));
}
function orderedKinds(lines: QuoteLine[]) {
	const raw = lines.map((l: QuoteLine) => kindOf(l.name)).filter((k: string) => k !== "other");
	const rank: Record<string, number> = {
		hp: 0,
		furnace: 1,
		ac: 1,
		ductless: 1,
		wh_tl: 2,
		wh_hp: 2,
		wh_he: 2,
		wh_tank: 2,
		wh_sanden: 2,
		wall: 3,
		ah: 4,
		other: 9
	};
	return Array.from(new Set(raw)).sort((a, b) => rank[a] - rank[b]);
}
function storyFor(lines: QuoteLine[], role: string, conversion: boolean) {
	const kinds = orderedKinds(lines);
	const has = (k: ReturnType<typeof kindOf>) => kinds.includes(k);
	const hasAnyWh = kinds.some(isWh);
	const points = [];
	if (conversion && has("hp")) points.push("Convert the house off the old gas heat path onto a matched heat pump");
	for (const k of kinds) {
		if (conversion && k === "hp") continue;
		const pt = pointFor(k);
		if (!points.includes(pt)) points.push(pt);
		if (points.length >= 3) break;
	}
	if (points.length < 3) points.push("Permits, startup, and workmanship stay with Acme");
	const clipped = points.slice(0, 3);
	if (conversion && has("hp") && hasAnyWh) {
		const whWord = has("wh_tl")
			? "tankless"
			: has("wh_sanden")
				? "Sanden SANCO2"
				: has("wh_hp")
					? "heat-pump water heater"
					: "gas tank";
		return {
			badge: role === "upgrade" ? "Upgrade" : "Recommended",
			headline: role === "upgrade" ? `Stepped-up heat pump + ${whWord}` : `Heat pump conversion + new ${whWord}`,
			why: "One visit. We convert the heating system and replace the water heater — same crew, one permit path.",
			points: clipped,
			recommended: role === "main"
		};
	}
	if (conversion && has("hp")) return {
		badge: role === "upgrade" ? "Upgrade" : "Recommended",
		headline: role === "upgrade" ? "Stepped-up heat pump conversion" : "Heat pump conversion",
		why: "We take this house off the old gas heat and set a matched heat pump with the indoor air handler.",
		points: clipped,
		recommended: role === "main"
	};
	if (has("wh_tank") && has("wall")) return {
		badge: role === "upgrade" ? "Upgrade" : "Recommended",
		headline: role === "value" ? "Solid hot water + the same room heat" : "Hot water and room heat, done as a pair",
		why: "One visit covers the tank and the wall heater — the two things that make this house comfortable.",
		points: clipped,
		recommended: role === "main"
	};
	if (has("wh_tl") && !has("hp") && !has("furnace") && !has("ac")) return {
		badge: role === "main" ? "Recommended" : "On-demand",
		headline: "Endless hot water",
		why: "Tankless when the house runs showers back to back — no tank sitting in the garage.",
		points: clipped,
		recommended: role === "main"
	};
	if (has("wh_sanden") && !has("hp") && !has("furnace")) return {
		badge: "Sanden",
		headline: "Sanden SANCO2 heat-pump water heater",
		why: "A Sanden split — outdoor heat pump plus a storage tank. Not a gas water heater.",
		points: clipped,
		recommended: role === "main"
	};
	if (has("wh_hp") && !has("hp") && !has("furnace")) return {
		badge: "Efficiency",
		headline: "Lower-cost hot water",
		why: "A heat-pump water heater — built for the long utility bill, not just the swap.",
		points: clipped,
		recommended: role === "main"
	};
	if (hasAnyWh && !has("hp") && !has("furnace") && !has("ac") && !has("ductless")) return {
		badge: "Recommended",
		headline: has("wh_he") ? "High-efficiency gas tank" : "New gas water heater",
		why: "Sized for this house. Connected, vented, and started to code.",
		points: clipped,
		recommended: role === "main"
	};
	if (has("hp") || has("ductless")) return {
		badge: role === "upgrade" ? "Upgrade" : "Recommended",
		headline: has("ductless") ? "Zone comfort, room by room" : hasAnyWh ? "Heat pump + new water heater" : "Matched heat pump system",
		why: hasAnyWh ? "Climate system and hot water, scoped as one job." : "Outdoor unit and indoor match, sized for this house — not a catalog special.",
		points: clipped,
		recommended: role === "main"
	};
	if (has("furnace") || has("ac")) return {
		badge: role === "upgrade" ? "Upgrade" : "Recommended",
		headline: has("furnace") && has("ac") ? "Matched furnace and air conditioner" : has("furnace") ? "New gas furnace" : "New air conditioner",
		why: "Matched equipment, installed to code, with the paperwork handled.",
		points: clipped,
		recommended: role === "main"
	};
	if (role === "value") return {
		badge: "Value",
		headline: "The tighter investment",
		why: "Same install quality. A simpler equipment path if you want to hold the number down.",
		points: clipped,
		recommended: false
	};
	if (role === "upgrade") return {
		badge: "Upgrade",
		headline: "The equipment step-up",
		why: "Same crew, same house — the next tier of the unit you already picked.",
		points: clipped,
		recommended: false
	};
	return {
		badge: "Recommended",
		headline: "The complete job for this home",
		why: "Everything we scoped, installed to code, with Acme standing behind it.",
		points: clipped,
		recommended: true
	};
}
function linePrice(line: QuoteLine) {
	return Math.max(0, Number(line.unitPrice) || 0) * Math.max(1, Number(line.quantity) || 1);
}
function photosFromLines(lines: QuoteLine[]) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const line of lines) {
		if (!shouldShowProductPhoto(line)) continue;
		const url = resolveProductPhotoUrl(line);
		if (!url || seen.has(url + line.name)) continue;
		seen.add(url + line.name);
		out.push({
			url,
			label: friendlyGear(line.name)
		});
		if (out.length >= 8) break;
	}
	return out;
}
function photosFromItemNames(items: string[]) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const name of items) {
		const url = resolveProductPhotoUrl({
			name,
			imageUrl: null
		});
		if (!url || seen.has(url)) continue;
		seen.add(url);
		out.push({
			url,
			label: friendlyGear(name)
		});
		if (out.length >= 8) break;
	}
	return out;
}
function brandFromItems(items: string[]) {
	const blob = items.join(" ");
	if (/carrier/i.test(blob)) return "Carrier";
	if (/goodman/i.test(blob)) return "Goodman";
	if (/navien/i.test(blob)) return "Navien";
	if (/mitsubishi/i.test(blob)) return "Mitsubishi";
	if (/bosch/i.test(blob)) return "Bosch";
	if (/williams/i.test(blob)) return "Williams";
	if (/rinnai/i.test(blob)) return "Rinnai";
	if (/rheem/i.test(blob)) return "Rheem";
	return "";
}
function stageSubtitle(card: PacketPackageCard) {
	if (card.subtitle) return card.subtitle;
	const badge = (card.badge || "").trim();
	const brand = brandFromItems(card.items || []) || "";
	const prefix = brand ? `${brand} ` : "";
	if (/^infinity$/i.test(badge)) return `${prefix}Infinity (Variable-speed)`.trim();
	if (/^performance$/i.test(badge)) return `${prefix}Performance (Two-stage)`.trim();
	if (/^comfort$/i.test(badge)) return `${prefix}Comfort (Single-stage)`.trim();
	return card.headline || card.label;
}
function defaultPointsForRank(rank: string, existing: string[]) {
	if (existing.length >= 2) return existing.slice(0, 4);
	if (rank === "best") return [
		"Continuously adjusts capacity — quietest system in the lineup",
		"Superior humidity control and the most even rooms",
		"Highest efficiency. Acme installs it, starts it, and stands behind it"
	];
	if (rank === "better") return [
		"Runs on low stage most of the time — quieter than single-stage",
		"Better humidity control and more even temperatures",
		"Acme HVAC crew — permit, startup, and our workmanship"
	];
	if (rank === "good") return [
		"Reliable on/off operation and solid efficiency",
		"Good basic comfort, sized for this house",
		"Acme HVAC crew — permit, startup, and our workmanship"
	];
	return existing.length ? existing : ["Installed by Acme HVAC — permit, startup, and our workmanship"];
}
function defaultWarranty(rank: string, existing?: string) {
	if (existing) return existing;
	if (rank === "best") return "Acme labor warranty + longest parts coverage";
	if (rank === "better") return "Acme labor warranty + maintenance path";
	return "Acme labor warranty on the equipment we install";
}
var RANK_BY_COUNT: Record<number, string[]> = {
	1: ["best"],
	2: ["good", "better"],
	3: [
		"good",
		"better",
		"best"
	],
	4: [
		"good",
		"better",
		"best",
		"plus"
	]
};
var RANK_LABEL: Record<string, string> = {
	good: "Good",
	better: "Better",
	best: "Best",
	plus: "Elite"
};
function addOnDisplayName(raw: string) {
	const s = shortName(raw).replace(/^Option:\s*/i, "");
	if (/concrete pad|equipment pad/i.test(s)) return "Concrete pad";
	if (/sound wall/i.test(s)) return "Sound wall";
	if (/disguise wall/i.test(s)) return "Disguise wall";
	return s;
}
/**
* LOCKED: every nested option on a major sits on every package card.
* Pad, filter, thermostat, walls, disconnect — all of them, with +$ or Included.
* Comfort / Performance / Infinity are the packages themselves, not add-ons.
* Cards get taller. That is the deal.
*/
function jobAddOns(p: Proposal) {
	const out: PacketAddOn[] = [];
	const seen = /* @__PURE__ */ new Set<string>();
	const push = (name: string, price: number) => {
		const label = addOnDisplayName(name);
		const key = label.toLowerCase();
		if (!key || seen.has(key)) return;
		const n = Number(price);
		if (!Number.isFinite(n) || n <= 0) return;
		seen.add(key);
		out.push({
			name: label,
			optional: true,
			price: n
		});
	};
	const priceByLabel = /* @__PURE__ */ new Map();
	for (const li of p.lineItems || []) {
		if (li.role === "info" || li.role === "parked") continue;
		for (const o of li.options || []) {
			if (o.kind === "tier_upgrade") continue;
			const title = addOnDisplayName(o.title || "");
			const n = Number(o.priceDelta) || 0;
			if (title && n > 0) priceByLabel.set(title.toLowerCase(), n);
		}
	}
	for (const li of p.lineItems || []) {
		if (li.role === "info" || li.role === "parked") continue;
		if (isBakedIntoPackage(li.name)) continue;
		if (!isMajorLine(li)) continue;
		for (const o of li.options || []) {
			if (o.kind === "tier_upgrade") continue;
			const title = (o.title || "").replace(/^Option:\s*/i, "");
			if (!title) continue;
			if ((li.selectedOptionIds || []).includes(o.id)) continue;
			push(title, Number(o.priceDelta) || 0);
		}
	}
	const insts = (p.wizardSnapshot?.answers)?.measureInstances || [];
	const accessoryLabel: Record<string, string> = {
		pad: "Concrete pad",
		sound_wall: "Sound wall",
		disguise_wall: "Disguise wall",
		earthquake_strap: "Earthquake strap",
		stand: "Equipment stand",
		drain_pan: "Drain pan",
		expansion: "Expansion tank",
		prefilter: "Pre-filter",
		recirc: "Recirc reconnect",
		tl_recirc: "Tankless recirc",
		comfort_valve: "Comfort valve",
		thermostat: "Thermostat",
		filter: "Media filter",
		attic_hatch: "Attic hatch",
		attic_ladder: "Attic ladder",
		fan_moisture: "Moisture sensor",
		fan_motion: "Motion sensor",
		fan_dual_sensor: "Moisture + motion",
		fan_multispeed: "Multi-speed + delay",
		fan_wifi: "Wi-Fi module"
	};
	for (const inst of insts) {
		const picks = new Set(inst.accessoryPicks || []);
		for (const id of inst.accessoryOffers || []) {
			if (picks.has(id)) continue;
			const label = accessoryLabel[id];
			if (!label) continue;
			push(label, priceByLabel.get(label.toLowerCase()) || 0);
		}
	}
	return out;
}
function optionalProductFromLine(li: QuoteLine) {
	const why = (li.benefits || []).find((b: string) => b && !/warranty|sized for your home|acme hvac 3-year/i.test(b)) || "Add this equipment to the job — installed to code with the rest of the work.";
	const photos = photosFromLines([li]);
	return {
		name: friendlyGear(li.name),
		why,
		price: linePrice(li),
		photo: photos[0]
	};
}

function gearFitsPackage(name: string, badge: string) {
  const n = name || "";
  const inf = /infinity/i.test(badge);
  const bosch = /bosch/i.test(badge);
  if (/infinity\s*system\s*control|infinity\s*(wall\s*)?(control|thermostat)/i.test(n)) return inf;
  if (/zone|zoning|truezone/i.test(n)) return inf || bosch;
  return true;
}

function mergeSharedJobGear(card: PacketPackageCard, p: Proposal) {
	const measures = customerMeasures(p.lineItems || []);
	const cardKinds = new Set((card.items || []).map(kindOf));
	const itemKeys = new Set((card.items || []).map((s: string) => s.toLowerCase()));
	const hasClimate = ["ductless", "hp", "ac", "furnace", "ah"].some((k) => cardKinds.has(k as ReturnType<typeof kindOf>));
	const extraIncluded = [];
	const extraOptional = [];
	for (const li of measures) {
		if (!isPacketProductLine(li)) continue;
		const k = kindOf(li.name);
		if (hasClimate && (k === "ductless" || k === "hp" || k === "ac" || k === "furnace" || k === "ah")) continue;
		if (k !== "other" && cardKinds.has(k)) continue;
		const name = friendlyGear(li.name);
		if (itemKeys.has(name.toLowerCase())) continue;
		if (!gearFitsPackage(name, card.badge || card.label || "")) continue;
		if (lineIsOptional(li)) extraOptional.push(li);
		else extraIncluded.push(li);
	}
	const items = [...card.items || [], ...extraIncluded.map((l) => friendlyGear(l.name))].filter((n) => gearFitsPackage(n, card.badge || card.label || ""));
	const seenPhoto = new Set((card.photos || []).map((ph: PacketPhoto) => ph.url + ph.label));
	const photos = [...card.photos || []];
	for (const ph of photosFromLines(extraIncluded)) {
		if (seenPhoto.has(ph.url + ph.label)) continue;
		seenPhoto.add(ph.url + ph.label);
		photos.push(ph);
		if (photos.length >= 8) break;
	}
	const addOns = (card.addOns || []).filter((a: PacketAddOn) => a.optional && Number(a.price) > 0);
	const optionalProducts = [...card.optionalProducts || [], ...extraOptional.filter((l) => linePrice(l) > 0).map(optionalProductFromLine)];
	const extraPrice = extraIncluded.reduce((s, l) => s + linePrice(l), 0);
	return {
		...card,
		items,
		photos,
		addOns,
		optionalProducts,
		price: (card.price || 0) + extraPrice
	};
}
function decorateCompareCards(cards: PacketPackageCard[], proposal?: Proposal) {
	if (!cards.length) return cards;
	const n = cards.length;
	const ranks = RANK_BY_COUNT[n] || cards.map((_: PacketPackageCard, i: number) => i === 0 ? "good" : i === n - 1 ? "best" : "better");
	const popularIdx = n === 1 ? 0 : 1;
	const addOns = proposal ? jobAddOns(proposal) : void 0;
	return cards.map((card: PacketPackageCard, i: number) => {
		const rank = (card.rank || ranks[i] || "better") as PackageRank;
		const photos = card.photos?.length ? card.photos : photosFromItemNames(card.items || []);
		const stamped: PacketPackageCard = {
			...card,
			rank,
			rankLabel: card.rankLabel || RANK_LABEL[rank],
			popular: card.popular ?? i === popularIdx,
			recommended: card.recommended ?? (rank === "best" || i === popularIdx),
			subtitle: stageSubtitle(card),
			photos,
			points: defaultPointsForRank(rank, card.points || []),
			warrantyLine: defaultWarranty(rank, card.warrantyLine),
			addOns: card.addOns?.length ? card.addOns : addOns
		};
		return proposal ? mergeSharedJobGear(stamped, proposal) : stamped;
	});
}
/** Flyer title — “Carrier Heat Pump — Choose your comfort level”. */
function compareBoardHeadline(cards: PacketPackageCard[]) {
	const items = (cards[0]?.items || []).slice(0, 4);
	if (!items.length) return "Choose your comfort level";
	const kinds: string[] = [];
	for (const name of items) {
		const k = kindOf(name);
		let label = "";
		if (k === "hp") label = "Heat Pump";
		else if (k === "furnace") label = "Furnace";
		else if (k === "ac") label = "Air Conditioner";
		else if (k === "ductless") label = "Ductless";
		else if (k === "ah") continue;
		else if (k === "wh_tl") label = "Tankless";
		else if (k === "wh_sanden") label = "Sanden SANCO2";
		else if (k === "wh_hp") label = "Heat-Pump Water Heater";
		else if (k === "wh_he" || k === "wh_tank") label = "Water Heater";
		else if (k === "wall") label = "Wall Heater";
		else continue;
		const brand = brandFromItems([name]);
		const piece = brand ? `${brand} ${label}` : label;
		if (!kinds.some((x) => x.toLowerCase() === piece.toLowerCase())) kinds.push(piece);
	}
	if (!kinds.length) {
		const brand = brandFromItems(items);
		return brand ? `${brand} — Choose your comfort level` : "Choose your comfort level";
	}
	return `${kinds.slice(0, 2).join(" + ")} — Choose your comfort level`;
}
function cardFrom(letter: string, label: string, lines: QuoteLine[], role: string, conversion: boolean): PacketPackageCard {
	const majors = lines.filter(isMajorLine);
	const use = majors.length ? majors : lines.filter((l: QuoteLine) => l.role !== "info");
	const story = storyFor(use, role, conversion);
	return {
		letter,
		label,
		badge: story.badge,
		headline: story.headline,
		why: story.why,
		points: story.points,
		items: use.slice(0, 10).map((l: QuoteLine) => friendlyGear(l.name)),
		recommended: story.recommended,
		price: use.reduce((s: number, l: QuoteLine) => s + linePrice(l), 0),
		photos: photosFromLines(use),
		selectKey: use[0]?.productId || letter,
		outdoorSku: use[0]?.productId || undefined,
	};
}
function fromWizard(p: Proposal) {
	const pb = p.wizardSnapshot?.answers?.packageBuilder;
	if (!pb?.enabled || !pb.packages?.length) return null;
	const byId = new Map((p.lineItems || []).map((l: QuoteLine) => [l.id, l]));
	const conversion = conversionOn(p);
	const cards = pb.packages.map((pkg: { measureInstanceIds: string[]; kind?: string; letter?: string; label?: string }, i: number) => {
		const lines = pkg.measureInstanceIds.map((id: string) => byId.get(`li_${id}`) || byId.get(id)).filter((l: QuoteLine | undefined): l is QuoteLine => Boolean(l));
		const role = pkg.kind === "comparison" ? "upgrade" : i === 0 ? "main" : "value";
		return cardFrom(pkg.letter || "A", pkg.label || `Package ${pkg.letter}`, lines, role, conversion);
	});
	return cards.length ? cards : null;
}
function packetPackagesForProposal(p: Proposal, catalog?: Product[]) {
	const conversion = conversionOn(p);
	const singlePage = Boolean((p.wizardSnapshot?.answers)?.hideQuoteSnapshot);
	if (!singlePage) {
		const fromSnap = fromWizard(p);
		if (fromSnap && fromSnap.length >= 2) return decorateCompareCards(fromSnap, p);
		const tiers = buildTierPacketPackages(p, catalog);
		if (tiers?.length) return decorateCompareCards(tiers, p);
		if (p.packetPackages && p.packetPackages.length >= 2) return decorateCompareCards(p.packetPackages, p);
	}
	const included = customerMeasures(p.lineItems || []).filter((l) => !l.optional && l.role !== "info" && l.role !== "parked");
	const majors = included.filter(isMajorLine);
	const upgrades = included.flatMap((l) => (l.options || []).filter((o) => o.kind === "tier_upgrade"));
	const cards = [cardFrom("A", "Package A", majors.length ? majors : included, "main", conversion)];
	if (!singlePage && upgrades.length) {
		const swapped = (majors.length ? majors : included).map((m) => {
			const up = (m.options || []).find((o) => o.kind === "tier_upgrade");
			return up ? {
				...m,
				name: cleanUpgradeTitle(up)
			} : m;
		});
		cards.push(cardFrom("B", "Package B", swapped, "upgrade", conversion));
	}
	return decorateCompareCards(cards, p);
}
//#endregion

export {
  BRAND_STORY,
  defaultExecutiveSummary,
  isBakedIntoPackage,
  decorateCompareCards,
  compareBoardHeadline,
  packetPackagesForProposal,
};
