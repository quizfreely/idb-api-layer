import { test, expect } from '@playwright/test';

test('create, view, update, & delete studyset', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async () => {
    const id = await window.idbApiLayer.createStudyset({
      title: "",
      draft: true
    });
    let studyset = await window.idbApiLayer.getStudysetById(id);
    expect(studyset?.title).toEqual("");
    expect(studyset?.draft).toStrictEqual(true);

    await window.idbApiLayer.updateStudyset({
      id: id,
      title: "",
      draft: false
    });
    studyset = await window.idbApiLayer.getStudysetById(id);
    expect(studyset?.title).toEqual("Untitled Studyset");
    expect(studyset?.draft).toStrictEqual(false);

    await window.idbApiLayer.updateStudyset({
      id: id,
      title: "New Title!!!",
      draft: false
    });
    studyset = await window.idbApiLayer.getStudysetById(id);
    expect(studyset?.title).toEqual("New Title!!!");
    expect(studyset?.draft).toStrictEqual(false);
  })
});
