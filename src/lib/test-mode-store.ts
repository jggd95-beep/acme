export type TestNote = {
  id: string;
  pageCode: string;
  pageLabel: string;
  target: string;
  text: string;
  at: string;
  pack: string;
};

const KEY = "aarvaks_test_mode";
const NOTES_KEY = "aarvaks_test_notes";
const PACK_LABEL = "20260817-live";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTestMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
    window.dispatchEvent(new Event("aarvaks-test-mode"));
  } catch {
    /* ignore */
  }
}

export function listTestNotes(): TestNote[] {
  return readJson<TestNote[]>(NOTES_KEY, []);
}

export function addTestNote(partial: {
  pageCode: string;
  pageLabel?: string;
  target?: string;
  text: string;
}): TestNote {
  const note: TestNote = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    pageCode: partial.pageCode || "??",
    pageLabel: partial.pageLabel || "",
    target: partial.target || "page",
    text: (partial.text || "").trim(),
    at: new Date().toISOString(),
    pack: PACK_LABEL,
  };
  writeJson(NOTES_KEY, [...listTestNotes(), note]);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("aarvaks-test-notes"));
  return note;
}

export function clearTestNotes() {
  writeJson(NOTES_KEY, []);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("aarvaks-test-notes"));
}

export function formatNotesForCopy(notes: TestNote[] = listTestNotes()): string {
  if (!notes.length) return "(no test notes yet)";
  return notes
    .map((n) => {
      const when = n.at.slice(0, 19).replace("T", " ");
      return `${n.pageCode} | ${n.pageLabel || "page"} | ${n.target} | ${n.text} | ${when} | ${n.pack}`;
    })
    .join("\n");
}

export function pageCodeFromPath(pathname: string): { code: string; label: string } {
  const p = pathname || "/";
  if (p === "/" || p.startsWith("/proposal")) return { code: "A1", label: "Quotes / proposal" };
  if (p.startsWith("/wizard")) return { code: "B1", label: "Guided quote" };
  if (p.startsWith("/backend") || p.startsWith("/catalog") || p.startsWith("/audit"))
    return { code: "E1", label: "Backend" };
  if (p.startsWith("/library")) return { code: "A2", label: "Product data" };
  if (p.startsWith("/cover")) return { code: "A3", label: "Cover looks" };
  return { code: "Z1", label: p };
}
