const path = require("path");
const fs = require("fs");
const { chromium } = require(path.resolve(__dirname, "../apps/desktop/node_modules/playwright"));

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const p = b.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts");

  const input = p.locator("input[placeholder*='Search across document']").first();
  await input.fill("");
  await input.fill("Design");
  console.log("Filled search with 'Design', waiting for PDF.js search matches...");
  await p.waitForTimeout(2000);

  const results = await p.evaluate(() => {
    const items = Array.from(document.querySelectorAll("aside div.space-y-1\\.5 div.cursor-pointer"));
    const text = document.querySelector("aside") ? document.querySelector("aside").innerText : "";
    return {
      matchElements: items.length,
      itemTexts: items.map((i) => i.innerText.replace(/\n/g, " | ")),
      asideTextSnippet: text.slice(text.indexOf("Matches") !== -1 ? text.indexOf("Matches") : text.indexOf("NO RESULTS"), 300),
    };
  });
  console.log("Search verification results:", JSON.stringify(results, null, 2));

  // Save screenshot of search results in Dark theme
  const searchShot = path.join(artifactsDir, "03_pdf_dark_search_results.png");
  await p.screenshot({ path: searchShot });
  console.log("Saved search screenshot to:", searchShot);

  // Click on the match
  if (results.matchElements > 0) {
    console.log("Clicking first match...");
    await p.locator("aside div.space-y-1\\.5 div.cursor-pointer").first().click();
    await p.waitForTimeout(1000);

    const hitShot = path.join(artifactsDir, "04_pdf_search_hit_highlight.png");
    await p.screenshot({ path: hitShot });
    console.log("Saved search hit highlight screenshot to:", hitShot);
  }

  await b.close();
}

main().catch(console.error);
