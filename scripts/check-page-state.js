const { chromium } = require('../apps/desktop/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];

  const info = await page.evaluate(() => {
    return {
      title: document.title,
      drawerOpen: !!document.querySelector("aside[style*='width: 380px'], aside"),
      readBtn: !!document.querySelector("button:has-text('Read Book'), button:has-text('Continue Reading')"),
      allButtons: Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean)
    };
  });
  console.log("PAGE STATE:", JSON.stringify(info, null, 2));

  await page.screenshot({ path: path.resolve(__dirname, '../docs/reader-recovery/runtime-artifacts/current_view.png') });
  await browser.close();
})().catch(console.error);
