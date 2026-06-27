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
          { mcq: { term: t1, answerWith: "DEF", correct: true, answeredIndex: 0, distractors: [] } }
        ]
    });

    await window.idbApiLayer.recordPracticeTest({
        timestamp: time2,
        questions: [
          { mcq: { term: t1, answerWith: "DEF", correct: false, answeredIndex: 1, distractors: [t1] } }
        ]
    });

    const studysetWithTests = await window.idbApiLayer.getStudysetById(sid, { practiceTests: true });
    return { studysetWithTests };
  });

  expect(result.studysetWithTests?.practiceTests).toHaveLength(2);
  // Should be sorted by timestamp descending
  expect(result.studysetWithTests?.practiceTests?.[0].timestamp).toBe("2024-01-02T10:00:00.000Z");
  expect(result.studysetWithTests?.practiceTests?.[0].questionsCorrect).toBe(0);
  expect(result.studysetWithTests?.practiceTests?.[1].timestamp).toBe("2024-01-01T10:00:00.000Z");
  expect(result.studysetWithTests?.practiceTests?.[1].questionsCorrect).toBe(1);
});

test('practice tests: update and retrieval by term', async ({ page }) => {
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
          { tfq: { term: t1, answerWith: "DEF", correct: true, answeredBool: true } }
        ]
    });

    // Update the test to include another term
    await window.idbApiLayer.updatePracticeTest(pt.id, {
      questions: [
        { tfq: { term: t1, answerWith: "DEF", correct: true, answeredBool: true } },
        { frq: { term: t2, answerWith: "TERM", correct: false, answeredString: "wrong" } }
      ]
    });

    const testsForT1 = await window.idbApiLayer.getPracticeTestsByTermId(t1.id);
    const testsForT2 = await window.idbApiLayer.getPracticeTestsByTermId(t2.id);
    const updatedPt = await window.db.practiceTests.get(pt.id);

    return { testsForT1, testsForT2, updatedPt };
  });

  expect(result.testsForT1).toHaveLength(1);
  expect(result.testsForT2).toHaveLength(1);
  expect(result.updatedPt.questionsCorrect).toBe(1);
  expect(result.updatedPt.questionsTotal).toBe(2);
  expect(result.updatedPt.termIds).toContain(result.testsForT1[0].termIds[0]);
  expect(result.updatedPt.termIds).toContain(result.testsForT2[0].termIds[1]);
});
