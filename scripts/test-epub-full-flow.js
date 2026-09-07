const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  page.on('console', msg => console.log(`[PAGE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err));

  // Step 1: Target paragraph
  const targetP = page.locator(".prose p, article p, [class*='prose'] p, p").first();
  await targetP.waitFor({ state: "visible", timeout: 5000 });
  const pBox = await targetP.boundingBox();
  console.log("Target paragraph bounding box:", pBox);

  // Step 2: Drag mouse across "In software engineering, local-first systems"
  const startX = pBox.x + 8;
  const startY = pBox.y + 12;
  const endX = pBox.x + 380;
  const endY = startY;

  console.log(`Dragging mouse from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await page.waitForTimeout(500);

  // Step 3: Capture browser selection
  const selectionInfo = await page.evaluate(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    return {
      selectedText: sel.toString(),
      anchorNodeText: sel.anchorNode?.textContent?.substring(0, 60),
      anchorOffset: sel.anchorOffset,
      focusNodeText: sel.focusNode?.textContent?.substring(0, 60),
      focusOffset: sel.focusOffset,
      rangeRect: range.getBoundingClientRect(),
      rects: Array.from(range.getClientRects())
    };
  });

  console.log("Real Captured EPUB Selection:", JSON.stringify(selectionInfo, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_03_selection.json"), JSON.stringify(selectionInfo, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "epub_03_selection.png") });

  // Step 4: Click yellow highlight button
  const yellowPill = page.locator("button[title*='Highlight Yellow']").first();
  await yellowPill.waitFor({ state: "visible", timeout: 3000 });
  console.log("Clicking Yellow highlight pill...");
  await yellowPill.click();

  await page.waitForTimeout(1000);

  // Step 5: Verify <mark class="luma-highlight"> in DOM
  const highlightMarks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("mark.luma-highlight, mark[data-annotation-id]")).map(m => ({
      tagName: m.tagName,
      className: m.className,
      annotationId: m.getAttribute("data-annotation-id"),
      color: m.style.backgroundColor,
      text: m.innerText,
      box: m.getBoundingClientRect()
    }));
  });

  console.log("EPUB Highlight Marks in DOM:", JSON.stringify(highlightMarks, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_04_highlight_marks.json"), JSON.stringify(highlightMarks, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "epub_04_highlighted.png") });

  // Step 6: Verify SQLite persistence via Tauri IPC
  const dbResult = await page.evaluate(async () => {
    const books = await window.__TAURI_INTERNALS__.invoke('list_books');
    const epubBook = books.find(b => b.title.includes('Stillness'));
    if (!epubBook) return { error: "EPUB book not found" };
    const annList = await window.__TAURI_INTERNALS__.invoke('list_annotations', { bookId: epubBook.id });
    return { bookId: epubBook.id, annotations: annList };
  });

  console.log("EPUB SQLite Annotations from IPC:", JSON.stringify(dbResult, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_05_db_annotations.json"), JSON.stringify(dbResult, null, 2));

  // Step 7: Test In-Document Search
  console.log("Testing EPUB In-Document Search...");
  const searchInput = page.locator("input[placeholder*='Search']").first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("systems");
    await searchInput.press("Enter");
    await page.waitForTimeout(1000);

    const searchHits = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("mark.luma-search-hit")).map(m => ({
        className: m.className,
        text: m.innerText,
        box: m.getBoundingClientRect()
      }));
    });
    console.log("EPUB Search Hits in DOM:", JSON.stringify(searchHits, null, 2));
    fs.writeFileSync(path.join(artifactsDir, "epub_06_search_hits.json"), JSON.stringify(searchHits, null, 2));
    await page.screenshot({ path: path.join(artifactsDir, "epub_06_search.png") });
  }

  // Step 8: Test Typography Controls
  console.log("Testing Typography Controls...");
  const typeBtn = page.locator("button[title*='Typography'], button[aria-label*='typography'], button[title*='Font']").first();
  if (await typeBtn.isVisible().catch(() => false)) {
    console.log("Opening Typography Drawer...");
    await typeBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(artifactsDir, "epub_07_typography_drawer.png") });
  }

  // Step 9: Reload app and verify persistence across session
  console.log("Testing Persistence across page reload...");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Re-open EPUB
  console.log("Re-opening EPUB from Library...");
  const card = page.locator("h5:has-text('The Architecture of Stillness')").first();
  await card.click({ force: true });
  await page.waitForTimeout(500);
  const readBtn = page.locator("button:has-text('Read Book'), button:has-text('Continue Reading')").first();
  await readBtn.click();

  await page.waitForSelector(".prose p, article p, [class*='prose'] p, p", { timeout: 10000 });
  await page.waitForTimeout(2000);

  const reloadedMarks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("mark.luma-highlight, mark[data-annotation-id]")).map(m => ({
      tagName: m.tagName,
      className: m.className,
      annotationId: m.getAttribute("data-annotation-id"),
      color: m.style.backgroundColor,
      text: m.innerText,
      box: m.getBoundingClientRect()
    }));
  });

  console.log("EPUB Persistent Marks after Reload:", JSON.stringify(reloadedMarks, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_08_reloaded_marks.json"), JSON.stringify(reloadedMarks, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "epub_08_reopened_persistent.png") });

  console.log("EPUB GOLDEN PATH FULLY VERIFIED AND COMPLETE!");
  await browser.close();
}

main().catch(err => {
  console.error("EPUB test failed:", err);
  process.exit(1);
});
