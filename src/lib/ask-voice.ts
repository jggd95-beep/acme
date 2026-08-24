/**
 * One voice for every advisor question.
 * Prompt = what to tap. Reason = why it matters (always shown).
 */
export function reasonFromId(id: string): string {
  const q = (id || "").toLowerCase();
  if (/^pad_/.test(q)) return "Sets pad hours and the packet pad line.";
  if (/line.?set|^ls_|run_takeoff|run_len|_run$|cover/.test(q) && /ctrl|tstat|therm/.test(q) === false)
    return "Sets line-set length, holes, and dollars.";
  if (/hatch|pull_down|joist|ladder/.test(q)) return "Sets hatch hours.";
  if (/demo|pull_old|pull_equip/.test(q)) return "Sets pull hours.";
  if (/ejob|elec|breaker|panel|gfci|circuit|disconnect/.test(q))
    return "Sets electrical hours and materials.";
  if (/place|location|where|sit/.test(q))
    return "Sets where we install this — hours and the packet follow.";
  if (/flue|bvent|pvc_vent|vent_run|draft/.test(q)) return "Sets vent run hours.";
  if (/condensate|cond_run|pan_drain|drain_pan/.test(q)) return "Sets drain hours.";
  if (/^gas_|gas_line|gas_path|gas_vent/.test(q)) return "Sets gas-line hours.";
  if (/filter/.test(q)) return "Sets filter dollars on this package.";
  if (/thermostat|tstat|ctrl|control.?wire|wall_ctrl/.test(q))
    return "Sets control-wire hours.";
  if (/hole|penetrat|stucco|brick|siding/.test(q)) return "Sets hole count and dollars.";
  if (/permit/.test(q)) return "Sets permit dollars on this quote.";
  if (/path|job_path|install_type|wh_job/.test(q))
    return "Sets whether this is a swap or a new sit.";
  if (/zone|damper/.test(q)) return "Sets zoning hours and the packet line.";
  if (/duct/.test(q)) return "Sets duct hours.";
  if (/head|indoor|style|room/.test(q)) return "Sets which indoor we install.";
  if (/size|brand|capacity|ton/.test(q)) return "Sets which units show next.";
  if (/strap|seismic/.test(q)) return "Sets strap hours.";
  if (/pan(?!el)/.test(q)) return "Sets pan hours.";
  if (/water_line|wh_water/.test(q)) return "Sets water-line hours.";
  if (/tp_|t&p|relief/.test(q)) return "Sets T&P drain hours.";
  if (/access|fit|cabinet/.test(q)) return "Sets access hours if we have to cut or frame.";
  return "Sets hours and the packet line for this pick.";
}

/** One visible sentence. Longer coaching stays behind Why?. */
export function reasonForAsk(id: string, help?: string | null): string {
  const h = (help || "").trim();
  if (h && !/hidden (on|in) the advisor|hidden on gas/i.test(h)) {
    const first = (h.split(/(?<=\.)\s+/)[0] || h).trim();
    const clipped =
      first.length <= 110
        ? first
        : first.slice(0, 100).replace(/\s+\S*$/, "") + "…";
    if (/^Sets /i.test(clipped)) return "";
    return clipped;
  }
  const fallback = reasonFromId(id);
  if (/^Sets /i.test(fallback)) return "";
  return fallback;
}
