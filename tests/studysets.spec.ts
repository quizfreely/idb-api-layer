import { test, expect } from '@playwright/test';

test('create, view, update, & delete studyset', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const id = await window.idbApiLayer.createStudyset({
      title: "",
      draft: true
    });

    let studyset = await window.idbApiLayer.getStudysetById(id);

    await window.idbApiLayer.updateStudyset({
      id,
      title: "",
      draft: false
    });

    let updated1 = await window.idbApiLayer.getStudysetById(id);

    await window.idbApiLayer.updateStudyset({
      id,
      title: "New Title!!!",
      draft: false
    });

    let updated2 = await window.idbApiLayer.getStudysetById(id);

    return { studyset, updated1, updated2 };
  });

  expect(result.studyset?.title).toBe("");
  expect(result.studyset?.draft).toBe(true);

  expect(result.updated1?.title).toBe("Untitled Studyset");
  expect(result.updated1?.draft).toBe(false);

  expect(result.updated2?.title).toBe("New Title!!!");
  expect(result.updated2?.draft).toBe(false);
});