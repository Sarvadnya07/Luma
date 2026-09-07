const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  page.on('console', msg => console.log(`[PAGE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err));

  // Step 1: Navigate to library or click Back button
  console.log("Navigating to Library...");
  const backBtn = page.locator("button[title*='Back'], button:has-text('Back'), button[aria-label*='back']").first();
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(1000);
  } else {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Verify Library screen
  await page.screenshot({ path: path.join(artifactsDir, "epub_01_library.png") });

  // Step 2: Open "The Architecture of Stillness" (EPUB)
  console.log("Opening EPUB 'The Architecture of Stillness'...");
  const epubCard = page.locator("text=The Architecture of Stillness").first();
  await epubCard.waitFor({ state: "visible", timeout: 8000 });
  await epubCard.click();

  // Wait for EPUB reader content
  await page.waitForSelector(".prose p, article p, [class*='prose'] p", { timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(artifactsDir, "epub_02_reader_opened.png") });

  // Step 3: Find target paragraph
  const targetP = page.locator(".prose p, article p, [class*='prose'] p").first();
  const pText = await targetP.innerText();
  console.log("First paragraph text:", pText);

  // Get bounding box of paragraph
  const pBox = await targetP.boundingBox();
  console.log("Paragraph box:", pBox);

  // Step 4: Perform real mouse drag across first few words
  const startX = pBox.x + 10;
  const startY = pBox.y + 12;
  const endX = pBox.x + Math.min(220, pBox.width - 20);
  const endY = startY;

  console.log(`Dragging mouse from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await page.waitForTimeout(600);

  // Step 5: Capture browser selection
  const selectionInfo = await page.evaluate(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    return {
      selectedText: sel.toString(),
      anchorNodeText: sel.anchorNode?.textContent?.substring(0, 50),
      focusNodeText: sel.focusNode?.textContent?.substring(0, 50),
      rangeRect: range.getBoundingClientRect()
    };
  });
  console.log("EPUB Selection Info:", JSON.stringify(selectionInfo, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_03_selection.json"), JSON.stringify(selectionInfo, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "epub_03_selection.png") });

  // Step 6: Click Highlight pill in TextSelectionToolbar
  const yellowPill = page.locator("button[title*='Highlight Yellow']").first();
  await yellowPill.waitFor({ state: "visible", timeout: 3000 });
  console.log("Clicking yellow highlight button in EPUB toolbar...");
  await yellowPill.click();

  await page.waitForTimeout(1000);

  // Step 7: Inspect <mark class="luma-highlight"> in DOM
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

  // Step 8: Verify SQLite Persistence via Tauri IPC
  const dbResult = await page.evaluate(async () => {
    const books = await window.__TAURI_INTERNALS__.invoke('list_books');
    const epubBook = books.find(b => b.title.includes('Stillness'));
    if (!epubBook) return { error: "EPUB book not found" };
    const annList = await window.__TAURI_INTERNALS__.invoke('list_annotations', { bookId: epubBook.id });
    return { bookId: epubBook.id, annotations: annList };
  });
  console.log("EPUB SQLite Annotations:", JSON.stringify(dbResult, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_05_db_annotations.json"), JSON.stringify(dbResult, null, 2));

  // Step 9: Test In-Doc Search
  console.log("Testing EPUB In-Document Search...");
  const searchInput = page.locator("input[placeholder*='Search']").first();
  if (await searchInput.isVisible().catch(() => false)) {
    const words = pText.trim().split(/\s+/);
    const searchWord = words.find(w => w.length > 4) || "stillness";
    console.log("Searching for:", searchWord);
    await searchInput.fill(searchWord);
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

  // Step 10: Re-open book and verify persistent reload
  console.log("Reloading book to verify persistence...");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Click EPUB book again from Library
  const epubCard2 = page.locator("text=The Architecture of Stillness").first();
  await epubCard2.waitFor({ state: "visible", timeout: 5000 });
  await epubCard2.click();
  await page.waitForSelector(".prose p, article p, [class*='prose'] p", { timeout: 10000 });
  await page.waitForTimeout(1500);

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
  console.log("EPUB Persistent Marks after Reopen:", JSON.stringify(reloadedMarks, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "epub_07_reloaded_marks.json"), JSON.stringify(reloadedMarks, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "epub_07_reopened_persistent.png") });

  console.log("EPUB GOLDEN PATH TEST COMPLETED SUCCESSFULLY!");
  await browser.close();
}

main().catch(err => {
  console.error("EPUB test failed:", err);
  process.exit(1);
});
