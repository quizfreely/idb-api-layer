/*!
 * Quizfreely IDB API Layer, licensed under GPL-3.0-or-later.
 * Copyright (c) 2025-2026 Ehan Ahamed and contributors
 *
 * https://codeberg.org/quizfreely/idb-api-layer
 * https://github.com/quizfreely/idb-api-layer
 */
import { Dexie, type EntityTable } from "dexie";
interface Studyset {
    id: number;
    title: string;
    draft: boolean;
    createdAt: string;
    updatedAt: string;
    terms?: Term[];
    practiceTests?: PracticeTest[];
}
interface Term {
    id: number;
    term: string;
    def: string;
    termImageUrl?: string | null;
    defImageUrl?: string | null;
    termImageKey?: number;
    defImageKey?: number;
    sortOrder: number;
    studysetId: number;
    createdAt: string;
    updatedAt: string;
    progress?: TermProgress;
    topConfusionPairs?: TermConfusionPair[];
    topReverseConfusionPairs?: TermConfusionPair[];
}
interface TermAtp {
    id: number | string;
    termSnapshot: string;
    defSnapshot: string;
}
interface PracticeTest {
    id: number;
    studysetIds: (number | string)[];
    timestamp: string;
    questionsCorrect: number;
    questionsTotal: number;
    questions?: PracticeTestQuestion[];
}
interface PracticeTestQuestion {
    id: number;
    practiceTestId: number;
    termId: number | string;
    termSnapshot: string;
    defSnapshot: string;
    type: "mcq" | "tfq" | "frq";
    position: number;
    correct: boolean;
    answerWith: string;
    data: MCQData | TFQData | FRQData;
}
interface MCQData {
    distractors: TermAtp[];
    correctChoiceIndex: number;
    answeredIndex: number | null;
}
interface TFQData {
    distractor?: TermAtp | null;
    answeredBool: boolean;
}
interface FRQData {
    answeredString: string;
    userMarkedCorrect?: boolean;
}
interface Question {
    id?: number;
    mcq?: MCQ;
    tfq?: TFQ;
    frq?: FRQ;
}
interface MCQ {
    answerWith: string;
    term: TermAtp;
    correct: boolean;
    correctChoiceIndex: number;
    answeredIndex: number | null;
    distractors: TermAtp[];
}
interface TFQ {
    answerWith: string;
    term: TermAtp;
    correct: boolean;
    answeredBool: boolean;
    distractor?: TermAtp;
}
interface FRQ {
    answerWith: string;
    term: TermAtp;
    correct: boolean;
    userMarkedCorrect?: boolean;
    answeredString: string;
}
interface TermProgress {
    id: number;
    termId: number | string;
    termCorrectCount: number;
    termIncorrectCount: number;
    termReviewCount: number;
    defCorrectCount: number;
    defIncorrectCount: number;
    defReviewCount: number;
    termFirstReviewedAt?: string;
    termLastReviewedAt?: string;
    defFirstReviewedAt?: string;
    defLastReviewedAt?: string;
}
interface TermConfusionPair {
    id: number;
    termId: number | string;
    confusedTermId: number | string;
    answeredWith: string;
    confusedCount: number;
    lastConfusedAt: string;
    term?: Omit<Term, "topConfusionPairs" | "topReverseConfusionPairs">;
    confusedTerm?: Omit<Term, "topConfusionPairs" | "topReverseConfusionPairs">;
}
interface Image {
    key: number;
    blob: Blob;
}
declare const db: Dexie & {
    studysets: EntityTable<Studyset, "id">;
    terms: EntityTable<Term, "id">;
    practiceTests: EntityTable<PracticeTest, "id">;
    practiceTestQuestions: EntityTable<PracticeTestQuestion, "id">;
    termProgress: EntityTable<TermProgress, "id">;
    termConfusionPairs: EntityTable<TermConfusionPair, "id">;
    images: EntityTable<Image, "key">;
};
export type { Studyset, Term, TermAtp, PracticeTest, PracticeTestQuestion, MCQData, TFQData, FRQData, Question, MCQ, TFQ, FRQ, TermProgress, TermConfusionPair };
export { db };
