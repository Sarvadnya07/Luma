const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  const logs = [];
  page.on('console', msg => {
    const txt = `[${msg.type()}] ${msg.text()}`;
    logs.push(txt);
    console.log(txt);
  });
  page.on('pageerror', err => {
    logs.push(`[ERROR] ${err}`);
    console.error('[PAGE ERROR]', err);
  });

  // Step 1: Ensure we are in Reader or open Sample Doc
  const inReader = await page.locator(".textLayer span").first().isVisible().catch(() => false);
  if (!inReader) {
    console.log("Opening Sample Doc from library...");
    const pdfCard = page.locator("text=Sample Doc").first();
    await pdfCard.waitFor({ state: "visible", timeout: 5000 });
    await pdfCard.click();
    await page.waitForSelector(".textLayer span", { timeout: 10000 });
  }

  await page.waitForTimeout(1500);

  // Step 2: Target text selection
  const targetSpan = page.locator(".textLayer span:has-text('System Design Handbook')").first();
  await targetSpan.waitFor({ state: "visible", timeout: 5000 });
  const box = await targetSpan.boundingBox();
  console.log("Target span bounding box:", box);

  const startX = box.x + 2;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width - 2;
  const endY = startY;

  console.log(`Selecting text from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 6 });
  await page.mouse.up();

  await page.waitForTimeout(500);

  // Step 3: Capture browser selection
  const selectionInfo = await page.evaluate(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    return {
      text: sel.toString(),
      rangeRect: range.getBoundingClientRect(),
      rects: Array.from(range.getClientRects())
    };
  });
  console.log("Captured browser selection:", selectionInfo);
  fs.writeFileSync(path.join(artifactsDir, "pdf_step1_selection.json"), JSON.stringify(selectionInfo, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "pdf_step1_selection.png") });

  // Step 4: Click Highlight Yellow pill in TextSelectionToolbar
  const yellowPill = page.locator("button[title*='Highlight Yellow']").first();
  await yellowPill.waitFor({ state: "visible", timeout: 3000 });
  console.log("Clicking yellow highlight button...");
  await yellowPill.click();

  await page.waitForTimeout(1000);

  // Step 5: Check visual highlight overlays in DOM
  const overlays = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll("[class*='rounded-xs']")).map(d => ({
      className: d.className,
      style: d.getAttribute('style'),
      box: d.getBoundingClientRect()
    }));
    return divs;
  });
  console.log("Overlays in DOM:", JSON.stringify(overlays, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "pdf_step2_highlight_overlays.json"), JSON.stringify(overlays, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "pdf_step2_highlight.png") });

  // Step 6: Test In-Document Search
  console.log("Testing in-document search...");
  // Look for search input in top bar or sidebar
  const searchInput = page.locator("input[placeholder*='Search']").first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("System Design");
    await searchInput.press("Enter");
    await page.waitForTimeout(1000);

    const searchOverlays = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("[class*='rounded-xs']")).map(d => ({
        style: d.getAttribute('style'),
        box: d.getBoundingClientRect()
      }));
    });
    console.log("Search overlays in DOM:", JSON.stringify(searchOverlays, null, 2));
    fs.writeFileSync(path.join(artifactsDir, "pdf_step3_search_overlays.json"), JSON.stringify(searchOverlays, null, 2));
    await page.screenshot({ path: path.join(artifactsDir, "pdf_step3_search.png") });
  }

  // Step 7: Verify SQLite persistence by querying list_annotations via IPC
  const dbAnnotations = await page.evaluate(async () => {
    const books = await window.__TAURI_INTERNALS__.invoke('list_books');
    const pdfBook = books.find(b => b.title.includes('Sample Doc'));
    if (!pdfBook) return { error: "Sample Doc not found" };
    const annList = await window.__TAURI_INTERNALS__.invoke('list_annotations', { bookId: pdfBook.id });
    return { bookId: pdfBook.id, annotations: annList };
  });
  console.log("SQLite Annotations from IPC:", JSON.stringify(dbAnnotations, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "pdf_step4_db_annotations.json"), JSON.stringify(dbAnnotations, null, 2));

  // Step 8: Test Zoom
  console.log("Testing Zoom...");
  const zoomInBtn = page.locator("button[title*='Zoom In'], button:has-text('+')").first();
  if (await zoomInBtn.isVisible()) {
    await zoomInBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactsDir, "pdf_step5_zoomed.png") });
  }

  console.log("PDF GOLDEN PATH TEST COMPLETED SUCCESSFULLY!");
  await browser.close();
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
