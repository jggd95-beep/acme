/**
 * Persisted owner overrides for measure scope questionnaires.
 * Merges over builtins so backend edits survive reload.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  BUILTIN_SCOPE_QUESTIONNAIRES,
  setActiveScopeQuestionnaires,
  type ScopeQuestionnaire,
  type ScopeQuestion,
  type ScopeChoice,
} from "./scope-wizard";

const RETIRED_CHOICE_IDS = new Set([
  "existing_5",
  "existing_10",
  "alter_2",
  "alter_5",
  "exp_easy",
  "exp_med",
  "exp_hard",
  "in_easy",
  "in_med",
  "in_hard",
]);

const FIELD_COPY_LOCK = new Set([
  "wh_gas_vent",
  "wh_gas_vent_remaining",
  "wh_tp",
  "wall_flue",
  "wh_pan_drain",
]);

const RETIRED_QUESTION_IDS = new Set([
  "electrical_hp",
  "electrical",
  "gas_existing",
  "gas_line",
  "power",
  "panel",
  "panel_room",
  "panel_brand",
  "panel_wall",
  "elec_existing",
  "wh_recirc_kind",
  "wh_recirc_ft",
  "wh_recirc_access",
  "wh_recirc_power",
  "wh_recirc_active",
]);

const FORCE_FROM_BUILTIN = new Set([
  "line_set",
  "elec_path",
  "duct_plan",
  "duct_tune_qty",
  "duct_cfm",
  "duct_offer_new",
  "condensate",
  "extra_hours",
  "pad_base",
  "ah_cond_path",
  "furn_cond_path",
  "wh_tl_cond_path",
  "ah_cond_run",
  "furn_cond_run",
  "wh_tl_cond_run",
  "wh_wl_run",
  "line_set_run",
  "wh_recirc",
  "pad_grade",
  "pad_size",
  "pad_haul_in",
  "gas_tie",
  "gas_pen",
  "gas_pen_qty",
  "gas_offsets",
  "gas_stories",
  "ah_access",
  "ah_access_ok",
  "cabinet_fit",
  "attic_hatch_work",
  "attic_hatch_diff",
  "attic_hatch_finish",
  "attic_ladder_frame",
  "attic_ladder_diff",
]);

function isSharedPackageLeftover(id: string): boolean {
  if (RETIRED_QUESTION_IDS.has(id)) return true;
  if (/^elec_/.test(id) || /^electrical_/.test(id) || /^panel_/.test(id)) {
    return true;
  }
  if (/^gas_/.test(id)) return true;
  return id === "service_light";
}

function mergeMissingBuiltins(
  stored: ScopeQuestionnaire[],
): ScopeQuestionnaire[] {
  const customs = new Map(
    (stored || [])
      .filter((q) => q.source === "custom")
      .map((q) => [q.id, q]),
  );
  const byId = new Map<string, ScopeQuestionnaire>();
  for (const b of BUILTIN_SCOPE_QUESTIONNAIRES) {
    const cur = customs.get(b.id);
    if (!cur) {
      byId.set(b.id, JSON.parse(JSON.stringify(b)) as ScopeQuestionnaire);
      continue;
    }
    const storedQ = new Map(cur.questions.map((q) => [q.id, q]));
    const ordered = b.questions
      .filter((bq) => !RETIRED_QUESTION_IDS.has(bq.id))
      .map((bq) => {
      const sq = storedQ.get(bq.id);
      if (!sq || FORCE_FROM_BUILTIN.has(bq.id))
        return JSON.parse(JSON.stringify(bq)) as ScopeQuestion;
      const storedOpts = new Map((sq.options || []).map((o) => [o.id, o]));
      const options = (bq.options || []).map((bo) => {
        const so = storedOpts.get(bo.id);
        if (!so || FIELD_COPY_LOCK.has(bq.id)) {
          return JSON.parse(JSON.stringify(bo)) as ScopeChoice;
        }
        return {
          ...bo,
          ...so,
          id: bo.id,
          label: so.label || bo.label,
          texts: bo.texts === 0 ? 0 : (so.texts ?? bo.texts),
          scopeLines:
            bo.texts === 0
              ? []
              : so.scopeLines?.length
                ? so.scopeLines
                : bo.scopeLines,
          benefitLines: so.benefitLines ?? bo.benefitLines,
          laborHours: so.laborHours ?? bo.laborHours,
          materialCost: so.materialCost ?? bo.materialCost,
          note: so.note ?? bo.note,
        };
      });
      if (!FIELD_COPY_LOCK.has(bq.id)) {
        for (const so of sq.options || []) {
          if (
            so.id === "stamp_quality_hybrid" ||
            RETIRED_CHOICE_IDS.has(so.id) ||
            (bq.options || []).some((x) => x.id === so.id)
          ) {
            continue;
          }
          options.push(so);
        }
      }
      return {
        ...bq,
        ...sq,
        id: bq.id,
        type: bq.type,
        linearFamily: bq.linearFamily ?? (sq as ScopeQuestion).linearFamily,
        prompt: FIELD_COPY_LOCK.has(bq.id)
          ? bq.prompt
          : bq.type === "linear_run"
            ? bq.prompt
            : sq.prompt || bq.prompt,
        help: FIELD_COPY_LOCK.has(bq.id) ? bq.help : (bq.help ?? sq.help),
        info: bq.info ?? (sq as ScopeQuestion).info,
        when: bq.when ?? sq.when,
        hidden: bq.hidden ?? sq.hidden,
        texts: bq.texts === 0 ? 0 : (sq.texts ?? bq.texts),
        options: options.length ? options : sq.options,
      };
    });
    for (const sq of cur.questions) {
      if (isSharedPackageLeftover(sq.id)) continue;
      if (!b.questions.some((bq) => bq.id === sq.id)) ordered.push(sq);
    }
    byId.set(b.id, { ...cur, questions: ordered, source: "custom" });
  }
  for (const [id, q] of customs) {
    if (!byId.has(id)) byId.set(id, q);
  }
  return Array.from(byId.values());
}

function dropStaleQuestionnaireKeys() {
  if (typeof localStorage === "undefined") return;
  try {
    for (const k of [
      "aarvaks-scope-questionnaires-v1",
      "aarvaks-scope-questionnaires-v2",
      "aarvaks-scope-questionnaires-v3",
    ]) {
      localStorage.removeItem(k);
    }
  } catch {
    /* private mode */
  }
}
dropStaleQuestionnaireKeys();

function cloneBuiltins(): ScopeQuestionnaire[] {
  return JSON.parse(JSON.stringify(BUILTIN_SCOPE_QUESTIONNAIRES)) as ScopeQuestionnaire[];
}

function applyActive(list: ScopeQuestionnaire[]) {
  setActiveScopeQuestionnaires(list);
}

type State = {
  questionnaires: ScopeQuestionnaire[];
  hydrated: boolean;
  resetToBuiltins: () => void;
  upsertQuestionnaire: (q: ScopeQuestionnaire) => void;
  updateQuestionnaire: (
    id: string,
    patch: Partial<ScopeQuestionnaire>,
  ) => void;
  updateQuestion: (
    questionnaireId: string,
    questionId: string,
    patch: Partial<ScopeQuestion>,
  ) => void;
  updateChoice: (
    questionnaireId: string,
    questionId: string,
    choiceId: string,
    patch: Partial<ScopeChoice>,
  ) => void;
  addChoice: (questionnaireId: string, questionId: string) => void;
  removeChoice: (
    questionnaireId: string,
    questionId: string,
    choiceId: string,
  ) => void;
  addQuestion: (questionnaireId: string) => void;
  removeQuestion: (questionnaireId: string, questionId: string) => void;
};

export const useScopeQuestionnaireStore = create<State>()(
  persist(
    (set, get) => ({
      questionnaires: cloneBuiltins(),
      hydrated: false,

      resetToBuiltins: () => {
        const next = cloneBuiltins();
        applyActive(next);
        set({ questionnaires: next });
      },

      upsertQuestionnaire: (q) => {
        const list = get().questionnaires;
        const idx = list.findIndex((x) => x.id === q.id);
        const next =
          idx >= 0
            ? list.map((x, i) => (i === idx ? { ...q, source: "custom" as const } : x))
            : [...list, { ...q, source: "custom" as const }];
        applyActive(next);
        set({ questionnaires: next });
      },

      updateQuestionnaire: (id, patch) => {
        const next = get().questionnaires.map((q) =>
          q.id === id ? { ...q, ...patch, source: "custom" as const } : q,
        );
        applyActive(next);
        set({ questionnaires: next });
      },

      updateQuestion: (questionnaireId, questionId, patch) => {
        const next = get().questionnaires.map((q) => {
          if (q.id !== questionnaireId) return q;
          return {
            ...q,
            source: "custom" as const,
            questions: q.questions.map((qq) =>
              qq.id === questionId ? { ...qq, ...patch } : qq,
            ),
          };
        });
        applyActive(next);
        set({ questionnaires: next });
      },

      updateChoice: (questionnaireId, questionId, choiceId, patch) => {
        const next = get().questionnaires.map((q) => {
          if (q.id !== questionnaireId) return q;
          return {
            ...q,
            source: "custom" as const,
            questions: q.questions.map((qq) => {
              if (qq.id !== questionId) return qq;
              return {
                ...qq,
                options: (qq.options || []).map((o) =>
                  o.id === choiceId ? { ...o, ...patch } : o,
                ),
              };
            }),
          };
        });
        applyActive(next);
        set({ questionnaires: next });
      },

      addChoice: (questionnaireId, questionId) => {
        const id = `opt_${Math.random().toString(36).slice(2, 8)}`;
        get().updateQuestion(questionnaireId, questionId, {
          options: [
            ...((get().questionnaires
              .find((q) => q.id === questionnaireId)
              ?.questions.find((qq) => qq.id === questionId)?.options ||
              []) as ScopeChoice[]),
            {
              id,
              label: "New option",
              scopeLines: ["Describe work for this choice."],
              laborHours: 0,
              materialCost: 0,
            },
          ],
        });
      },

      removeChoice: (questionnaireId, questionId, choiceId) => {
        const q = get().questionnaires.find((x) => x.id === questionnaireId);
        const qq = q?.questions.find((x) => x.id === questionId);
        if (!qq) return;
        get().updateQuestion(questionnaireId, questionId, {
          options: (qq.options || []).filter((o) => o.id !== choiceId),
        });
      },

      addQuestion: (questionnaireId) => {
        const id = `q_${Math.random().toString(36).slice(2, 8)}`;
        const next = get().questionnaires.map((q) => {
          if (q.id !== questionnaireId) return q;
          return {
            ...q,
            source: "custom" as const,
            questions: [
              ...q.questions,
              {
                id,
                prompt: "New site question",
                type: "single" as const,
                required: false,
                options: [
                  {
                    id: `opt_${Math.random().toString(36).slice(2, 6)}`,
                    label: "Option A",
                    scopeLines: ["Work scope line for option A."],
                    laborHours: 0,
                    materialCost: 0,
                  },
                ],
              },
            ],
          };
        });
        applyActive(next);
        set({ questionnaires: next });
      },

      removeQuestion: (questionnaireId, questionId) => {
        const next = get().questionnaires.map((q) => {
          if (q.id !== questionnaireId) return q;
          return {
            ...q,
            source: "custom" as const,
            questions: q.questions.filter((qq) => qq.id !== questionId),
          };
        });
        applyActive(next);
        set({ questionnaires: next });
      },
    }),
    {
      name: "aarvaks-scope-questionnaires-v4",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        questionnaires: (s.questionnaires || []).filter(
          (q) => q.source === "custom",
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.questionnaires?.length) {
          const merged = mergeMissingBuiltins(state.questionnaires);
          state.questionnaires = merged;
          applyActive(merged);
        } else {
          applyActive(cloneBuiltins());
        }
      },
    },
  ),
);

/** Call once from app shell / catalog to ensure runtime list matches store. */
export function syncScopeQuestionnairesFromStore(): void {
  const list = mergeMissingBuiltins(
    useScopeQuestionnaireStore.getState().questionnaires || [],
  );
  useScopeQuestionnaireStore.setState({ questionnaires: list });
  applyActive(list.length ? list : cloneBuiltins());
}
