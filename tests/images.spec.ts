import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.db.delete();
    await window.db.open();
  });
});

test('processAndUpdateTermImage, getImageObjectUrl, removeTermImage', async ({ page }) => {
  const result = await page.evaluate(async () => {
    // Generate a 1x1 red pixel image as a Blob
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx!.fillStyle = 'red';
    ctx!.fillRect(0, 0, 1, 1);
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'));

    const sid = await window.idbApiLayer.createStudyset({ title: "Image Test", draft: false });
    await window.idbApiLayer.createTerms(sid, [
      { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "", studysetId: sid }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const termId = terms[0].id;

    // Add image to term
    await window.idbLayerImg.processAndUpdateTermImage(termId, false, blob);
    let term = await window.idbApiLayer.getTermById(termId, { termImageUrl: true });
    const termImageUrl = term?.termImageUrl;

    // Verify it's in the DB
    const imageCountInDb = await window.db.images.count();

    // Add image to definition
    await window.idbLayerImg.processAndUpdateTermImage(termId, true, blob);
    term = await window.idbApiLayer.getTermById(termId, { defImageUrl: true });
    const defImageUrl = term?.defImageUrl;
    const imageCountInDbAfterBoth = await window.db.images.count();

    // Remove term image
    await window.idbLayerImg.removeTermImage(termId, false);
    term = await window.idbApiLayer.getTermById(termId, { termImageUrl: true });
    const termImageUrlAfterRemove = term?.termImageUrl;
    const imageCountInDbAfterRemoveOne = await window.db.images.count();

    return {
        termImageUrl,
        defImageUrl,
        imageCountInDb,
        imageCountInDbAfterBoth,
        termImageUrlAfterRemove,
        imageCountInDbAfterRemoveOne
    };
  });

  expect(result.termImageUrl).not.toBeNull();
  expect(result.defImageUrl).not.toBeNull();
  expect(result.imageCountInDb).toBe(1);
  expect(result.imageCountInDbAfterBoth).toBe(2);
  expect(result.termImageUrlAfterRemove).toBeNull();
  expect(result.imageCountInDbAfterRemoveOne).toBe(1);
});

test('processImage directly', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx!.fillStyle = 'blue';
    ctx!.fillRect(0, 0, 100, 100);
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'));

    const processedBlob = await window.idbLayerImg.processImage(blob, 50, 50, 0.5);

    // Check dimensions by loading processed blob back into an image
    return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.src = URL.createObjectURL(processedBlob);
    });
  });

  expect(result.width).toBeLessThanOrEqual(50);
  expect(result.height).toBeLessThanOrEqual(50);
});

test('deleteImages and effect of deleteTerms on images', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await new Promise<Blob>(res => canvas.toBlob(res!, 'image/png'));

    const sid = await window.idbApiLayer.createStudyset({ title: "S", draft: false });
    await window.idbApiLayer.createTerms(sid, [
        { term: "t1", def: "d1", sortOrder: 0, createdAt: "", updatedAt: "", studysetId: sid }
    ]);
    const terms = await window.idbApiLayer.getTermsByStudysetId(sid);
    const tid = terms[0].id;
    await window.idbLayerImg.processAndUpdateTermImage(tid, false, blob);
    await window.idbLayerImg.processAndUpdateTermImage(tid, true, blob);

    const countBefore = await window.db.images.count();
    await window.idbApiLayer.deleteTerms([tid]);
    const countAfter = await window.db.images.count();

    return { countBefore, countAfter };
  });

  expect(result.countBefore).toBe(2);
  expect(result.countAfter).toBe(0);
});
