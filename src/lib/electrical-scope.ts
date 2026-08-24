/**
 * Standalone electrical — packet groups like work. Advisor still answers path.
 */
export function collapseElectricalScopeLines(
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

  take((l) => /on this job/i.test(l) && /with other work/i.test(l));
  const close = take((l) => /Check, test/i.test(l));
  take((l) => /^Install a new (dedicated )?(120|240)-volt circuit\.?$/i.test(l));
  const fromPanel = take((l) => /from the .+ panel/i.test(l) && /listed materials/i.test(l));
  const work = take((l) =>
    /circuit|receptacle|GFCI|dryer|range|charger|light|switch|sub panel|breaker/i.test(
      l,
    ),
  );
  const patch = take((l) => /rough patch|texture and paint/i.test(l));

  const fromBit = (() => {
    const hit = fromPanel[0] || "";
    const m = hit.match(/from the [^,]+panel(?: at the meter)?/i);
    return m ? m[0] : "";
  })();

  const out: string[] = [];
  if (work.length) {
    const first = work[0].replace(/\.$/, "");
    if (fromBit && !/from the /i.test(first)) {
      out.push(`${first}, ${fromBit}.`);
      out.push(...work.slice(1));
    } else {
      out.push(...work);
    }
  } else if (fromPanel.length) {
    out.push(...fromPanel);
  }
  out.push(...patch);
  out.push(
    close[0] ||
      "Check, test, and energize. Confirm the breaker, connections, and device operate as intended.",
  );
  out.push(...src);
  return out.filter(Boolean);
}

export function electricalBenefitLines(answers: Record<string, unknown>): string[] {
  const job = String(answers.ejob || "");
  const load240 = String(answers.ejob_240_load || "");
  const kind120 = String(answers.ejob_120_kind || "");
  if (job === "c240" && load240 === "dryer") {
    return [
      "A dedicated 30-amp, 240-volt circuit sized to the dryer listing — not a leftover circuit.",
      "Listed breaker, conductors, and receptacle so the dryer starts clean.",
    ];
  }
  if (job === "c120" && kind120 === "gas_dryer") {
    return [
      "A dedicated 120-volt circuit for the gas dryer — the appliance has its own landing.",
      "Listed breaker and receptacle so the dryer is not sharing a kitchen or garage circuit.",
    ];
  }
  if (job === "c240") {
    return [
      "A 240-volt circuit sized to the appliance listing — 30, 40, or 50 amp as selected.",
    ];
  }
  if (job === "c120") {
    return [
      "A dedicated 120-volt circuit sized to the load — not a leftover circuit.",
    ];
  }
  if (job === "gfi") {
    return ["Listed GFCI protection where water and power meet."];
  }
  if (job === "light") {
    return [
      "Concealed switch work in the finished room. Acme leaves a rough patch — texture and paint stay with the owner.",
    ];
  }
  if (job === "sub") {
    return [
      "Room in the panel for this load and the next one, without a whole-house service change.",
    ];
  }
  return [];
}
