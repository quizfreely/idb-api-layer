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

    // Record two practice tests at different timestamps
    const time1 = "2024-01-01T10:00:00.000Z";
    const time2 = "2024-01-02T10:00:00.000Z";

    await window.idbApiLayer.recordPracticeTest({
        studysetId: sid,
        timestamp: time1,
        questionsCorrect: 8,
        questionsTotal: 10
    });

    await window.idbApiLayer.recordPracticeTest({
        studysetId: sid,
        timestamp: time2,
        questionsCorrect: 9,
        questionsTotal: 10
    });

    const studysetWithTests = await window.idbApiLayer.getStudysetById(sid, { practiceTests: true });
    return { studysetWithTests };
  });

  expect(result.studysetWithTests?.practiceTests).toHaveLength(2);
  // Should be sorted by timestamp descending
  expect(result.studysetWithTests?.practiceTests?.[0].timestamp).toBe("2024-01-02T10:00:00.000Z");
  expect(result.studysetWithTests?.practiceTests?.[1].timestamp).toBe("2024-01-01T10:00:00.000Z");
});
