/**
 * Backend-editable standard measure language (concrete pad, etc.).
 * Runtime always reads from here — not from hardcoded UI strings.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { formatMeasureTitle } from "./title-case";

export type StandardCopyId =
  | "packet_lead"
  | "packet_close"
  | "concrete_pad"
  | "load_calc"
  | "conversion_guide"
  | "hpwh_guide";

export type StandardCopyBlock = {
  id: StandardCopyId;
  /** Backend label */
  label: string;
  /** Customer-facing title */
  title: string;
  /** Bullet benefits (packet / option body) */
  benefits: string[];
  /**
   * Full work-scope / option body text.
   * If empty, body is built from title + benefits + closingNote.
   */
  body: string;
  /** Paragraph after benefits (customer-facing) */
  closingNote: string;
  /** Advisor-only note (not on packet unless also in body) */
  advisorNote: string;
  materialCost: number;
  laborHours: number;
  /** Default selected on outdoor hosts */
  defaultSelected: boolean;
  updatedAt: string;
};

const now = () => new Date().toISOString();

export const FACTORY_STANDARD_COPY: Record<StandardCopyId, StandardCopyBlock> =
  {
    packet_lead: {
      id: "packet_lead",
      label: "Packet opening (every equipment job)",
      title: "Packet opening",
      benefits: [],
      body:
        "{company} will install a new {noun} to meet manufacturer and local code requirements, with Acme’s stamp of quality.\nInstall a new {name}.",
      closingNote: "",
      advisorNote:
        "Prints at the top of the customer work list. {company} = shop name, {noun} = heat pump / ductless system / etc, {name} = the unit they picked.",
      materialCost: 0,
      laborHours: 0,
      defaultSelected: true,
      updatedAt: now(),
    },
    packet_close: {
      id: "packet_close",
      label: "Packet close (startup line)",
      title: "Packet close",
      benefits: [],
      body: "Check, test, adjust, and start the new {noun}. Confirm proper operation.",
      closingNote: "",
      advisorNote:
        "Prints at the end of the customer work list when the job doesn’t already have a start-up sentence. {noun} = the equipment type.",
      materialCost: 0,
      laborHours: 0,
      defaultSelected: true,
      updatedAt: now(),
    },
    concrete_pad: {
      id: "concrete_pad",
      label: "Custom concrete pad",
      title: "Custom Concrete Pad",
      benefits: [
        "Solid, level base so the outdoor unit mounts firmly for years of quiet service",
        "Much sturdier under full equipment weight — a true foundation for the outdoor unit",
        "Unit can be solidly lagged / anchored to the pad for lasting stability",
        "Helps keep the unit from rocking or shifting as soil settles or the compressor vibrates",
        "Better long-term protection for the line set and refrigerant connections",
        "Looks finished and intentional next to the home",
        "Poured and sized for this equipment and site (hills, slopes, and access factored in)",
      ],
      body: "",
      closingNote:
        "A solid concrete pad is the sturdier, more permanent choice for mounting and securing outdoor equipment. Preformed pads can suit simple flat sites; when you want maximum stability and a clean finished look, custom concrete is the upgrade we recommend.",
      advisorNote:
        "One pad per outdoor install. Materials and labor adjust for hills, rebar, haul-in, slopes, and old pad removal — customer price updates live from those costs.",
      materialCost: 1080,
      laborHours: 6.75,
      defaultSelected: true,
      updatedAt: now(),
    },
    load_calc: {
      id: "load_calc",
      label: "Load calculation (included language)",
      title: "Precision Home Load & Efficiency Analysis",
      benefits: [
        "System sized for your home with advanced load-calculation software",
        "Targets maximum comfort and efficiency — not a one-size-fits-all guess",
        "Documents why this equipment class fits your layout and goals",
      ],
      body: "",
      closingNote:
        "Included with major climate equipment on this proposal. No separate charge.",
      advisorNote: "Free · never optional · always included with HP / furnace / AC.",
      materialCost: 0,
      laborHours: 0,
      defaultSelected: true,
      updatedAt: now(),
    },
    conversion_guide: {
      id: "conversion_guide",
      label: "Heat pump conversion language",
      title: "Gas Furnace to Heat Pump — What to Expect",
      benefits: [
        "Clear expectations for heat pump comfort vs gas furnace heat feel",
        "How defrost, outdoor temperature, and runtime differ from gas",
        "Why proper sizing and airflow matter after a conversion",
      ],
      body: "",
      closingNote:
        "This section is informational so you know how the system will feel and operate day to day. No equipment charge for this language.",
      advisorNote: "Info only · no price · not an optional upsell measure.",
      materialCost: 0,
      laborHours: 0,
      defaultSelected: true,
      updatedAt: now(),
    },
    hpwh_guide: {
      id: "hpwh_guide",
      label: "Heat pump water heater language",
      title: "Heat Pump Water Heater — What to Expect",
      benefits: [
        "Recovery is slower than gas or standard electric — that is normal",
        "Excellent efficiency and lower operating cost most of the year",
        "Cooler air, soft compressor sound, and condensate are expected",
        "Boost / hybrid modes when you need faster recovery",
      ],
      body: "",
      closingNote:
        "Included free whenever a heat pump (hybrid) water heater is on your proposal so everyone shares the same expectations before install.",
      advisorNote:
        "Auto-added when HPWH equipment is selected · info column on packet · $0.",
      materialCost: 0,
      laborHours: 0,
      defaultSelected: true,
      updatedAt: now(),
    },
  };

function cleanPacketText(raw: string): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fill {company} {noun} {name} on packet opening/close. */
export function fillPacketTemplate(
  template: string,
  vars: { company?: string; noun?: string; name?: string },
): string {
  return cleanPacketText(template || "")
    .replace(/\{company\}/gi, vars.company || "")
    .replace(/\{noun\}/gi, vars.noun || "")
    .replace(/\{name\}/gi, vars.name || "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Customer-facing option / measure body from a standard-copy block.
 * Skips empty sections so clearing benefits does not leave tall blank boxes.
 */
function buildBody(block: StandardCopyBlock): string {
  const override = cleanPacketText(block.body || "");
  if (override) return override;

  const benefits = (block.benefits || [])
    .map((b) => b.trim())
    .filter(Boolean);
  const parts: string[] = [];
  if (benefits.length) {
    parts.push(...benefits.map((b) => `• ${b}`));
  }
  const closing = cleanPacketText(block.closingNote || "");
  if (closing) parts.push(closing);
  // Advisor notes stay internal — never on the homeowner packet
  return cleanPacketText(parts.join("\n"));
}

type State = {
  blocks: Record<StandardCopyId, StandardCopyBlock>;
  getBlock: (id: StandardCopyId) => StandardCopyBlock;
  updateBlock: (
    id: StandardCopyId,
    patch: Partial<StandardCopyBlock>,
  ) => void;
  resetBlock: (id: StandardCopyId) => void;
  resetAll: () => void;
  /** Compiled customer body — always from current backend values */
  resolveBody: (id: StandardCopyId) => string;
};

function cloneFactory(): Record<StandardCopyId, StandardCopyBlock> {
  return JSON.parse(JSON.stringify(FACTORY_STANDARD_COPY));
}

export const useStandardCopyStore = create<State>()(
  persist(
    (set, get) => ({
      blocks: cloneFactory(),

      getBlock: (id) => {
        const b = get().blocks[id] || FACTORY_STANDARD_COPY[id];
        return { ...b, benefits: [...(b.benefits || [])] };
      },

      updateBlock: (id, patch) => {
        const cur = get().getBlock(id);
        const next: StandardCopyBlock = {
          ...cur,
          ...patch,
          id,
          title:
            patch.title != null
              ? formatMeasureTitle(patch.title)
              : cur.title,
          benefits:
            patch.benefits != null
              ? patch.benefits.map((x) => x.trim()).filter(Boolean)
              : cur.benefits,
          materialCost: Math.max(
            0,
            Number(patch.materialCost ?? cur.materialCost) || 0,
          ),
          laborHours: Math.max(
            0,
            Number(patch.laborHours ?? cur.laborHours) || 0,
          ),
          updatedAt: now(),
        };
        set({
          blocks: { ...get().blocks, [id]: next },
        });
      },

      resetBlock: (id) => {
        set({
          blocks: {
            ...get().blocks,
            [id]: { ...FACTORY_STANDARD_COPY[id], updatedAt: now() },
          },
        });
      },

      resetAll: () => set({ blocks: cloneFactory() }),

      resolveBody: (id) => buildBody(get().getBlock(id)),
    }),
    {
      name: "aarvaks-standard-copy-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ blocks: s.blocks }),
      merge: (persisted, current) => {
        const p = persisted as { blocks?: Partial<Record<StandardCopyId, StandardCopyBlock>> } | undefined;
        const blocks = cloneFactory();
        if (p?.blocks) {
          for (const id of Object.keys(FACTORY_STANDARD_COPY) as StandardCopyId[]) {
            if (id === "packet_lead" || id === "packet_close") continue;
            if (p.blocks[id]) {
              const incoming = p.blocks[id]!;
              // Old factory pad was too low — pick up the 3× look.
              if (id === "concrete_pad") {
                const mat = Number(incoming.materialCost);
                const hrs = Number(incoming.laborHours);
                if (
                  (mat === 120 && hrs === 0.75) ||
                  (mat === 360 && hrs === 2.25)
                ) {
                  blocks[id] = { ...FACTORY_STANDARD_COPY[id], updatedAt: now() };
                  continue;
                }
              }
              blocks[id] = { ...blocks[id], ...incoming, id };
            }
          }
        }
        return { ...current, blocks };
      },
    },
  ),
);

/** Non-React accessors used by equipment catalog / line builders */
export function getStandardCopy(id: StandardCopyId): StandardCopyBlock {
  return useStandardCopyStore.getState().getBlock(id);
}

export function resolveStandardBody(id: StandardCopyId): string {
  return useStandardCopyStore.getState().resolveBody(id);
}

export function getConcretePadConfig() {
  const b = getStandardCopy("concrete_pad");
  return {
    title: b.title,
    benefits: b.benefits,
    body: resolveStandardBody("concrete_pad"),
    materialCost: b.materialCost,
    laborHours: b.laborHours,
    defaultSelected: b.defaultSelected,
    closingNote: b.closingNote,
    advisorNote: b.advisorNote,
  };
}
