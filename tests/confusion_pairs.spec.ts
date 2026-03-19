import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('confusion pairs: recording and retrieval', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S", draft: false });
    await window.idbApiLayer.createTerms(sid, [
        { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "", studysetId: sid },
        { term: "t2", def: "d2", sortOrder: 1, createdAt: "", updatedAt: "", studysetId: sid },
        { term: "t3", def: "d3", sortOrder: 2, createdAt: "", updatedAt: "", studysetId: sid }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const tid1 = terms[0].id;
    const tid2 = terms[1].id;
    const tid3 = terms[2].id;

    const rnISOString = (new Date()).toISOString();

    // Record some confusions
    await window.idbApiLayer.recordConfusionPairs([
        { termId: tid1, confusedTermId: tid2, answeredWith: "def", confusedCountIncrease: 5, confusedAt: rnISOString },
        { termId: tid1, confusedTermId: tid3, answeredWith: "def", confusedCountIncrease: 2, confusedAt: rnISOString },
    ]);

    // Record another confusion with same pair to update count
    await window.idbApiLayer.recordConfusionPairs([
        { termId: tid1, confusedTermId: tid2, answeredWith: "def", confusedCountIncrease: 1, confusedAt: rnISOString },
    ]);

    const topForT1 = await window.idbApiLayer.getTopConfusionPairs(tid1, { confusedTerm: true });
    const reverseForT2 = await window.idbApiLayer.getTopReverseConfusionPairs(tid2, { term: true });

    return { topForT1, reverseForT2 };
  });

  expect(result.topForT1).toHaveLength(2);
  expect(result.topForT1[0].confusedTermId).toBe(result.topForT1[0].confusedTerm?.id);
  expect(result.topForT1[0].confusedCount).toBe(6); // 5 + 1
  expect(result.topForT1[1].confusedCount).toBe(2);

  expect(result.reverseForT2).toHaveLength(1);
  expect(result.reverseForT2[0].termId).toBe(result.reverseForT2[0].term?.id);
  expect(result.reverseForT2[0].confusedCount).toBe(6);
});
