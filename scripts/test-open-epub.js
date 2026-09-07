const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  page.on('console', msg => console.log(`[PAGE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err));

  console.log("Clicking EPUB book 'The Architecture of Stillness'...");
  const epubCard = page.locator("h5:has-text('The Architecture of Stillness')").first();
  await epubCard.waitFor({ state: "visible", timeout: 5000 });
  await epubCard.click();

  // Wait for EPUB reader content
  await page.waitForSelector(".prose p, article p, [class*='prose'] p, p", { timeout: 10000 });
  await page.waitForTimeout(2000);

  const shotPath = path.join(artifactsDir, "epub_02_reader_opened.png");
  await page.screenshot({ path: shotPath });
  console.log("Saved screenshot:", shotPath);

  // Check what paragraphs and text are loaded
  const paragraphs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("p")).map(p => ({
      text: p.innerText,
      box: p.getBoundingClientRect()
    })).filter(p => p.text.trim().length > 0);
  });
  console.log("Found paragraphs:", JSON.stringify(paragraphs.slice(0, 5), null, 2));

  await browser.close();
}

main().catch(console.error);
