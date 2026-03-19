import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('create, view, update, & delete studyset', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const id = await window.idbApiLayer.createStudyset({
      title: "Initial Title",
      draft: true
    });

    let studyset = await window.idbApiLayer.getStudysetById(id);

    await window.idbApiLayer.updateStudyset({
      id,
      title: "Updated Title",
      draft: false
    });

    let updated = await window.idbApiLayer.getStudysetById(id);

    await window.idbApiLayer.deleteStudyset(id);
    let deleted = await window.idbApiLayer.getStudysetById(id);

    return { studyset, updated, deleted };
  });

  expect(result.studyset?.title).toBe("Initial Title");
  expect(result.studyset?.draft).toBe(true);

  expect(result.updated?.title).toBe("Updated Title");
  expect(result.updated?.draft).toBe(false);

  expect(result.deleted).toBeNull();
});

test('getStudysetById with resolveProps', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const id = await window.idbApiLayer.createStudyset({
      title: "Studyset with terms and tests",
      draft: false
    });

    await window.idbApiLayer.createTerms(id, [
      { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "" },
      { term: "t2", def: "d2", sortOrder: 1, createdAt: "", updatedAt: "" }
    ]);

    await window.idbApiLayer.recordPracticeTest({
      studysetId: id,
      timestamp: (new Date()).toISOString(),
      questionsCorrect: 5,
      questionsTotal: 10
    });

    let fullStudyset = await window.idbApiLayer.getStudysetById(id, {
      terms: true,
      practiceTests: true
    });

    return { fullStudyset };
  });

  expect(result.fullStudyset?.terms).toHaveLength(2);
  expect(result.fullStudyset?.practiceTests).toHaveLength(1);
});

test('isTitleValid logic through create/updateStudyset', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const id1 = await window.idbApiLayer.createStudyset({
      title: "   ", // All spaces
      draft: false
    });
    const s1 = await window.idbApiLayer.getStudysetById(id1);

    const id2 = await window.idbApiLayer.createStudyset({
      title: "", // Empty but draft
      draft: true
    });
    const s2 = await window.idbApiLayer.getStudysetById(id2);

    return { s1, s2 };
  });

  expect(result.s1?.title).toBe("Untitled Studyset");
  expect(result.s2?.title).toBe("");
});
