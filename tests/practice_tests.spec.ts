import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('practice tests: recording and retrieval in studyset', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S", draft: false });
    await window.idbApiLayer.createTerms(sid, [
      { term: "T1", def: "D1", sortOrder: 0 }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const t1 = { id: terms[0].id, term: terms[0].term, def: terms[0].def };

    // Record two practice tests at different timestamps
    const time1 = "2024-01-01T10:00:00.000Z";
    const time2 = "2024-01-02T10:00:00.000Z";

    await window.idbApiLayer.recordPracticeTest({
        timestamp: time1,
        questions: [
          { mcq: { term: t1, answerWith: "DEF", correct: true, correctChoiceIndex: 0, answeredIndex: 0, distractors: [] } }
        ]
    });

    await window.idbApiLayer.recordPracticeTest({
        timestamp: time2,
        questions: [
          { mcq: { term: t1, answerWith: "DEF", correct: false, correctChoiceIndex: 0, answeredIndex: 1, distractors: [t1] } }
        ]
    });

    const studysetWithTests = await window.idbApiLayer.getStudysetById(sid, { practiceTests: true });
    return { studysetWithTests };
  });

  expect(result.studysetWithTests?.practiceTests).toHaveLength(2);
  // Should be sorted by timestamp descending
  expect(result.studysetWithTests?.practiceTests?.[0].timestamp).toBe("2024-01-02T10:00:00.000Z");
  expect(result.studysetWithTests?.practiceTests?.[0].questionsCorrect).toBe(0);
  expect(result.studysetWithTests?.practiceTests?.[0].questions).toHaveLength(1);
  expect(result.studysetWithTests?.practiceTests?.[0].questions[0].mcq?.term.id).toBeDefined();

  expect(result.studysetWithTests?.practiceTests?.[1].timestamp).toBe("2024-01-01T10:00:00.000Z");
  expect(result.studysetWithTests?.practiceTests?.[1].questionsCorrect).toBe(1);
});

test('practice tests: update question and retrieval by term', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S", draft: false });
    await window.idbApiLayer.createTerms(sid, [
      { term: "T1", def: "D1", sortOrder: 0 },
      { term: "T2", def: "D2", sortOrder: 1 }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const t1 = { id: terms[0].id, term: terms[0].term, def: terms[0].def };
    const t2 = { id: terms[1].id, term: terms[1].term, def: terms[1].def };

    const pt = await window.idbApiLayer.recordPracticeTest({
        questions: [
          { frq: { term: t1, answerWith: "DEF", correct: false, answeredString: "wrong" } }
        ]
    });

    const questionId = pt.questions[0].id;
    // Mark FRQ as manually correct
    await window.idbApiLayer.updatePracticeTestQuestion(questionId, true, true);

    const testsForT1 = await window.idbApiLayer.getPracticeTestsByTermId(t1.id);
    const updatedPt = await window.db.practiceTests.get(pt.id);
    const updatedQuestion = await window.db.practiceTestQuestions.get(questionId);

    return { testsForT1, updatedPt, updatedQuestion };
  });

  expect(result.testsForT1).toHaveLength(1);
  expect(result.updatedPt.questionsCorrect).toBe(1);
  expect(result.updatedPt.questionsTotal).toBe(1);
  expect(result.updatedQuestion.correct).toBe(true);
  expect(result.updatedQuestion.data.userMarkedCorrect).toBe(true);
});

test('practice tests: update FRQ via userMarkedCorrect only', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S", draft: false });
    await window.idbApiLayer.createTerms(sid, [
      { term: "T1", def: "D1", sortOrder: 0 }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const t1 = { id: terms[0].id, term: terms[0].term, def: terms[0].def };

    // Record FRQ as incorrect (correct: false, no userMarkedCorrect)
    const pt = await window.idbApiLayer.recordPracticeTest({
        questions: [
          { frq: { term: t1, answerWith: "DEF", correct: false, answeredString: "wrong" } }
        ]
    });

    const questionId = pt.questions[0].id;
    const ptBefore = await window.db.practiceTests.get(pt.id);

    // Update with same correct=false but userMarkedCorrect=true
    await window.idbApiLayer.updatePracticeTestQuestion(questionId, false, true);

    const updatedPt = await window.db.practiceTests.get(pt.id);
    const updatedQuestion = await window.db.practiceTestQuestions.get(questionId);

    return { ptBefore, updatedPt, updatedQuestion };
  });

  expect(result.ptBefore.questionsCorrect).toBe(0);
  expect(result.updatedPt.questionsCorrect).toBe(1);
  expect(result.updatedPt.questionsTotal).toBe(1);
  expect(result.updatedQuestion.correct).toBe(false);
  expect(result.updatedQuestion.data.userMarkedCorrect).toBe(true);
});
