const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  // If "Read Book" or "Continue Reading" button is already visible in drawer, click it!
  const readBtn = page.locator("button:has-text('Read Book'), button:has-text('Continue Reading')").first();
  if (await readBtn.isVisible().catch(() => false)) {
    console.log("Read Book button is visible in drawer! Clicking it...");
    await readBtn.click();
  } else {
    // Check if card is visible, click it with force: true
    console.log("Clicking book card...");
    const card = page.locator("h5:has-text('The Architecture of Stillness')").first();
    await card.click({ force: true });
    await page.waitForTimeout(500);
    console.log("Clicking Read Book button...");
    await page.locator("button:has-text('Read Book'), button:has-text('Continue Reading')").first().click();
  }

  // Wait for EPUB reader to mount
  console.log("Waiting for EPUB reader content...");
  await page.waitForSelector(".prose p, article p, [class*='prose'] p, p", { timeout: 10000 });
  await page.waitForTimeout(2000);

  const shotPath = path.join(artifactsDir, "epub_02_reader_opened.png");
  await page.screenshot({ path: shotPath });
  console.log("Saved EPUB reader screenshot:", shotPath);

  // Check paragraphs
  const pList = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".prose p, article p, [class*='prose'] p, p")).map(p => ({
      text: p.innerText.trim(),
      box: p.getBoundingClientRect()
    })).filter(p => p.text.length > 10);
  });
  console.log("Found EPUB paragraphs:", JSON.stringify(pList.slice(0, 5), null, 2));

  await browser.close();
}

main().catch(console.error);
