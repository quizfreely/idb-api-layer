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

    const terms = await window.idbApiLayer.getTermsByStudysetId(id);
    await window.idbApiLayer.recordPracticeTest({
      timestamp: (new Date()).toISOString(),
      questions: [
        { mcq: { term: { id: terms[0].id, term: terms[0].term, def: terms[0].def }, answerWith: "DEF", correct: true, answeredIndex: 0, distractors: [] } }
      ]
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

test('getStudysetById with reviewEventStatsByDay resolveProps', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const id = await window.idbApiLayer.createStudyset({
      title: "Studyset with review stats",
      draft: false
    });

    await window.idbApiLayer.createTerms(id, [
      { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "" },
      { term: "t2", def: "d2", sortOrder: 1, createdAt: "", updatedAt: "" }
    ]);

    const terms = await window.idbApiLayer.getTermsByStudysetId(id);

    const localNoon = (daysAgo: number) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    };
    const today = localNoon(0);
    const twoDaysAgo = localNoon(2);
    const tenDaysAgo = localNoon(10);

    const recordTest = async (timestamp: string, results: boolean[]) => {
      await window.idbApiLayer.recordPracticeTest({
        timestamp,
        questions: results.map((correct, i) => ({
          mcq: {
            term: { id: terms[i % 2].id, term: terms[i % 2].term, def: terms[i % 2].def },
            answerWith: "DEF",
            correct,
            answeredIndex: correct ? 0 : 1,
            distractors: []
          }
        }))
      });
    };

    await recordTest(today, [true, true, false]);
    await recordTest(twoDaysAgo, [false]);
    await recordTest(tenDaysAgo, [true]);

    const dayKey = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const todayKey = dayKey(today);
    const twoDaysAgoKey = dayKey(twoDaysAgo);

    const stats7 = (await window.idbApiLayer.getStudysetById(id, { reviewEventStatsByDay: true }))?.reviewEventStatsByDay;
    const stats2 = (await window.idbApiLayer.getStudysetById(id, { reviewEventStatsByDay: 2 }))?.reviewEventStatsByDay;

    return { stats7, stats2, todayKey, twoDaysAgoKey };
  });

  expect(result.stats7).toEqual([
    { timestamp: result.twoDaysAgoKey, correct: 0, incorrect: 1 },
    { timestamp: result.todayKey, correct: 2, incorrect: 1 }
  ]);
  expect(result.stats2).toEqual([
    { timestamp: result.todayKey, correct: 2, incorrect: 1 }
  ]);
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
