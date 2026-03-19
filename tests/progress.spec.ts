import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('updateTermProgress: initial and update', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S", draft: false });
    await window.idbApiLayer.createTerms(sid, [
        { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "", studysetId: sid }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const tid = terms[0].id;

    const rnISOString = (new Date()).toISOString();

    // Initial progress
    await window.idbApiLayer.updateTermProgress([{
        termId: tid,
        termReviewedAt: rnISOString,
        termCorrectIncrease: 1,
        termLeitnerSystemBox: 1
    }]);

    let termWithProgress = await window.idbApiLayer.getTermById(tid, { progress: true, progressHistory: true });
    const p1 = termWithProgress?.progress;
    const h1 = termWithProgress?.progressHistory;

    // Update progress
    await window.idbApiLayer.updateTermProgress([{
        termId: tid,
        defReviewedAt: rnISOString,
        defCorrectIncrease: 2,
        defLeitnerSystemBox: 2
    }]);

    termWithProgress = await window.idbApiLayer.getTermById(tid, { progress: true, progressHistory: true });
    const p2 = termWithProgress?.progress;
    const h2 = termWithProgress?.progressHistory;

    return { p1, h1, p2, h2 };
  });

  expect(result.p1?.termCorrectCount).toBe(1);
  expect(result.p1?.termReviewCount).toBe(1);
  expect(result.p1?.termLeitnerSystemBox).toBe(1);
  expect(result.h1).toHaveLength(1);

  expect(result.p2?.termCorrectCount).toBe(1);
  expect(result.p2?.defCorrectCount).toBe(2);
  expect(result.p2?.defReviewCount).toBe(1);
  expect(result.p2?.defLeitnerSystemBox).toBe(2);
  expect(result.p2?.termLeitnerSystemBox).toBe(1);
  expect(result.h2).toHaveLength(2);
});
