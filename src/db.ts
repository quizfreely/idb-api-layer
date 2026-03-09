/*!
 * Quizfreely IDB API Layer, licensed under GPL-3.0-or-later.
 * Copyright (c) 2025-2026 Ehan Ahamed and contributors
 *
 * https://codeberg.org/quizfreely/idb-api-layer
 * https://github.com/quizfreely/idb-api-layer
 */

import { Dexie, type EntityTable } from "dexie"

interface Studyset {
    id: number
    title: string
    draft: boolean
    createdAt: string
    updatedAt: string
    terms?: Term[]
    practiceTests?: PracticeTest[]
}

interface Term {
    id: number
    term: string
    def: string
    termImageUrl?: string
    defImageUrl?: string
    termImageKey?: number
    defImageKey?: number
    progress?: TermProgress
    progressHistory?: TermProgressHistory[]
    topConfusionPairs?: TermConfusionPair[]
    topReverseConfusionPairs?: TermConfusionPair[]
}

interface PracticeTest {
    id: number
    studysetId: number | string
    timestamp: string
    questionsCorrect: number
    questionsTotal: number
    questions: Question[]
}

interface Question {
    questionType: string
    mcq?: MCQ
    trueFalseQuestion?: TrueFalseQuestion
}

interface MCQ {
    answerWith: string
    answeredTerm: Term
    correct: boolean
    correctChoiceIndex: number
    distractors: Term[]
    term: Term
}

interface TrueFalseQuestion {
    answerWith: string
    answeredBool: boolean
    correct: boolean
    distractor: Term
    term: Term
}

interface TermProgress {
    id: number
    termId: number | string
    termCorrectCount: number
    termIncorrectCount: number
    termReviewCount: number
    defCorrectCount: number
    defIncorrectCount: number
    defReviewCount: number
    termFirstReviewedAt?: string
    termLastReviewedAt?: string
    defFirstReviewedAt?: string
    defLastReviewedAt?: string
    termLeitnerSystemBox?: number
    defLeitnerSystemBox?: number
}

interface TermProgressHistory {
    id: number
    timestamp: string
    termId: number | string
    termCorrectCount: number
    termIncorrectCount: number
    defCorrectCount: number
    defIncorrectCount: number
}

interface TermConfusionPair {
    id: number
    termId: number | string
    confusedTermId: number | string
    answeredWith: string
    confusedCount: number
    lastConfusedAt: string
    term?: Omit<Term, "topConfusionPairs" | "topReverseConfusionPairs">
    confusedTerm?: Omit<Term, "topConfusionPairs" | "topReverseConfusionPairs">
}

interface Image {
    key: number
    blob: Blob
}

const db = new Dexie("quizfreelydata") as Dexie & {
    studysets: EntityTable<
        Studyset,
        "id" // primary key "id" (for the typings only)
    >
    terms: EntityTable<
        Term,
        "id"
    >
    practiceTests: EntityTable<
        PracticeTest,
        "id"
    >
    termProgress: EntityTable<
        TermProgress,
        "id"
    >
    termProgressHistory: EntityTable<
        TermProgressHistory,
        "id"
    >
    termConfusionPairs: EntityTable<
        TermConfusionPair,
        "id"
    >
    images: EntityTable<
        Image,
        "key"
    >
}

db.version(5).stores({
    studysets: '++id, title',
    studysetprogress: 'studyset_id',
    studysetsettings: 'studyset_id'
});
db.version(6).stores({
    studysets: '++id, updated_at',
    terms: "++id, studyset_id, sort_order, created_at, updated_at",
    term_progress: "++id, term_id, term_first_reviewed_at, term_last_reviewed_at, " +
        "term_review_count, def_first_reviewed_at, def_last_reviewed_at, " +
        "def_review_count, term_leitner_system_box, def_leitner_system_box",
    studysetprogress: null,
    studysetsettings: null
}).upgrade(async (tx) => {
    const oldStudysets = await tx.table("studysets").toArray();
    for (const studyset of oldStudysets) {
        if (studyset?.data?.terms != null && studyset.data.terms.length > 0) {
            let sortOrder = 0;

            for (const [term, def] of studyset.data.terms) {
                await tx.table("terms").add({
                    term: term,
                    def: def,
                    studyset_id: studyset.id,
                    sort_order: sortOrder,
                    created_at: studyset.updated_at,
                    updated_at: studyset.updated_at
                });

                sortOrder++;
            }

            delete studyset.data;

            await tx.table("studysets").put(studyset);
        }
    }
});
db.version(7).stores({
    studysets: '++id, title, updated_at',
    term_progress: "++id, term_id, term_first_reviewed_at, term_last_reviewed_at, " +
        "term_review_count, def_first_reviewed_at, def_last_reviewed_at, " +
        "def_review_count, term_leitner_system_box, def_leitner_system_box, " +
        "term_correct_count, term_incorrect_count, def_correct_count, def_incorrect_count",
}).upgrade((tx) => {
    return tx.table("term_progress").toCollection().modify(row => {
        if (row.term_correct_count == null) {
            row.term_correct_count = 0;
        }
        if (row.term_incorrect_count == null) {
            row.term_incorrect_count = 0;
        }
        if (row.def_correct_count == null) {
            row.def_correct_count = 0;
        }
        if (row.def_incorrect_count == null) {
            row.def_incorrect_count = 0;
        }
    });
});
db.version(8).stores({
    term_confusion_pairs: "++id, term_id, confused_term_id, answered_with, confused_count, last_confused_at",
    practice_tests: "++id, timestamp, studyset_id, questions_correct, questions_total, questions"
});
db.version(9).stores({
    studysets: '++id, title, updatedAt',
    terms: "++id, studysetId, sortOrder, createdAt, updatedAt",
    termProgress: "++id, termId, termFirstReviewedAt, termLastReviewedAt, " +
        "termReviewCount, defFirstReviewedAt, defLastReviewedAt, " +
        "defReviewCount, termLeitnerSystemBox, defLeitnerSystemBox, " +
        "termCorrectCount, termIncorrectCount, defCorrectCount, defIncorrectCount",
    termConfusionPairs: "++id, termId, confusedTermId, answeredWith, confusedCount, lastConfusedAt",
    practiceTests: "++id, timestamp, studysetId, questionsCorrect, questionsTotal"
}).upgrade(async tx => {
    await tx.table("studysets").toCollection().modify(studyset => {
        studyset.updatedAt = studyset.updated_at;
        studyset.updated_at = undefined;
    });
    await tx.table("terms").toCollection().modify(term => {
        term.studysetId = term.studyset_id;
        term.studyset_id = undefined;
        term.sortOrder = term.sort_order;
        term.sort_order = undefined;
        term.createdAt = term.created_at;
        term.created_at = undefined;
        term.updatedAt = term.updated_at;
        term.updated_at = undefined;
    });
    const oldTermProgress = await tx.table("term_progress").toArray();
    for (const row of oldTermProgress) {
        await tx.table("termProgress").add({
            id: row.id,
            studysetId: row.studyset_id,
            termFirstReviewedAt: row.term_first_reviewed_at,
            termLastReviewedAt: row.term_last_reviewed_at,
            termReviewCount: row.term_review_count,
            defFirstReviewedAt: row.def_first_reviewed_at,
            defLastReviewedAt: row.def_last_reviewed_at,
            defReviewCount: row.def_review_count,
            termCorrectCount: row.term_correct_count,
            termIncorrectCount: row.term_incorrect_count,
            defCorrectCount: row.def_correct_count,
            defIncorrectCount: row.def_incorrect_count
        });
    }
    const oldTermConfusionPairs = await tx.table("term_confusion_pairs").toArray();
    for (const row of oldTermConfusionPairs) {
        await tx.table("termConfusionPairs").add({
            id: row.id,
            termId: row.term_id,
            confusedTermId: row.confused_term_id,
            answeredWith: row.answered_with,
            confusedCount: row.confused_count,
            lastConfusedAt: row.last_confused_at
        });
    }
    const oldPracticeTests = await tx.table("practice_tests").toArray();
    for (const row of oldPracticeTests) {
        await tx.table("practiceTests").add({
            id: row.id,
            timestamp: row.timestamp,
            studysetId: row.studyset_id,
            questionsCorrect: row.questions_correct,
            questionsTotal: row.questions_total,
            questions: row.questions
        });
    }
})
db.version(10).stores({
    term_progress: null,
    term_confusion_pairs: null,
    practice_tests: null
})
db.version(11).stores({
    termConfusionPairs: "++id, termId, confusedTermId, [termId+confusedTermId], answeredWith, confusedCount, lastConfusedAt"
})
db.version(12).stores({
    termConfusionPairs: "++id, termId, confusedTermId, [termId+confusedTermId], " +
        "answeredWith, confusedCount, [termId+confusedCount], [confusedTermId+confusedCount], lastConfusedAt"
})
db.version(13).stores({
    terms: "++id, studysetId, sortOrder, [studysetId+sortOrder], createdAt, updatedAt"
})
db.version(14).stores({
    termProgressHistory: "++id, timestamp, termId, termCorrectCount, termIncorrectCount, defCorrectCount, defIncorrectCount"
})
db.version(15).stores({
    images: "++key"
}).upgrade(async tx => {
    await tx.table("studysets").toCollection().modify(studyset => {
        studyset.draft = false;
    });
})

export type { Studyset, Term, PracticeTest, Question, MCQ, TrueFalseQuestion, TermProgress, TermProgressHistory, TermConfusionPair }
export { db };
