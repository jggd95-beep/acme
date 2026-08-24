/**
 * Honeywell TrueFRESH — HRV and ERV.
 * Advisor questions teach. Client only sees finished work.
 */
import type { ScopeQuestionnaire } from "./scope-wizard";

export const hrvScope: ScopeQuestionnaire = {
  id: "hrv_v1",
  familyIds: ["hrv"],
  title: "Heat / energy recovery",
  blurb:
    "Honeywell TrueFRESH. ERV or HRV. Size the home, pick how air moves, then hoods, power, and control.",
  source: "builtin",
  questions: [
    {
      id: "hrv_kind",
      prompt: "ERV or HRV?",
      help: "Both dump stale indoor air (odors, chemicals) to the outside. ERV also hands moisture back so a typical Bay Area house does not dry out. HRV lets moisture leave — use it when the house stays too wet.",
      type: "single",
      required: true,
      options: [
        {
          id: "erv",
          label: "ERV — energy recovery (typical here)",
          note: "Heat and moisture stay more stable",
          benefitLines: [
            "Energy recovery keeps more of the home’s moisture where it belongs in a mild climate.",
            "Stale air leaves the baths. Cleaned outdoor air is delivered through the system you heat and cool with.",
          ],
        },
        {
          id: "hrv",
          label: "HRV — heat recovery",
          note: "Heat stays · moisture leaves",
          benefitLines: [
            "Heat recovery keeps the warmth you already paid for. Moisture can leave.",
            "Stale air leaves the baths. Cleaned outdoor air is delivered through the system you heat and cool with.",
          ],
        },
      ],
    },
    {
      id: "hrv_job",
      prompt: "Replace this unit, or new?",
      help: "Replace walks the existing hoods and ducts. New starts from a clean sheet.",
      type: "single",
      required: true,
      options: [
        {
          id: "replace",
          label: "Replace the existing HRV / ERV",
          note: "Keep what still works · verify hoods",
          laborHours: 6,
          materialCost: 180,
        },
        {
          id: "new",
          label: "New fresh-air system",
          note: "No unit there today",
          laborHours: 8,
          materialCost: 260,
        },
      ],
    },
    {
      id: "hrv_sqft",
      prompt: "Conditioned floor area (sq ft)?",
      help: "Used with bedrooms to size the Honeywell. ASHRAE 62.2: 0.03 × sq ft + 7.5 × (bedrooms + 1). You still pick the cabinet.",
      type: "number",
      required: true,
      unitLabel: "sq ft",
      placeholder: "2100",
    },
    {
      id: "hrv_beds",
      prompt: "How many bedrooms?",
      help: "Count bedrooms, not people. Studio / no bedroom = 1.",
      type: "count",
      required: true,
      unitLabel: "bedrooms",
      countMin: 1,
      countMax: 10,
      countStep: 1,
    },
    {
      id: "hrv_where",
      prompt: "Where does this ventilator go?",
      help: "Honeywell wants it serviceable and not in a space that freezes. The advisor must be able to slide the core straight out — 25 inches in front.",
      type: "single",
      required: true,
      options: [
        { id: "garage", label: "Garage" },
        { id: "mech", label: "Mechanical room or closet" },
        { id: "attic", label: "Attic — serviceable, not a freeze pocket" },
        { id: "conditioned", label: "Inside the conditioned house" },
      ],
    },
    {
      id: "hrv_mount",
      prompt: "How do we mount it?",
      type: "single",
      required: true,
      options: [
        {
          id: "hang",
          label: "Hang from the structure",
          scopeLines: [
            "Hang the Honeywell TrueFRESH from the structure on the factory straps so it sits level and serviceable.",
          ],
        },
        {
          id: "wall",
          label: "Wall bracket",
          scopeLines: [
            "Mount the Honeywell TrueFRESH on a wall bracket fastened to framing so it sits level and serviceable.",
          ],
        },
      ],
    },
    {
      id: "hrv_firewall",
      prompt: "Do any ducts go through the garage firewall or into the attic?",
      help: "Through a fire-rated garage wall or into an unconditioned attic: metal duct at the penetration, insulated on the unconditioned side. Not optional.",
      type: "single",
      required: true,
      when: { questionId: "hrv_where", oneOf: ["garage", "attic"] },
      options: [
        {
          id: "yes",
          label: "Yes — through the firewall or attic",
          laborHours: 1.75,
          materialCost: 210,
          scopeLines: [
            "Install metal duct through the fire-rated assembly and insulate and seal every duct that leaves conditioned space, so the penetration meets code and the Honeywell stays quiet and dry.",
          ],
        },
        { id: "no", label: "No — ducts stay in this room" },
      ],
    },
    {
      id: "hrv_service",
      prompt: "Is there 25 inches in front to slide the core out and clean it?",
      help: "If they cannot pull the cartridge, the unit cannot be maintained. Move it or build the space.",
      type: "single",
      required: true,
      options: [
        { id: "yes", label: "Yes — core slides straight out" },
        {
          id: "build",
          label: "No — we need to make service space",
          laborHours: 1.25,
          materialCost: 70,
          scopeLines: [
            "Set the Honeywell so the core slides straight out for cleaning, with a clear 25-inch service path in front of the cabinet.",
          ],
        },
      ],
    },
    {
      id: "hrv_exist_hoods",
      prompt: "Do the existing exterior openings still work for this Honeywell?",
      help: "70 CFM uses a 5-inch oval collar (6-inch hood with a reducer). 150 and 200 CFM use 6-inch round. Hoods need 72 inches between intake and exhaust, and the intake 18 inches above grade.",
      type: "single",
      required: true,
      when: { questionId: "hrv_job", equals: "replace" },
      options: [
        {
          id: "yes",
          label: "Yes — size and locations still work",
          note: "Reuse the hoods",
          scopeLines: [
            "Reuse the existing exterior hoods after confirming they are the right size and still sit in legal locations for this Honeywell TrueFRESH unit.",
          ],
        },
        {
          id: "no",
          label: "No — relocate or cut new hoods",
          note: "Old openings will not serve this unit",
          laborHours: 2.5,
          materialCost: 160,
          scopeLines: [
            "Cut and flash new exterior hoods in approved locations so the new Honeywell TrueFRESH can breathe clean air and exhaust stale air.",
          ],
        },
      ],
    },
    {
      id: "hrv_exist_intake",
      prompt: "Is the existing fresh-air intake in a clean location?",
      help: "Intake cannot sit by a gas meter, dryer, BBQ, garage exhaust, or near grade. If the intake is dirty air, relocate it.",
      type: "single",
      required: true,
      when: { questionId: "hrv_job", equals: "replace" },
      options: [
        {
          id: "clean",
          label: "Yes — high, clean air, away from exhaust and the meter",
        },
        {
          id: "dirty",
          label: "No — too close to a meter, dryer, BBQ, or exhaust",
          note: "We relocate the intake",
          laborHours: 2,
          materialCost: 120,
          scopeLines: [
            "Relocate the fresh-air intake to a high, clean location — away from the gas meter, dryer, barbecue, and other exhaust — so the home is not pulling in dirty air.",
          ],
        },
      ],
    },
    {
      id: "hrv_intake",
      prompt: "Where does the fresh-air intake sit?",
      help: "Intake is the picky one. High sidewall in clean air, 18 inches above grade, 72 inches from the exhaust hood. Not at the meter, dryer, or BBQ.",
      type: "single",
      required: true,
      when: { questionId: "hrv_job", equals: "new" },
      options: [
        {
          id: "wall",
          label: "High sidewall — clean air",
          laborHours: 1.5,
          materialCost: 95,
          scopeLines: [
            "Cut through the sidewall and install a new fresh-air intake hood, at least 18 inches above grade and 72 inches from the exhaust hood, in clean air away from the gas meter, dryer, and barbecue.",
          ],
        },
        {
          id: "roof",
          label: "Roof hood",
          laborHours: 2.25,
          materialCost: 140,
          scopeLines: [
            "Cut through the roof and install a new fresh-air hood, flashed and sealed, in clean air and at least 72 inches from the exhaust hood.",
          ],
        },
      ],
    },
    {
      id: "hrv_exhaust",
      prompt: "Where does stale air leave the house?",
      help: "Exhaust is more flexible than intake. Still keep it 72 inches from the intake.",
      type: "single",
      required: true,
      when: { questionId: "hrv_job", equals: "new" },
      options: [
        {
          id: "wall",
          label: "Sidewall hood",
          laborHours: 1.25,
          materialCost: 85,
          scopeLines: [
            "Cut through the sidewall and install a new exhaust hood, spaced from the fresh-air intake so the home is not breathing its own exhaust.",
          ],
        },
        {
          id: "roof",
          label: "Roof hood",
          laborHours: 2,
          materialCost: 130,
          scopeLines: [
            "Cut through the roof and install a new exhaust hood, flashed and sealed, spaced from the fresh-air intake.",
          ],
        },
      ],
    },
    {
      id: "hrv_layout",
      prompt: "How does fresh air and stale air move?",
      help: "Baths-out + HVAC-in is the usual win when there is a furnace or air handler. Dedicated is the win when there is not. Both-into-HVAC works but is not the full benefit.",
      type: "single",
      required: true,
      options: [
        {
          id: "dedicated",
          label: "Dedicated — rooms and baths",
          note: "Recommended with no HVAC to share",
          laborHours: 1,
          materialCost: 40,
          scopeLines: [
            "Install dedicated fresh-air supplies to the lived-in rooms and dedicated stale-air exhausts from baths or laundry so this Honeywell is its own balanced system.",
          ],
        },
        {
          id: "baths_hvac",
          label: "Baths out, HVAC in",
          note: "Recommended when there is a furnace or air handler",
          laborHours: 2,
          materialCost: 140,
          scopeLines: [
            "Exhaust stale air from baths or laundry and deliver fresh air into the existing return, at least three feet from the air handler, so the Honeywell uses the system you already have.",
          ],
        },
        {
          id: "single",
          label: "One supply and one exhaust",
          note: "Ductless homes · simple two-grille",
          laborHours: 1.5,
          materialCost: 80,
          scopeLines: [
            "Install one fresh-air supply grille and one stale-air exhaust grille, balanced at the Honeywell.",
          ],
        },
        {
          id: "hvac_both",
          label: "Both into the HVAC — not the full benefit",
          note: "Works · weaker whole-house effect",
          laborHours: 1.75,
          materialCost: 110,
          scopeLines: [
            "Tie this Honeywell into the existing HVAC. This uses the system you already have. It is not the full dedicated-room benefit.",
          ],
        },
        {
          id: "reuse",
          label: "Reuse existing HRV / ERV ducts",
          note: "Replace path",
          laborHours: 1,
          materialCost: 60,
          scopeLines: [
            "Reconnect to the existing fresh-air and exhaust ducts after confirming they are the right size and still sealed for this Honeywell.",
          ],
        },
      ],
    },
    {
      id: "hrv_supplies",
      prompt: "How many fresh-air supplies?",
      help: "Lived-in rooms. One, three, six — whatever this house needs.",
      type: "count",
      required: true,
      unitLabel: "supplies",
      countMin: 1,
      countMax: 8,
      laborHours: 0.55,
      materialCost: 38,
      when: { questionId: "hrv_layout", oneOf: ["dedicated", "single", "baths_hvac"] },
      scopeLines: [
        "Cut in and install {count} new fresh-air supply grille(s) to deliver even outdoor air to the conditioned rooms.",
      ],
    },
    {
      id: "hrv_supply_ft",
      prompt: "Fresh-air duct length (feet)?",
      help: "Full rolls / real feet. This covers the company. Count the path from the Honeywell to every supply.",
      type: "number",
      required: true,
      unitLabel: "ft",
      placeholder: "40",
      laborHours: 0.04,
      materialCost: 6.5,
      when: { questionId: "hrv_layout", oneOf: ["dedicated", "single", "baths_hvac"] },
      scopeLines: [
        "Install {count} feet of sealed, insulated fresh-air duct from the Honeywell to the supply grilles.",
      ],
    },
    {
      id: "hrv_exhausts",
      prompt: "How many stale-air exhausts?",
      help: "Baths and laundry are recommended. You can do one central exhaust if the house forces it.",
      type: "count",
      required: true,
      unitLabel: "exhausts",
      countMin: 1,
      countMax: 8,
      laborHours: 0.55,
      materialCost: 38,
      when: { questionId: "hrv_layout", oneOf: ["dedicated", "single", "baths_hvac"] },
      scopeLines: [
        "Cut in and install {count} new stale-air exhaust grille(s) to pull stale air from the baths and laundry.",
      ],
    },
    {
      id: "hrv_exhaust_ft",
      prompt: "Exhaust duct length (feet)?",
      help: "Path from every exhaust back to the Honeywell.",
      type: "number",
      required: true,
      unitLabel: "ft",
      placeholder: "30",
      laborHours: 0.04,
      materialCost: 6.5,
      when: { questionId: "hrv_layout", oneOf: ["dedicated", "single", "baths_hvac"] },
      scopeLines: [
        "Install {count} feet of sealed, insulated exhaust duct from the grilles back to the Honeywell.",
      ],
    },
    {
      id: "hrv_duct_mat",
      prompt: "Duct material for these ventilation ducts?",
      help: "Honeywell wants a short flex stub at the cabinet either way. KD snap-lock (hard pipe) is the better-airflow option for the client. In a garage, anything through the firewall is metal and fire-rated — we force that later.",
      type: "single",
      required: true,
      when: { questionId: "hrv_layout", oneOf: ["dedicated", "single", "baths_hvac"] },
      options: [
        {
          id: "flex",
          label: "R-8 insulated flex",
          note: "Quiet at the unit · standard",
          benefitLines: [
            "Insulated flex duct, sealed, so these new ventilation ducts stay quiet and do not sweat.",
          ],
        },
        {
          id: "kd",
          label: "KD snap-lock (hard pipe)",
          note: "Less restriction · better airflow",
          laborHours: 1.25,
          materialCost: 160,
          benefitLines: [
            "KD hard pipe on these ventilation ducts — smoother airflow than flex, less restriction.",
          ],
          scopeLines: [
            "Build these ventilation ducts in KD snap-lock hard pipe, sealed and strapped, with a short flex stub at the Honeywell so the cabinet stays quiet.",
          ],
        },
      ],
    },
    {
      id: "hrv_light",
      prompt: "Service light and switch at the unit?",
      help: "The next person has to see the core to clean it.",
      type: "single",
      required: true,
      options: [
        { id: "have", label: "Already there" },
        {
          id: "add",
          label: "Add a light and switch",
          laborHours: 0.75,
          materialCost: 55,
          scopeLines: [
            "Install a service light and switch at the Honeywell so the core can be cleaned safely.",
          ],
        },
      ],
    },
    {
      id: "hrv_power",
      prompt: "How does this unit get power?",
      help: "Honeywell wants a 120-volt receptacle next to the unit. A GFCI and its own breaker are the right way. No extension cord.",
      type: "single",
      required: true,
      options: [
        {
          id: "gfi",
          label: "Nearby GFCI we can use",
          scopeLines: [
            "Plug the Honeywell TrueFRESH into the existing GFCI receptacle at the unit. No extension cord.",
          ],
        },
        {
          id: "new",
          label: "New dedicated 120-volt circuit and GFCI",
          laborHours: 2.5,
          materialCost: 220,
          scopeLines: [
            "Install a new dedicated 120-volt circuit and GFCI receptacle at the Honeywell TrueFRESH so the unit has its own clean power.",
          ],
        },
      ],
    },
    {
      id: "hrv_control",
      prompt: "Which control runs this unit?",
      help: "The cabinet has only an INTER / CONT / OFF switch. A wall control is what the homeowner will actually use. T10 Pro or Prestige IAQ already in the house can run it. Carrier Infinity cannot.",
      type: "single",
      required: true,
      options: [
        {
          id: "new",
          label: "New Honeywell ventilation wall control",
          laborHours: 0.75,
          materialCost: 185,
          scopeLines: [
            "Install a new Honeywell ventilation wall control and set the fresh-air schedule with the homeowner.",
          ],
        },
        {
          id: "t10",
          label: "Home already has a Honeywell T10 or Prestige IAQ",
          scopeLines: [
            "Tie the Honeywell TrueFRESH to the existing Honeywell T10 or Prestige IAQ so one control runs fresh air with the rest of the system.",
          ],
        },
      ],
    },
    {
      id: "hrv_boost",
      prompt: "Bath boost timers?",
      help: "20 / 40 / 60 minute Honeywell boost. Optional. Nice next to a bath that the Honeywell already exhausts.",
      type: "single",
      required: true,
      options: [
        { id: "none", label: "No boost timers" },
        {
          id: "one",
          label: "One boost timer",
          laborHours: 0.4,
          materialCost: 95,
          scopeLines: [
            "Install one Honeywell bath boost control so the homeowner can air a bath out on demand.",
          ],
        },
        {
          id: "two",
          label: "Two boost timers",
          laborHours: 0.7,
          materialCost: 180,
          scopeLines: [
            "Install two Honeywell bath boost controls so the homeowner can air baths out on demand.",
          ],
        },
      ],
    },
    {
      id: "hrv_drain",
      prompt: "Condensate at the unit?",
      help: "Bay Area ERVs can often run drainless because we rarely freeze. If the space can freeze, we need a trapped drain or a pump. HRV in a cold space always wants a drain.",
      type: "single",
      required: true,
      options: [
        { id: "none", label: "Drainless — this space does not freeze" },
        {
          id: "drain",
          label: "Gravity drain to a nearby standpipe",
          laborHours: 0.6,
          materialCost: 35,
          scopeLines: [
            "Install a trapped condensate drain from the Honeywell to the nearby standpipe.",
          ],
        },
        {
          id: "pump",
          label: "Add a condensate pump",
          laborHours: 0.9,
          materialCost: 95,
          scopeLines: [
            "Install a condensate pump and discharge line from the Honeywell to an approved drain.",
          ],
        },
      ],
    },
  ],
};

/** ASHRAE 62.2 dwelling-unit continuous CFM. Studio counts as 1 bedroom. Advisor only. */
export function hrvTargetCfm(sqft: number, bedrooms: number): number {
  const beds = Math.max(1, Math.round(bedrooms || 0));
  const area = Math.max(0, Number(sqft) || 0);
  return Math.round(0.03 * area + 7.5 * (beds + 1));
}

export function hrvSuggestedClass(cfm: number): 70 | 150 | 200 {
  if (cfm <= 70) return 70;
  if (cfm <= 140) return 150;
  return 200;
}

/** Combine like work so the packet is not a grocery list. */
export function collapseHrvScopeLines(
  lines: string[],
  answers: Record<string, unknown>,
): string[] {
  const src = lines.map((l) => l.trim()).filter(Boolean);
  const take = (test: (l: string) => boolean) => {
    const hit = src.filter(test);
    hit.forEach((l) => {
      const i = src.indexOf(l);
      if (i >= 0) src.splice(i, 1);
    });
    return hit;
  };

  const hang = take((l) => /^Hang the Honeywell|^Mount the Honeywell/i.test(l));
  const fire = take((l) => /fire-rated assembly/i.test(l));
  const hoods = take((l) => /fresh-air (intake )?hood|exhaust hood|exterior hood/i.test(l));
  const layout = take(
    (l) =>
      /dedicated fresh-air supplies|Exhaust stale air from baths|one fresh-air supply grille|Tie this Honeywell into the existing HVAC|Reconnect to the existing fresh-air/i.test(
        l,
      ),
  );
  const supplies = take((l) => /fresh-air supply grille/i.test(l));
  const exhausts = take((l) => /stale-air exhaust grille/i.test(l));
  const supplyFt = take((l) => /feet of sealed, insulated fresh-air duct/i.test(l));
  const exhaustFt = take((l) => /feet of sealed, insulated exhaust duct/i.test(l));
  const kd = take((l) => /KD snap-lock|ventilation ducts in KD/i.test(l));
  const light = take((l) => /service light and switch/i.test(l));
  const power = take((l) => /GFCI receptacle|dedicated 120-volt/i.test(l));
  const control = take((l) => /ventilation wall control|T10 or Prestige/i.test(l));
  const boost = take((l) => /bath boost/i.test(l));
  const drain = take((l) => /condensate drain|condensate pump/i.test(l));
  const close = take((l) => /Check, test|Balance fresh-air|haul away debris/i.test(l));

  const out: string[] = [];
  out.push(...hang);
  out.push(...fire);

  if (hoods.length >= 2) {
    const roofIn = hoods.some((l) => /through the roof/i.test(l) && /fresh-air/i.test(l));
    const wallEx = hoods.some((l) => /through the sidewall/i.test(l) && /exhaust/i.test(l));
    const wallIn = hoods.some((l) => /through the sidewall/i.test(l) && /fresh-air/i.test(l));
    const roofEx = hoods.some((l) => /through the roof/i.test(l) && /exhaust/i.test(l));
    if (roofIn && wallEx) {
      out.push(
        "Cut through the roof for a new fresh-air hood and through the sidewall for a new exhaust hood, flashed and sealed, in clean air and spaced so the home is not breathing its own exhaust.",
      );
    } else if (wallIn && wallEx) {
      out.push(
        "Cut through the sidewall for a new fresh-air hood and a new exhaust hood, flashed and sealed, in clean air and spaced so the home is not breathing its own exhaust.",
      );
    } else if (roofIn && roofEx) {
      out.push(
        "Cut through the roof for a new fresh-air hood and a new exhaust hood, flashed and sealed, in clean air and spaced so the home is not breathing its own exhaust.",
      );
    } else {
      out.push(...hoods);
    }
  } else {
    out.push(...hoods);
  }

  const nSup = Number(answers.hrv_supplies) || 0;
  const nEx = Number(answers.hrv_exhausts) || 0;
  const layoutId = String(answers.hrv_layout || "");
  const ftSup = Number(answers.hrv_supply_ft) || 0;
  const ftEx = Number(answers.hrv_exhaust_ft) || 0;
  const mat = String(answers.hrv_duct_mat || "");
  const how =
    mat === "kd"
      ? " in KD snap-lock hard pipe, sealed and strapped, with a short flex stub at the Honeywell so the cabinet stays quiet"
      : ", sealed, insulated, and strapped";

  if (layoutId === "baths_hvac") {
    const bath =
      nEx > 0
        ? `Cut in and install ${nEx} new stale-air exhaust grille${nEx === 1 ? "" : "s"} in the bathrooms and laundry`
        : "Exhaust stale air from the bathrooms and laundry";
    const feet: string[] = [];
    if (ftSup) feet.push(`${ftSup} feet of fresh-air duct to the return`);
    if (ftEx) feet.push(`${ftEx} feet of exhaust duct`);
    out.push(
      `${bath}. Deliver the cleaned outdoor air into the existing HVAC return, at least three feet from the air handler${feet.length ? ` — install ${feet.join(" and ")}${how}` : ""}.`,
    );
  } else if (layoutId === "hvac_both") {
    out.push(
      "Tie this Honeywell into the existing forced-air system. Fresh air and stale air share the ducts you already have. This is not the full dedicated-room benefit.",
    );
    if (ftSup || ftEx) {
      const feet: string[] = [];
      if (ftSup) feet.push(`${ftSup} feet of fresh-air duct`);
      if (ftEx) feet.push(`${ftEx} feet of exhaust duct`);
      out.push(`Install ${feet.join(" and ")}${how}.`);
    }
  } else if (layout.length || supplies.length || exhausts.length) {
    const bits: string[] = [];
    if (nSup > 0)
      bits.push(
        `${nSup} new fresh-air supply grille${nSup === 1 ? "" : "s"} in the conditioned rooms`,
      );
    if (nEx > 0)
      bits.push(
        `${nEx} new stale-air exhaust grille${nEx === 1 ? "" : "s"} at the baths and laundry`,
      );
    if (layout.length && bits.length) {
      const lead = layout[0].replace(/\.$/, "");
      out.push(`${lead} — cut in and install ${bits.join(" and ")}.`);
    } else if (bits.length) {
      out.push(`Cut in and install ${bits.join(" and ")}.`);
    } else {
      out.push(...layout);
    }
    if (ftSup || ftEx || kd.length) {
      const feet: string[] = [];
      if (ftSup) feet.push(`${ftSup} feet of fresh-air duct`);
      if (ftEx) feet.push(`${ftEx} feet of exhaust duct`);
      if (feet.length) out.push(`Install ${feet.join(" and ")}${how}.`);
      else out.push(...kd);
    }
  } else if (layout.length) {
    out.push(...layout);
  }

  if (layoutId !== "baths_hvac" && layoutId !== "hvac_both" && !(layout.length || supplies.length || exhausts.length)) {
    if (ftSup || ftEx || kd.length) {
      const feet: string[] = [];
      if (ftSup) feet.push(`${ftSup} feet of fresh-air duct`);
      if (ftEx) feet.push(`${ftEx} feet of exhaust duct`);
      if (feet.length) out.push(`Install ${feet.join(" and ")}${how}.`);
      else out.push(...kd);
    }
  }

  out.push(...light);
  out.push(...power);

  if (control.length && boost.length) {
    const howMany = /two/i.test(boost[0] || "") ? "two bath boost controls" : "one bath boost control";
    if (/T10 or Prestige/i.test(control[0] || "")) {
      out.push(
        `Tie the Honeywell TrueFRESH to the existing Honeywell T10 or Prestige IAQ and install ${howMany} so one system runs fresh air and the baths can boost on demand.`,
      );
    } else {
      out.push(
        `Install a new Honeywell ventilation wall control and ${howMany}, and set the fresh-air schedule with the homeowner.`,
      );
    }
  } else {
    out.push(...control, ...boost);
  }

  out.push(...drain);

  const noun =
    String(answers.hrv_kind || "") === "erv"
      ? "energy recovery ventilator"
      : "heat recovery ventilator";
  const cta = close.find((l) => /Check, test, adjust/i.test(l));
  const haul = close.find((l) => /haul away/i.test(l));
  if (haul && String(answers.hrv_job) === "replace") out.push(haul);
  out.push(
    cta ||
      `Check, test, adjust, and start the new ${noun}. Confirm proper operation.`,
  );

  out.push(...src);
  return out.filter(Boolean);
}

