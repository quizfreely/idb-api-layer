import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('create, update, and delete terms', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S1", draft: false });

    // Create terms
    await window.idbApiLayer.createTerms(sid, [
      { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "", studysetId: sid },
      { term: "t2", def: "d2", sortOrder: 1, createdAt: "", updatedAt: "", studysetId: sid }
    ]);

    let terms = await window.idbApiLayer.getTermsByStudysetId(sid);

    // Update terms
    const updatedTerms = terms.map(t => ({ ...t, term: t.term + " updated" }));
    await window.idbApiLayer.updateTerms(updatedTerms);

    let termsAfterUpdate = await window.idbApiLayer.getTermsByStudysetId(sid);

    // Delete one term
    await window.idbApiLayer.deleteTerms([terms[0].id]);
    let termsAfterDelete = await window.idbApiLayer.getTermsByStudysetId(sid);

    let singleTerm = await window.idbApiLayer.getTermById(terms[1].id);

    return { terms, termsAfterUpdate, termsAfterDelete, singleTerm };
  });

  expect(result.terms).toHaveLength(2);
  expect(result.termsAfterUpdate[0].term).toBe("t1 updated");
  expect(result.termsAfterDelete).toHaveLength(1);
  expect(result.termsAfterDelete[0].term).toBe("t2 updated");
  expect(result.singleTerm?.term).toBe("t2 updated");
});

test('verify sortOrder in getTermsByStudysetId', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sid = await window.idbApiLayer.createStudyset({ title: "S2", draft: false });

    await window.idbApiLayer.createTerms(sid, [
      { term: "last", def: "d", sortOrder: 10, createdAt: "", updatedAt: "", studysetId: sid },
      { term: "first", def: "d", sortOrder: 0, createdAt: "", updatedAt: "", studysetId: sid },
      { term: "middle", def: "d", sortOrder: 5, createdAt: "", updatedAt: "", studysetId: sid }
    ]);

    let terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    return { terms };
  });

  expect(result.terms[0].term).toBe("first");
  expect(result.terms[1].term).toBe("middle");
  expect(result.terms[2].term).toBe("last");
});
