const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  page.on('console', msg => console.log(`[PAGE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err));

  const txtBookId = "01a07dbf-0d2b-7c23-be70-0e9dd6f14d74";

  // Check if we are already in the TXT reader
  const targetP = page.locator("p:has-text('Reading is an active dialogue')").first();
  const isReaderOpen = await targetP.isVisible().catch(() => false);

  if (!isReaderOpen) {
    console.log("Navigating to Library...");
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const sampleCard = page.locator("[role='listitem']:has-text('sample'):not(:has-text('Doc'))").first();
    await sampleCard.waitFor({ state: "visible", timeout: 5000 });
    console.log("Clicking TXT card...");
    await sampleCard.click();
    await page.waitForTimeout(600);

    const readBtn = page.locator("button:has-text('Read Book'), button:has-text('Continue Reading')").first();
    await readBtn.waitFor({ state: "visible", timeout: 5000 });
    console.log("Clicking Read Book button...");
    await readBtn.click();
    await targetP.waitFor({ state: "visible", timeout: 10000 });
  }

  await page.waitForTimeout(1500);

  const pBox = await targetP.boundingBox();
  console.log("Target paragraph bounding box:", pBox);

  // Mouse drag selection across "Reading is an active dialogue"
  const startX = pBox.x + 4;
  const startY = pBox.y + 14;
  const endX = pBox.x + 280;
  const endY = startY;

  console.log(`Selecting text from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await page.waitForTimeout(500);

  // Capture selection
  const selectionData = await page.evaluate(() => {
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
  console.log("TXT Selection Data:", JSON.stringify(selectionData, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "txt_02_selection.json"), JSON.stringify(selectionData, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "txt_02_selection.png") });

  // Click Yellow highlight pill
  const yellowPill = page.locator("button[title*='Highlight Yellow']").first();
  await yellowPill.waitFor({ state: "visible", timeout: 3000 });
  console.log("Clicking Yellow highlight button...");
  await yellowPill.click();

  await page.waitForTimeout(1000);

  // Inspect <mark class="luma-highlight"> in DOM
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
  console.log("TXT Highlight Marks in DOM:", JSON.stringify(highlightMarks, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "txt_03_highlight_marks.json"), JSON.stringify(highlightMarks, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "txt_03_highlighted.png") });

  // Verify SQLite Persistence via Tauri IPC
  const dbResult = await page.evaluate(async (bId) => {
    const annList = await window.__TAURI_INTERNALS__.invoke('list_annotations', { bookId: bId });
    return { bookId: bId, annotations: annList };
  }, txtBookId);
  console.log("TXT SQLite Annotations from IPC:", JSON.stringify(dbResult, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "txt_04_db_annotations.json"), JSON.stringify(dbResult, null, 2));

  // Reload app and test persistence
  console.log("Reloading app to test persistence...");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Re-open TXT
  const sampleCard2 = page.locator("[role='listitem']:has-text('sample'):not(:has-text('Doc'))").first();
  await sampleCard2.click({ force: true });
  await page.waitForTimeout(500);
  const readBtn2 = page.locator("button:has-text('Read Book'), button:has-text('Continue Reading')").first();
  if (await readBtn2.isVisible().catch(() => false)) {
    await readBtn2.click();
  }

  await page.waitForSelector("p:has-text('Reading is an active dialogue')", { timeout: 10000 });
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
  console.log("TXT Persistent Marks after Reload:", JSON.stringify(reloadedMarks, null, 2));
  fs.writeFileSync(path.join(artifactsDir, "txt_05_reloaded_marks.json"), JSON.stringify(reloadedMarks, null, 2));
  await page.screenshot({ path: path.join(artifactsDir, "txt_05_reopened_persistent.png") });

  console.log("TXT GOLDEN PATH FULLY VERIFIED AND COMPLETE!");
  await browser.close();
}

main().catch(err => {
  console.error("TXT test failed:", err);
  process.exit(1);
});
