const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  page.on('console', msg => console.log(`[PAGE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]:', err));

  // Find target span
  const targetSpan = page.locator(".textLayer span:has-text('System Design Handbook')").first();
  console.log("Target span visible?", await targetSpan.isVisible());

  const box = await targetSpan.boundingBox();
  console.log("Span box:", box);

  // Drag selection
  const startX = box.x + 2;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width - 2;
  const endY = startY;

  console.log(`Dragging from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.mouse.up();

  await page.waitForTimeout(500);

  // Check if TextSelectionToolbar is visible
  const toolbarPill = page.locator("button[title*='Highlight Yellow']").first();
  const isToolbarVisible = await toolbarPill.isVisible();
  console.log("Toolbar yellow pill visible?", isToolbarVisible);

  if (!isToolbarVisible) {
    // Print all buttons in DOM
    const allBtns = await page.$$eval("button", btns => btns.map(b => ({ title: b.getAttribute("title"), text: b.innerText, style: b.getAttribute("style") })));
    console.log("All visible buttons:", JSON.stringify(allBtns, null, 2));
    throw new Error("Highlight toolbar pill not visible");
  }

  // Click the yellow highlight pill
  console.log("Clicking Yellow highlight pill...");
  await toolbarPill.click();

  // Wait for state update
  await page.waitForTimeout(1000);

  // Query visual highlight overlays in DOM
  const overlays = await page.evaluate(() => {
    const hlDivs = Array.from(document.querySelectorAll("[class*='rounded-xs'], div[style*='background-color']"))
      .filter(el => el.style.backgroundColor && el.style.backgroundColor.includes("254, 240, 138"))
      .map(el => ({
        className: el.className,
        style: el.getAttribute('style'),
        box: el.getBoundingClientRect()
      }));
    return hlDivs;
  });

  console.log("Overlays found after UI click:", JSON.stringify(overlays, null, 2));

  const shotPath = path.join(artifactsDir, "07_real_pdf_after_ui_highlight_click.png");
  await page.screenshot({ path: shotPath });
  console.log("Saved screenshot:", shotPath);

  fs.writeFileSync(
    path.join(artifactsDir, "07_real_pdf_ui_overlays.json"),
    JSON.stringify(overlays, null, 2)
  );

  await browser.close();
}

main().catch(console.error);
