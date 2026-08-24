/** Field-code sheets on site questions (B-vent, T&P drain, …). */

export type FieldCodeKind = "bvent" | "tp";

export type FieldCodeSheet = {
  title: string;
  blurb: string;
  cite: string;
  aria: string;
  points: { title: string; body: string }[];
};

export const FIELD_CODE: Record<FieldCodeKind, FieldCodeSheet> = {
  bvent: {
    title: "Type-B vent · draft check",
    blurb: "Comfort advisor owns this. AHJ and the listing win if they differ.",
    cite: "IFGC / IRC G2427 / NFPA 54 — plus the appliance listing.",
    aria: "Type-B vent code notes",
    points: [
      {
        title: "Slope",
        body: "Vent connector rises ¼ inch per foot toward the vent. No dips, sags, or back-pitch.",
      },
      {
        title: "Clearance",
        body: "Type-B double-wall: 1 inch to combustibles. Single-wall connector: typically 6 inches.",
      },
      {
        title: "Height",
        body: "Type B or L terminates at least 5 feet above the highest draft hood or flue collar.",
      },
      {
        title: "Offsets",
        body: "Stay generally vertical. Offsets ≤ 45°. Horizontal run + connector ≤ 75% of vent height.",
      },
      {
        title: "Size",
        body: "Not smaller than the draft-hood outlet. Single appliance: not larger than 7× that area.",
      },
      {
        title: "Draft",
        body: "Visible draft at the hood after warm-up. No spillage at the relief opening.",
      },
      {
        title: "Termination",
        body: "Listed cap. Roof-pitch table, or the 2-foot / 10-foot rule when a wall is close.",
      },
    ],
  },
  tp: {
    title: "T&P drain line · field check",
    blurb:
      "The valve comes on the new heater. This sheet is the drain line only — not the pan drain.",
    cite: "CPC / UPC 608.5 · IRC P2804.6.1 — plus the listing.",
    aria: "T&P drain code notes",
    points: [
      {
        title: "Size",
        body: "Same diameter as the T&P outlet or larger. Usually ¾ inch. Do not reduce.",
      },
      {
        title: "Gravity only",
        body: "Full-size, downhill, no traps, no valves, no tees, no threaded cap on the end.",
      },
      {
        title: "Air gap",
        body: "Do not hard-pipe into the sewer. Discharge through an air gap in the same room or to a listed receptor.",
      },
      {
        title: "End of pipe",
        body: "Terminate not more than 6 inches above the floor or receptor. Point where discharge is visible and safe.",
      },
      {
        title: "Material",
        body: "Rated for 210°F. Copper, CPVC, or listed T&P drain — not common PVC unless the listing allows it.",
      },
      {
        title: "Not the pan",
        body: "Pan drain is a different line. A good pan drain does not make the T&P drain proper.",
      },
    ],
  },
};

export function fieldCodeKind(q: {
  id?: string;
  info?: string;
  linearFamily?: string;
}): FieldCodeKind | null {
  if (q.info === "bvent" || q.info === "tp") return q.info;
  if (q.linearFamily === "bvent") return "bvent";
  if (
    q.id === "wh_gas_vent" ||
    q.id === "wh_gas_vent_remaining" ||
    q.id === "wall_flue" ||
    q.id === "wall_flue_connect" ||
    q.id === "vent_flue"
  ) {
    return "bvent";
  }
  if (q.id === "wh_tp") return "tp";
  return null;
}

export function isBventQuestion(q: {
  id?: string;
  info?: string;
  linearFamily?: string;
}): boolean {
  return fieldCodeKind(q) === "bvent";
}
