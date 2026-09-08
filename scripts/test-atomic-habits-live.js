const path = require("path");
const fs = require("fs");
const { chromium } = require(path.resolve(__dirname, "../apps/desktop/node_modules/playwright"));

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const p = b.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts");

  // Return to library
  console.log("Returning to library...");
  while (await p.locator("header button[title*='Return to Library']").first().isVisible().catch(() => false)) {
    await p.locator("header button[title*='Return to Library']").first().click();
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(1000);

  // Look for Atomic Habits in library
  const cards = await p.$$eval("div.group.cursor-pointer", (els) =>
    els.map((e) => ({
      text: e.innerText.replace(/\n/g, " - "),
    }))
  );
  console.log("Available books in library:", cards);

  const atomicCard = p.locator("text=Atomic").first();
  const hasAtomic = await atomicCard.isVisible().catch(() => false);
  console.log("Atomic card visible?", hasAtomic);

  if (hasAtomic) {
    console.log("Clicking Atomic Habits card...");
    await atomicCard.click();
    await p.waitForTimeout(2000);
    await p.waitForSelector(".textLayer span", { timeout: 15000 });
    console.log("Atomic Habits opened and TextLayer ready!");

    // Open Search
    const searchBtn = p.locator("header button[title*='Search in Document']").first();
    await searchBtn.click();
    await p.waitForTimeout(600);

    const input = p.locator("input[placeholder*='Search across document']").first();
    await input.fill("atomic");
    console.log("Filled search query 'atomic' in Atomic Habits. Waiting for PDF search matches across pages...");
    await p.waitForTimeout(4000);

    const matches = await p.evaluate(() => {
      const items = Array.from(document.querySelectorAll("aside div.space-y-1\\.5 div.cursor-pointer"));
      return {
        count: items.length,
        firstFew: items.slice(0, 5).map((i) => i.innerText.replace(/\n/g, " | ")),
      };
    });
    console.log("Atomic Habits search matches:", JSON.stringify(matches, null, 2));

    const atomicSearchShot = path.join(artifactsDir, "05_atomic_habits_search_results.png");
    await p.screenshot({ path: atomicSearchShot });
    console.log("Saved Atomic Habits search screenshot to:", atomicSearchShot);

    if (matches.count > 0) {
      console.log("Clicking first match in Atomic Habits...");
      await p.locator("aside div.space-y-1\\.5 div.cursor-pointer").first().click();
      await p.waitForTimeout(1500);

      const atomicHitShot = path.join(artifactsDir, "06_atomic_habits_search_highlight.png");
      await p.screenshot({ path: atomicHitShot });
      console.log("Saved Atomic Habits highlight screenshot to:", atomicHitShot);
    }
  }

  await b.close();
}

main().catch(console.error);
