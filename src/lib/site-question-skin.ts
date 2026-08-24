/**
 * Site-question chrome for the advisor quiz (location / demo / fit).
 *
 * Flip SITE_QUESTION_SKIN back to "gold" to restore the old yellow cards
 * without touching question logic or scope output.
 */
export type SiteQuestionSkin = "rail" | "gold";
export const SITE_QUESTION_SKIN: SiteQuestionSkin = "rail";

export function siteSkin() {
  if (SITE_QUESTION_SKIN === "gold") {
    return {
      wrapOpen:
        "rounded-2xl border-2 px-3 py-4 space-y-3 shadow-sm scroll-mt-24 border-amber-400 bg-amber-50 ring-2 ring-amber-400/40",
      wrapDone:
        "rounded-2xl border-2 px-3 py-4 space-y-3 shadow-sm scroll-mt-24 border-emerald-400 bg-emerald-50",
      badgeOpen: "rounded-full px-3 py-1.5 text-sm font-bold shrink-0 bg-amber-500 text-white",
      badgeDone: "rounded-full px-3 py-1.5 text-sm font-bold shrink-0 bg-emerald-600 text-white",
      hint: "hidden sm:block text-sm font-semibold text-amber-950",
      dotActive: "h-2 rounded-full transition-all w-6 bg-amber-500",
      dotDone: "h-2 rounded-full transition-all w-2 bg-emerald-500",
      dotTodo: "h-2 rounded-full transition-all w-2 bg-border-strong",
      doneRow:
        "w-full text-left rounded-xl border border-emerald-300 bg-white px-3 py-3 flex items-start gap-3 min-w-0 max-w-full",
      doneEyebrow: "block text-xs font-bold uppercase tracking-wide text-emerald-800",
      liveCard:
        "rounded-2xl border-2 border-amber-500 bg-white px-3 py-4 space-y-3 shadow-md ring-2 ring-amber-400/30",
      liveNum:
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-sm font-black",
      liveEyebrow: "hidden sm:block text-xs font-bold uppercase tracking-wide text-amber-800",
      liveStar: "text-amber-600",
      choiceOn: "border-amber-600 bg-amber-500 text-white",
      choiceOff: "border-border bg-elevated text-fg hover:border-amber-400",
      singleOn: "border-amber-600 bg-amber-50 ring-2 ring-amber-400/40",
      singleOff: "border-border bg-elevated hover:border-amber-400",
      placeCard:
        "rounded-2xl border-2 border-amber-500 bg-white px-3 py-4 space-y-3 shadow-md ring-2 ring-amber-400/30",
      placeEyebrow: "hidden sm:block text-xs font-bold uppercase tracking-wide text-amber-800",
      chipOn: "border-accent bg-accent-dim text-fg",
      chipOff: "border-border-strong bg-surface text-fg",
      showScopeWhileOpen: true,
      longFitPrompt: true,
    };
  }

  return {
    wrapOpen:
      "rounded-2xl border border-border bg-white px-3 py-4 space-y-3 shadow-sm scroll-mt-24",
    wrapDone:
      "rounded-2xl border border-emerald-300 bg-white px-3 py-4 space-y-3 shadow-sm scroll-mt-24",
    badgeOpen:
      "rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0 bg-accent text-white tracking-wide",
    badgeDone:
      "rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0 bg-emerald-600 text-white tracking-wide",
    hint: "hidden",
    dotActive: "h-1.5 rounded-full transition-all w-5 bg-accent",
    dotDone: "h-1.5 rounded-full transition-all w-1.5 bg-emerald-500",
    dotTodo: "h-1.5 rounded-full transition-all w-1.5 bg-border-strong",
    doneRow:
      "w-full text-left rounded-xl border border-border bg-white px-3 py-2.5 flex items-center gap-3 min-w-0 max-w-full",
    doneEyebrow: "sr-only",
    liveCard:
      "bg-white px-3 py-4 space-y-4 min-h-[42vh] sm:min-h-[62vh] sm:rounded-2xl sm:border-2 sm:border-border sm:px-8 sm:py-8 md:px-10 md:py-10 w-full",
    liveNum:
      "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-black",
    liveEyebrow: "hidden sm:block text-xs font-bold uppercase tracking-wide text-primary",
    liveStar: "text-primary",
    choiceOn: "border-primary bg-primary/10 text-fg ring-2 ring-primary/25",
    choiceOff: "border-border-strong bg-elevated text-fg",
    singleOn: "border-primary bg-primary/10 ring-2 ring-primary/25",
    singleOff: "border-border-strong bg-elevated",
    placeCard:
      "rounded-2xl border border-border bg-white px-3 py-4 space-y-4 min-h-[calc(100dvh-11rem)] sm:px-8 sm:py-8 md:px-10 w-full",
    placeEyebrow: "hidden sm:block text-xs font-bold uppercase tracking-wide text-accent",
    chipOn: "border-primary bg-primary/10 text-fg ring-2 ring-primary/25",
    chipOff: "border-border-strong bg-white text-fg",
    showScopeWhileOpen: false,
    longFitPrompt: false,
  };
}
