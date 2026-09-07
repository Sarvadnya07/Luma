const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts');

  // Find the PDF book card and click it
  const pdfCard = page.locator("text=Sample Doc").first();
  console.log('PDF card visible?', await pdfCard.isVisible());
  await pdfCard.click();

  // Wait for reader to open and PDF canvas/textLayer to render
  await page.waitForSelector('.textLayer span', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Check for overlays
  const overlays = await page.evaluate(() => {
    const hlElements = Array.from(document.querySelectorAll("[class*='rounded-xs'], div[style*='background-color']")).map(el => ({
      className: el.className,
      style: el.getAttribute('style'),
      box: el.getBoundingClientRect()
    }));
    return {
      hlElements,
      textSpans: Array.from(document.querySelectorAll('.textLayer span')).map(s => ({
        text: s.innerText,
        box: s.getBoundingClientRect()
      }))
    };
  });

  console.log('OPENED PDF OVERLAYS:', JSON.stringify(overlays.hlElements, null, 2));

  const screenshotPath = path.join(artifactsDir, '06_real_pdf_with_persisted_highlight.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot:', screenshotPath);

  fs.writeFileSync(
    path.join(artifactsDir, '06_real_pdf_overlays_persisted.json'),
    JSON.stringify(overlays, null, 2)
  );

  await browser.close();
}

main().catch(console.error);
