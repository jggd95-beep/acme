/**
 * Build a visual tentacle tree from live site questions.
 * Each choice that unlocks follow-ups is a branch. Leaves are dead-ends.
 */
import {
  isQuestionVisible,
  questionnaireForFamily,
  type ScopeAnswers,
  type ScopeQuestion,
  type ScopeQuestionnaire,
} from "./scope-wizard";

export type TentacleOption = {
  id: string;
  label: string;
  next: TentacleNode[];
};

export type TentacleNode = {
  id: string;
  prompt: string;
  options: TentacleOption[];
};

const MAX_NODES = 90;
const MAX_DEPTH = 7;

function visibleOpen(
  quiz: ScopeQuestionnaire,
  answers: ScopeAnswers,
): ScopeQuestion[] {
  return quiz.questions.filter(
    (q) => !q.hidden && isQuestionVisible(q, answers) && answers[q.id] == null,
  );
}

function unlocks(
  quiz: ScopeQuestionnaire,
  answers: ScopeAnswers,
  qid: string,
  choiceId: string,
): ScopeQuestion[] {
  const next = { ...answers, [qid]: choiceId };
  return quiz.questions.filter(
    (q) =>
      !q.hidden &&
      isQuestionVisible(q, next) &&
      !isQuestionVisible(q, answers),
  );
}

function buildNode(
  quiz: ScopeQuestionnaire,
  q: ScopeQuestion,
  answers: ScopeAnswers,
  depth: number,
  budget: { n: number },
): TentacleNode {
  const opts = q.options || [];
  const options: TentacleOption[] = [];
  if (depth < MAX_DEPTH && opts.length) {
    for (const o of opts) {
      if (budget.n >= MAX_NODES) break;
      const childQs = unlocks(quiz, answers, q.id, o.id);
      const nextAnswers = { ...answers, [q.id]: o.id };
      const next: TentacleNode[] = [];
      for (const cq of childQs) {
        if (budget.n >= MAX_NODES) break;
        budget.n += 1;
        next.push(buildNode(quiz, cq, nextAnswers, depth + 1, budget));
      }
      options.push({ id: o.id, label: o.label, next });
    }
  }
  return { id: q.id, prompt: q.prompt || q.id, options };
}

export function tentacleForest(familyId: string): {
  title: string;
  trunk: TentacleNode[];
  mapped: boolean;
} {
  const quiz = questionnaireForFamily(familyId);
  if (!quiz) return { title: familyId, trunk: [], mapped: false };
  const budget = { n: 0 };
  const roots = visibleOpen(quiz, {});
  const trunk = roots.map((q) => {
    budget.n += 1;
    return buildNode(quiz, q, {}, 0, budget);
  });
  return { title: quiz.title || familyId, trunk, mapped: true };
}

export function forestHasBranches(forest: { trunk: TentacleNode[] }): boolean {
  return forest.trunk.some((n) => n.options.some((o) => o.next.length > 0));
}

function walk(node: TentacleNode, indent: string, lines: string[]) {
  lines.push(`${indent}ASK  ${node.prompt}`);
  for (const o of node.options) {
    const extra = o.next.length ? `  → ${o.next.length} more` : "  (ends)";
    lines.push(`${indent}  • ${o.label}${extra}`);
    for (const child of o.next) walk(child, indent + "    ", lines);
  }
}

export function formatTentaclesText(
  rows: Array<{ label: string; forest: ReturnType<typeof tentacleForest> }>,
): string {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const lines = [`Acme HVAC · tentacles · ${stamp}`, ""];
  for (const row of rows) {
    lines.push(`══ ${row.label} ══`);
    if (!row.forest.mapped) {
      lines.push("  (not mapped yet)");
    } else if (!row.forest.trunk.length) {
      lines.push("  (no live questions)");
    } else {
      for (const n of row.forest.trunk) walk(n, "  ", lines);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadTentaclesText(body: string) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const name = `TENTACLES-${stamp}.txt`;
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
