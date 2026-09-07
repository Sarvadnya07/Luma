const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  console.log("1. Clicking card for The Architecture of Stillness...");
  const card = page.locator("h5:has-text('The Architecture of Stillness')").first();
  await card.click();
  await page.waitForTimeout(600);

  console.log("2. Clicking 'Read Book' button in details drawer...");
  const readBtn = page.locator("button:has-text('Read Book'), button:has-text('Continue Reading')").first();
  await readBtn.waitFor({ state: "visible", timeout: 5000 });
  await readBtn.click();

  console.log("3. Waiting for EPUB reader content...");
  await page.waitForSelector(".prose, article, [class*='prose']", { timeout: 10000 });
  await page.waitForTimeout(2000);

  const shotPath = path.join(artifactsDir, "epub_02_reader_opened.png");
  await page.screenshot({ path: shotPath });
  console.log("Saved screenshot:", shotPath);

  const textSample = await page.evaluate(() => {
    const el = document.querySelector(".prose, article, [class*='prose']");
    return {
      title: document.title,
      text: el ? el.innerText.substring(0, 300) : "not found",
      paragraphs: Array.from(document.querySelectorAll(".prose p, article p, [class*='prose'] p")).map(p => p.innerText.trim()).filter(Boolean)
    };
  });
  console.log("EPUB Content Sample:", JSON.stringify(textSample, null, 2));

  await browser.close();
}

main().catch(console.error);
