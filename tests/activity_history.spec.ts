import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('activityHistory: merges practice tests and match activities, sorted by recency', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "Local Set", draft: false });
    await window.idbApiLayer.createTerms(sid, [
      { term: "T1", def: "D1", sortOrder: 0 },
      { term: "T2", def: "D2", sortOrder: 1 }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const t1 = { id: terms[0].id, term: terms[0].term, def: terms[0].def };
    const t2 = { id: terms[1].id, term: terms[1].term, def: terms[1].def };

    await window.idbApiLayer.recordPracticeTest({
      timestamp: "2024-01-01T10:00:00.000Z",
      questions: [
        { mcq: { term: t1, answerWith: "DEF", correct: true, correctChoiceIndex: 0, answeredIndex: 0, distractors: [] } }
      ]
    });
    await window.idbApiLayer.recordMatchActivity({
      termIds: [t2.id],
      incorrectPairIds: [[t2.id, t1.id]],
      durationMs: 5000
    });
    await window.idbApiLayer.recordPracticeTest({
      timestamp: "2024-01-03T10:00:00.000Z",
      questions: [
        { frq: { term: t2, answerWith: "TERM", correct: false, answeredString: "wrong" } }
      ]
    });

    const history = (await window.idbApiLayer.activityHistory({ last: 10 })) as any[];
    return { history };
  });

  expect(result.history).toHaveLength(3);

  // newest first: match activity (recorded now), practice test (01-03), practice test (01-01)
  expect(result.history[0]).toMatchObject({
    id: expect.any(Number),
    durationMs: 5000
  });
  expect(result.history[0].incorrectPairIds).toHaveLength(1);
  expect(result.history[0].incorrectPairIds[0]).toHaveLength(2);
  expect(result.history[0].studysets).toHaveLength(1);
  expect(result.history[0].studysets[0].title).toBe("Local Set");

  expect(result.history[1]).toMatchObject({
    id: expect.any(Number),
    timestamp: "2024-01-03T10:00:00.000Z",
    questionsCorrect: 0,
    questionsTotal: 1
  });
  expect(result.history[1].studysets).toHaveLength(1);
  expect(result.history[1].studysets[0].title).toBe("Local Set");

  expect(result.history[2]).toMatchObject({
    id: expect.any(Number),
    timestamp: "2024-01-01T10:00:00.000Z",
    questionsCorrect: 1,
    questionsTotal: 1
  });
  expect(result.history[2].studysets).toHaveLength(1);
});

test('activityHistory: last limits the returned array length', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "Local Set", draft: false });
    await window.idbApiLayer.createTerms(sid, [
      { term: "T1", def: "D1", sortOrder: 0 }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const t1 = { id: terms[0].id, term: terms[0].term, def: terms[0].def };

    for (let i = 0; i < 5; i++) {
      await window.idbApiLayer.recordPracticeTest({
        timestamp: `2024-01-0${i + 1}T10:00:00.000Z`,
        questions: [
          { mcq: { term: t1, answerWith: "DEF", correct: true, correctChoiceIndex: 0, answeredIndex: 0, distractors: [] } }
        ]
      });
    }

    const history = (await window.idbApiLayer.activityHistory({ last: 2 })) as any[];
    return { history };
  });

  expect(result.history).toHaveLength(2);
  expect(result.history[0].timestamp).toBe("2024-01-05T10:00:00.000Z");
  expect(result.history[1].timestamp).toBe("2024-01-04T10:00:00.000Z");
});

test('activityHistory: resolves cloud studysets via callback', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const uuidTerm = "aaaaaaaa-1111-2222-3333-444444444444";
    const uuidStudyset = "cccccccc-1111-2222-3333-444444444444";
    const cloudStudyset = {
      id: uuidStudyset,
      title: "Cloud Set",
      draft: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    };

    await window.idbApiLayer.recordMatchActivity({
      termIds: [uuidTerm],
      incorrectPairIds: [[uuidTerm, uuidTerm]],
      durationMs: 3000
    }, async (cloudTermIds) => cloudTermIds.map(() => uuidStudyset));

    await window.idbApiLayer.recordPracticeTest({
      timestamp: "2024-01-02T10:00:00.000Z",
      questions: [
        { mcq: { term: { id: uuidTerm, term: "T", def: "D" }, answerWith: "DEF", correct: true, correctChoiceIndex: 0, answeredIndex: 0, distractors: [] } }
      ]
    }, async (cloudTermIds) => cloudTermIds.map(() => uuidStudyset));

    let requestedIds: string[] = [];
    const history = (await window.idbApiLayer.activityHistory({
      last: 10,
      getCloudStudysets: async (ids) => {
        requestedIds = ids as string[];
        return ids.map(() => cloudStudyset);
      }
    })) as any[];

    return { history, requestedIds };
  });

  expect(result.history).toHaveLength(2);
  for (const entry of result.history) {
    expect(entry.studysets).toHaveLength(1);
    expect(entry.studysets[0].title).toBe("Cloud Set");
  }
  expect(result.requestedIds).toEqual(["cccccccc-1111-2222-3333-444444444444"]);
});

test('activityHistory: throws without getCloudStudysets when cloud studysets exist', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const uuidStudyset = "cccccccc-1111-2222-3333-444444444444";
    await window.db.matchActivities.add({
      durationMs: 3000,
      endTimestamp: "2024-01-01T10:00:00.000Z",
      studysetIds: [uuidStudyset]
    });

    let error: string | null = null;
    try {
      await window.idbApiLayer.activityHistory({ last: 10 });
    } catch (e: any) {
      error = e.message;
    }
    return { error };
  });

  expect(result.error).toContain("getCloudStudysets");
});

test('activityHistory: activity with multiple studysets (local + cloud)', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid1 = await window.idbApiLayer.createStudyset({ title: "Local One", draft: false });
    await window.idbApiLayer.createTerms(sid1, [
      { term: "T1", def: "D1", sortOrder: 0 }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid1);
    const t1 = { id: terms[0].id, term: terms[0].term, def: terms[0].def };

    const uuidTerm = "aaaaaaaa-1111-2222-3333-444444444444";
    const uuidStudyset = "cccccccc-1111-2222-3333-444444444444";

    await window.idbApiLayer.recordMatchActivity({
      termIds: [t1.id, uuidTerm],
      incorrectPairIds: [],
      durationMs: 4000
    }, async (cloudTermIds) => cloudTermIds.map(() => uuidStudyset));

    const history = (await window.idbApiLayer.activityHistory({
      last: 10,
      getCloudStudysets: async (ids) => ids.map(() => ({
        id: uuidStudyset,
        title: "Cloud Set",
        draft: false,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z"
      }))
    })) as any[];

    return { history };
  });

  expect(result.history).toHaveLength(1);
  expect(result.history[0].studysets.map((s: any) => s.title).sort()).toEqual(["Cloud Set", "Local One"]);
});
