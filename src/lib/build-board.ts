/** Owner-facing build list — what we promised vs what’s actually in the app. */

export type BoardStatus = "done" | "partial" | "open";

export type BoardItem = {
  id: string;
  title: string;
  created: string;
  done?: string;
  status: BoardStatus;
};

export const BUILD_BOARD: BoardItem[] = [
  { id: "duct-lang", title: "Ductwork packet language (ACCA, jacket, rooms)", created: "2026-08-16", done: "2026-08-17", status: "done" },
  { id: "ductless-order", title: "Ductless work-scope order + outdoor first", created: "2026-08-16", done: "2026-08-17", status: "done" },
  { id: "benefits-spine", title: "Benefits: load calc, up to SEER2/HSPF2, warranty", created: "2026-08-16", done: "2026-08-17", status: "done" },
  { id: "titles", title: "Ductless titles (no thin / outdoor / ~ton)", created: "2026-08-16", done: "2026-08-17", status: "done" },
  { id: "flag", title: "Flag box (3-line, stays while page scrolls)", created: "2026-08-16", done: "2026-08-17", status: "done" },
  { id: "q-crash", title: "Questions tab crash (black + red box)", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "review-drop", title: "Review decks behind a dropdown", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "trash", title: "Trash + 3-step reset (no PIN)", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "pkg-unlock", title: "Job packages editable in Backend", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "scroll-pin", title: "Site questions open at the prompt, not mid-page", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "power-wording", title: "Power work wording (not “measure”)", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "flag-1tap", title: "Flag = one button (Flag → + → Save flag)", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "quotes-mail", title: "Quotes extras in a small mailbox (this board)", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "tentacle-map", title: "Tentacle diagrams per major (real map, not a list)", created: "2026-08-15", done: "2026-08-17", status: "done" },
  { id: "app-poster", title: "Whole-app tentacle poster", created: "2026-08-17", done: "2026-08-17", status: "done" },
  { id: "map-all", title: "Every sales-tool chip has a question tree on Backend", created: "2026-08-17", status: "partial" },
  { id: "be-nav", title: "2026 Backend jump bar (not only All Backend)", created: "2026-08-17", done: "2026-08-17", status: "partial" },
  { id: "owner-desk", title: "Owner pricing desk + demo quote before/after", created: "2026-08-17", status: "open" },
  { id: "pkg-autosave-copy", title: "Say on Packages that order saves as you tap", created: "2026-08-17", status: "open" },
  { id: "true-eff", title: "True efficiency after heads (Carrier vs Mitsubishi)", created: "2026-08-16", status: "open" },
  { id: "pin-trash", title: "PIN to empty Trash (when PIN is real)", created: "2026-08-17", status: "open" },
  { id: "hrv-major", title: "HRV/ERV major (TrueFRESH, layouts, ducts, sizer)", created: "2026-08-17", done: "2026-08-17", status: "done" },
];

export function boardCounts(items: BoardItem[] = BUILD_BOARD) {
  return {
    open: items.filter((i) => i.status === "open").length,
    partial: items.filter((i) => i.status === "partial").length,
    done: items.filter((i) => i.status === "done").length,
  };
}
