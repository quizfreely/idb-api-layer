/*!
 * Quizfreely IDB API Layer, licensed under GPL-3.0-or-later.
 * Copyright (c) 2025-2026 Ehan Ahamed and contributors
 *
 * https://codeberg.org/quizfreely/idb-api-layer
 * https://github.com/quizfreely/idb-api-layer
 */
import Dexie from 'dexie';
import { db } from "./db";
import { idbLayerImg } from "./images";
function isTitleValid(newTitle) {
    return (newTitle.length > 0 &&
        newTitle.length < 9000 &&
        /*
            use regex to make sure title is not just a bunch of spaces
            (if removing all spaces makes it equal to an empty string, it's all spaces)
            notice the exclamation mark for negation
        */
        !(newTitle.replace(/[\s\p{C}]+/gu, "") == ""));
}
export * from "./db";
export * from "./images";
export const idbApiLayer = {
    getStudysetById: async function (id, resolveProps) {
        const studysets = await db.studysets.where("id").equals(id).toArray();
        if (studysets.length == 0) {
            return null;
        }
        if (resolveProps?.terms) {
            studysets[0].terms = await this.getTermsByStudysetId(id, resolveProps.terms === true ? undefined : resolveProps.terms);
        }
        if (resolveProps?.practiceTests) {
            studysets[0].practiceTests = await db.practiceTests.where("studysetIds").equals(id).toArray();
            /* local timestamps are ISO strings in UTC, so alphanumeric/lexical sorting is the same as chronological sorting */
            studysets[0].practiceTests?.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            await Promise.all(studysets[0].practiceTests.map(async (pt) => {
                pt.questions = await db.practiceTestQuestions
                    .where("practiceTestId").equals(pt.id)
                    .sortBy("position");
            }));
        }
        return studysets[0];
    },
    getTermsByStudysetId: async function (studysetId, resolveProps) {
        const terms = await db.terms
            .where("[studysetId+sortOrder]")
            .between([studysetId, Dexie.minKey], [studysetId, Dexie.maxKey], true, true).toArray();
        if (resolveProps?.progress ||
            resolveProps?.topConfusionPairs ||
            resolveProps?.topReverseConfusionPairs ||
            resolveProps?.termImageUrl ||
            resolveProps?.defImageUrl) {
            await Promise.all(terms.map(async (term) => {
                const promises = {};
                if (resolveProps?.progress) {
                    promises.progress = db.termProgress.where("termId").equals(term.id).toArray();
                }
                if (resolveProps?.topConfusionPairs) {
                    promises.topConfusionPairs = this.getTopConfusionPairs(term.id);
                }
                if (resolveProps?.topReverseConfusionPairs) {
                    promises.topReverseConfusionPairs = this.getTopReverseConfusionPairs(term.id);
                }
                if (resolveProps?.termImageUrl && term.termImageKey != null) {
                    promises.termImageUrl = idbLayerImg.getImageObjectUrl(term.termImageKey);
                }
                if (resolveProps?.defImageUrl && term.defImageKey != null) {
                    promises.defImageUrl = idbLayerImg.getImageObjectUrl(term.defImageKey);
                }
                const results = await Promise.all(Object.entries(promises).map(async ([k, p]) => [k, await p]));
                const resolved = Object.fromEntries(results);
                term.progress = resolved.progress?.[0] ?? undefined;
                term.topConfusionPairs = resolved.topConfusionPairs;
                term.topReverseConfusionPairs = resolved.topReverseConfusionPairs;
                term.termImageUrl = term.termImageKey == null ? null : resolved.termImageUrl;
                term.defImageUrl = term.defImageKey == null ? null : resolved.defImageUrl;
            }));
        }
        return terms;
    },
    getTermById: async function (termId, resolveProps) {
        let term = (await db.terms.where("id").equals(termId).toArray())?.[0];
        if (term == null) {
            console.log("(idbApiLayer.getTermById) term not found");
            return term;
        }
        if (resolveProps?.progress) {
            term.progress = (await db.termProgress.where("termId").equals(termId).toArray())?.[0];
        }
        if (resolveProps?.topConfusionPairs) {
            term.topConfusionPairs = await this.getTopConfusionPairs(term.id);
        }
        if (resolveProps?.topReverseConfusionPairs) {
            term.topReverseConfusionPairs = await this.getTopReverseConfusionPairs(term.id);
        }
        if (resolveProps?.termImageUrl) {
            term.termImageUrl = term.termImageKey == null ? null : await idbLayerImg.getImageObjectUrl(term.termImageKey);
        }
        if (resolveProps?.defImageUrl) {
            term.defImageUrl = term.defImageKey == null ? null : await idbLayerImg.getImageObjectUrl(term.defImageKey);
        }
        return term;
    },
    createStudyset: async function ({ title, draft }) {
        const rnISOString = (new Date()).toISOString();
        const newId = await db.studysets.add({
            title: isTitleValid(title) || (draft && title == "") ?
                title : "Untitled Studyset",
            draft,
            createdAt: rnISOString,
            updatedAt: rnISOString
        });
        return newId;
    },
    updateStudyset: async function ({ id, title, draft }) {
        const rnISOString = (new Date()).toISOString();
        await db.studysets.update(id, {
            title: isTitleValid(title) || (draft && title == "") ?
                title : "Untitled Studyset",
            draft,
            updatedAt: rnISOString
        });
    },
    createTerms: async function (studysetId, newTerms) {
        const rnISOString = (new Date()).toISOString();
        let bulkAddNewTerms = [];
        newTerms.forEach(term => {
            bulkAddNewTerms.push({
                term: term.term,
                def: term.def,
                studysetId: studysetId,
                sortOrder: term.sortOrder,
                createdAt: rnISOString,
                updatedAt: rnISOString,
            });
        });
        return await db.terms.bulkAdd(bulkAddNewTerms);
    },
    updateTerms: async function (terms) {
        const rnISOString = (new Date()).toISOString();
        let bulkUpdateTerms = [];
        terms.forEach(term => {
            bulkUpdateTerms.push({
                key: term.id,
                changes: {
                    term: term.term,
                    def: term.def,
                    sortOrder: term.sortOrder,
                    updatedAt: rnISOString,
                }
            });
        });
        if (bulkUpdateTerms.length > 0) {
            await db.terms.bulkUpdate(bulkUpdateTerms);
        }
    },
    deleteTerms: async function (deleteTermIDs) {
        const terms = await db.terms.bulkGet(deleteTermIDs);
        let imageKeysToDelete = [];
        terms.forEach(t => {
            if (t?.termImageKey != null) {
                imageKeysToDelete.push(t.termImageKey);
            }
            if (t?.defImageKey != null) {
                imageKeysToDelete.push(t.defImageKey);
            }
        });
        await idbLayerImg.deleteImages(imageKeysToDelete);
        await db.termProgress.where("termId").anyOf(deleteTermIDs).delete();
        await db.terms.bulkDelete(deleteTermIDs);
    },
    deleteStudyset: async function (id) {
        await this.deleteTerms(await db.terms.where("studysetId").equals(id).primaryKeys());
        await db.studysets.delete(id);
    },
    updateTermProgress: async function (termProgressArray) {
        for (const { termId, termReviewedAt, defReviewedAt, termCorrectIncrease, termIncorrectIncrease, defCorrectIncrease, defIncorrectIncrease } of termProgressArray) {
            const existingProgress = await db.termProgress.where("termId").equals(termId).toArray();
            if (existingProgress?.length > 0) {
                const termCorrectCount = (existingProgress[0].termCorrectCount) + (termCorrectIncrease ?? 0);
                const termIncorrectCount = (existingProgress[0].termIncorrectCount) + (termIncorrectIncrease ?? 0);
                const defCorrectCount = (existingProgress[0].defCorrectCount) + (defCorrectIncrease ?? 0);
                const defIncorrectCount = (existingProgress[0].defIncorrectCount) + (defIncorrectIncrease ?? 0);
                await db.termProgress.update(existingProgress[0].id, {
                    termLastReviewedAt: termReviewedAt != null ?
                        termReviewedAt : existingProgress[0].termLastReviewedAt,
                    termReviewCount: termReviewedAt != null ?
                        (existingProgress[0]?.termReviewCount ?? 0) + 1 :
                        existingProgress[0]?.termReviewCount,
                    defLastReviewedAt: defReviewedAt != null ?
                        defReviewedAt : existingProgress[0].defLastReviewedAt,
                    defReviewCount: defReviewedAt != null ?
                        (existingProgress[0]?.defReviewCount ?? 0) + 1 :
                        existingProgress[0]?.defReviewCount,
                    termCorrectCount: termCorrectCount,
                    termIncorrectCount: termIncorrectCount,
                    defCorrectCount: defCorrectCount,
                    defIncorrectCount: defIncorrectCount
                });
            }
            else {
                await db.termProgress.add({
                    termId: termId,
                    termFirstReviewedAt: termReviewedAt,
                    termLastReviewedAt: termReviewedAt,
                    termReviewCount: termReviewedAt != null ?
                        1 : 0,
                    defFirstReviewedAt: defReviewedAt,
                    defLastReviewedAt: defReviewedAt,
                    defReviewCount: defReviewedAt != null ?
                        1 : 0,
                    termCorrectCount: termCorrectIncrease ?? 0,
                    termIncorrectCount: termIncorrectIncrease ?? 0,
                    defCorrectCount: defCorrectIncrease ?? 0,
                    defIncorrectCount: defIncorrectIncrease ?? 0
                });
            }
        }
    },
    getTopConfusionPairs: async function (termId, resolveProps) {
        const confusionPairs = await db.termConfusionPairs
            .where("[termId+confusedCount]")
            .between([termId, Dexie.minKey], [termId, Dexie.maxKey], true, true).reverse()
            .limit(3)
            .toArray();
        if (resolveProps?.confusedTerm) {
            await Promise.all(confusionPairs.map(async (confusionPair) => {
                if (typeof confusionPair.confusedTermId === "string") {
                    console.error("getTopConfusionPairs: confusedTermId is a string (mabye a UUID), can't resolve confusedTerm");
                    return;
                }
                confusionPair.confusedTerm = await this.getTermById(confusionPair.confusedTermId, resolveProps?.confusedTerm);
            }));
        }
        return confusionPairs;
    },
    getTopReverseConfusionPairs: async function (confusedTermId, resolveProps) {
        const confusionPairs = await db.termConfusionPairs
            .where("[confusedTermId+confusedCount]")
            .between([confusedTermId, Dexie.minKey], [confusedTermId, Dexie.maxKey], true, true).reverse()
            .limit(3)
            .toArray();
        if (resolveProps?.term) {
            await Promise.all(confusionPairs.map(async (confusionPair) => {
                if (typeof confusionPair.termId === "string") {
                    console.error("getTopReverseConfusionPairs: termId is a string (mabye a UUID), can't resolve term");
                    return;
                }
                confusionPair.term = await this.getTermById(confusionPair.termId, resolveProps?.term);
            }));
        }
        return confusionPairs;
    },
    recordConfusionPairs: async function (confusionPairs) {
        for (const confusionPairInput of confusionPairs) {
            if (confusionPairInput.termId == confusionPairInput.confusedTermId) {
                console.log("Skipped confusion pair with same term & confused term ID when recording confusion pairs");
                continue;
            }
            const existingRow = await db.termConfusionPairs.where("[termId+confusedTermId]").equals([
                confusionPairInput.termId,
                confusionPairInput.confusedTermId,
            ]).filter(row => row.answeredWith == confusionPairInput.answeredWith).toArray();
            if (existingRow.length > 0) {
                db.termConfusionPairs.update(existingRow[0].id, {
                    confusedCount: existingRow[0].confusedCount + confusionPairInput.confusedCountIncrease,
                    lastConfusedAt: confusionPairInput.confusedAt
                });
            }
            else {
                db.termConfusionPairs.add({
                    termId: confusionPairInput.termId,
                    confusedTermId: confusionPairInput.confusedTermId,
                    answeredWith: confusionPairInput.answeredWith,
                    confusedCount: confusionPairInput.confusedCountIncrease,
                    lastConfusedAt: confusionPairInput.confusedAt
                });
            }
        }
        return true;
    },
    recordPracticeTest: async function (practiceTest) {
        return await db.transaction('rw', [db.practiceTests, db.practiceTestQuestions, db.termProgress, db.terms], async () => {
            const rnISOString = (new Date()).toISOString();
            const termProgressMap = new Map();
            const studysetIds = new Set();
            const involvedTermIds = new Set();
            let questionsCorrect = 0;
            let questionsTotal = 0;
            const questionsToInsert = [];
            if (practiceTest.questions && Array.isArray(practiceTest.questions)) {
                questionsTotal = practiceTest.questions.length;
                for (let i = 0; i < practiceTest.questions.length; i++) {
                    const q = practiceTest.questions[i];
                    if (!q)
                        continue;
                    let termId = null;
                    let answerWith = null;
                    let correct = false;
                    let type = "mcq";
                    let termSnapshot = "";
                    let defSnapshot = "";
                    let qData = {};
                    if (q.mcq) {
                        type = "mcq";
                        if (!q.mcq.term)
                            throw new Error("MCQ question is missing term");
                        termId = q.mcq.term.id;
                        termSnapshot = q.mcq.term.termSnapshot || q.mcq.term.term || "";
                        defSnapshot = q.mcq.term.defSnapshot || q.mcq.term.def || "";
                        answerWith = q.mcq.answerWith;
                        correct = !!q.mcq.correct;
                        qData = {
                            distractors: (q.mcq.distractors || []).map((d) => {
                                if (d.id)
                                    involvedTermIds.add(d.id);
                                return {
                                    id: d.id,
                                    termSnapshot: d.termSnapshot || d.term || "",
                                    defSnapshot: d.defSnapshot || d.def || ""
                                };
                            }),
                            correctChoiceIndex: q.mcq.correctChoiceIndex,
                            answeredIndex: q.mcq.answeredIndex
                        };
                    }
                    else if (q.tfq) {
                        type = "tfq";
                        if (!q.tfq.term)
                            throw new Error("TFQ question is missing term");
                        termId = q.tfq.term.id;
                        termSnapshot = q.tfq.term.termSnapshot || q.tfq.term.term || "";
                        defSnapshot = q.tfq.term.defSnapshot || q.tfq.term.def || "";
                        answerWith = q.tfq.answerWith;
                        correct = !!q.tfq.correct;
                        if (q.tfq.distractor?.id)
                            involvedTermIds.add(q.tfq.distractor.id);
                        qData = {
                            distractor: q.tfq.distractor ? {
                                id: q.tfq.distractor.id,
                                termSnapshot: q.tfq.distractor.termSnapshot || q.tfq.distractor.term || "",
                                defSnapshot: q.tfq.distractor.defSnapshot || q.tfq.distractor.def || ""
                            } : null,
                            answeredBool: q.tfq.answeredBool
                        };
                    }
                    else if (q.frq) {
                        type = "frq";
                        if (!q.frq.term)
                            throw new Error("FRQ question is missing term");
                        termId = q.frq.term.id;
                        termSnapshot = q.frq.term.termSnapshot || q.frq.term.term || "";
                        defSnapshot = q.frq.term.defSnapshot || q.frq.term.def || "";
                        answerWith = q.frq.answerWith;
                        correct = !!q.frq.correct || !!q.frq.userMarkedCorrect;
                        qData = {
                            answeredString: q.frq.answeredString || "",
                            userMarkedCorrect: !!q.frq.userMarkedCorrect
                        };
                    }
                    if (correct)
                        questionsCorrect++;
                    if (termId == null)
                        continue;
                    involvedTermIds.add(termId);
                    questionsToInsert.push({
                        termId,
                        termSnapshot,
                        defSnapshot,
                        type,
                        position: i,
                        correct,
                        answerWith,
                        data: qData
                    });
                    let tp = termProgressMap.get(termId);
                    if (!tp) {
                        tp = {
                            termId,
                            termReviewedAt: null,
                            defReviewedAt: null,
                            termCorrectIncrease: 0,
                            termIncorrectIncrease: 0,
                            defCorrectIncrease: 0,
                            defIncorrectIncrease: 0
                        };
                        termProgressMap.set(termId, tp);
                    }
                    if (correct) {
                        if (answerWith === "DEF") {
                            tp.defCorrectIncrease += 1;
                            tp.defReviewedAt = rnISOString;
                        }
                        else {
                            tp.termCorrectIncrease += 1;
                            tp.termReviewedAt = rnISOString;
                        }
                    }
                    else {
                        if (answerWith === "DEF") {
                            tp.defIncorrectIncrease += 1;
                            tp.defReviewedAt = rnISOString;
                        }
                        else {
                            tp.termIncorrectIncrease += 1;
                            tp.termReviewedAt = rnISOString;
                        }
                    }
                }
            }
            // Fetch studysetIds for all involved terms
            const allTerms = await db.terms.bulkGet(Array.from(involvedTermIds));
            allTerms.forEach(t => { if (t?.studysetId)
                studysetIds.add(t.studysetId); });
            for (const tp of termProgressMap.values()) {
                const existingProgress = await db.termProgress.where("termId").equals(tp.termId).toArray();
                if (existingProgress?.length > 0) {
                    await db.termProgress.update(existingProgress[0].id, {
                        termLastReviewedAt: tp.termReviewedAt != null ?
                            tp.termReviewedAt : existingProgress[0].termLastReviewedAt,
                        termReviewCount: tp.termReviewedAt != null ?
                            (existingProgress[0]?.termReviewCount ?? 0) + 1 :
                            existingProgress[0]?.termReviewCount,
                        defLastReviewedAt: tp.defReviewedAt != null ?
                            tp.defReviewedAt : existingProgress[0].defLastReviewedAt,
                        defReviewCount: tp.defReviewedAt != null ?
                            (existingProgress[0]?.defReviewCount ?? 0) + 1 :
                            existingProgress[0]?.defReviewCount,
                        termCorrectCount: (existingProgress[0].termCorrectCount) + (tp.termCorrectIncrease),
                        termIncorrectCount: (existingProgress[0].termIncorrectCount) + (tp.termIncorrectIncrease),
                        defCorrectCount: (existingProgress[0].defCorrectCount) + (tp.defCorrectIncrease),
                        defIncorrectCount: (existingProgress[0].defIncorrectCount) + (tp.defIncorrectIncrease)
                    });
                }
                else {
                    await db.termProgress.add({
                        termId: tp.termId,
                        termFirstReviewedAt: tp.termReviewedAt,
                        termLastReviewedAt: tp.termReviewedAt,
                        termReviewCount: tp.termReviewedAt != null ? 1 : 0,
                        defFirstReviewedAt: tp.defReviewedAt,
                        defLastReviewedAt: tp.defReviewedAt,
                        defReviewCount: tp.defReviewedAt != null ? 1 : 0,
                        termCorrectCount: tp.termCorrectIncrease,
                        termIncorrectCount: tp.termIncorrectIncrease,
                        defCorrectCount: tp.defCorrectIncrease,
                        defIncorrectCount: tp.defIncorrectIncrease
                    });
                }
            }
            const ptRecord = {
                timestamp: practiceTest.timestamp || rnISOString,
                questionsCorrect,
                questionsTotal,
                studysetIds: Array.from(studysetIds)
            };
            const ptId = await db.practiceTests.add(ptRecord);
            for (const q of questionsToInsert) {
                q.practiceTestId = ptId;
                await db.practiceTestQuestions.add(q);
            }
            return await this.getPracticeTestWithQuestions(ptId);
        });
    },
    getPracticeTestWithQuestions: async function (ptId) {
        const pt = await db.practiceTests.get(ptId);
        if (!pt)
            return null;
        pt.questions = await db.practiceTestQuestions
            .where("practiceTestId").equals(ptId)
            .sortBy("position");
        return pt;
    },
    updatePracticeTestQuestion: async function (id, correct, userMarkedCorrect) {
        return await db.transaction('rw', [db.practiceTests, db.practiceTestQuestions, db.termProgress], async () => {
            const question = await db.practiceTestQuestions.get(id);
            if (!question)
                throw new Error("Question not found");
            const wasCorrect = question.correct;
            const isCorrect = correct;
            if (wasCorrect === isCorrect && question.type === "frq" && question.data.userMarkedCorrect === userMarkedCorrect) {
                return question;
            }
            // Update question
            const newData = { ...question.data };
            if (question.type === "frq") {
                newData.userMarkedCorrect = userMarkedCorrect;
            }
            await db.practiceTestQuestions.update(id, {
                correct: isCorrect,
                data: newData
            });
            // Update practice test accuracy
            if (wasCorrect !== isCorrect) {
                const pt = await db.practiceTests.get(question.practiceTestId);
                if (pt) {
                    await db.practiceTests.update(pt.id, {
                        questionsCorrect: pt.questionsCorrect + (isCorrect ? 1 : -1)
                    });
                }
                // Update term progress
                const existingProgress = await db.termProgress.where("termId").equals(question.termId).toArray();
                if (existingProgress?.length > 0) {
                    const changes = {};
                    if (question.answerWith === "DEF") {
                        changes.defCorrectCount = existingProgress[0].defCorrectCount + (isCorrect ? 1 : -1);
                        changes.defIncorrectCount = existingProgress[0].defIncorrectCount + (isCorrect ? -1 : 1);
                    }
                    else {
                        changes.termCorrectCount = existingProgress[0].termCorrectCount + (isCorrect ? 1 : -1);
                        changes.termIncorrectCount = existingProgress[0].termIncorrectCount + (isCorrect ? -1 : 1);
                    }
                    await db.termProgress.update(existingProgress[0].id, changes);
                }
            }
            return await db.practiceTestQuestions.get(id);
        });
    },
    getPracticeTestsByTermId: async function (termId) {
        const questionIds = await db.practiceTestQuestions
            .where("termId").equals(termId)
            .primaryKeys();
        const questions = await db.practiceTestQuestions.bulkGet(questionIds);
        const ptIds = new Set();
        questions.forEach(q => { if (q)
            ptIds.add(q.practiceTestId); });
        const tests = await db.practiceTests.bulkGet(Array.from(ptIds));
        const filteredTests = tests.filter((t) => t !== undefined);
        await Promise.all(filteredTests.map(async (pt) => {
            pt.questions = await db.practiceTestQuestions
                .where("practiceTestId").equals(pt.id)
                .sortBy("position");
        }));
        filteredTests.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        return filteredTests;
    }
};
