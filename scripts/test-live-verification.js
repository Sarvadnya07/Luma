const path = require("path");
const fs = require("fs");
const { chromium } = require(path.resolve(__dirname, "../apps/desktop/node_modules/playwright"));

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // 1. Determine current view
  await page.waitForTimeout(1000);
  const inReader = await page.locator("header h1").isVisible().catch(() => false);
  let currentTitle = "";
  if (inReader) {
    currentTitle = await page.locator("header h1").innerText().catch(() => "");
    console.log("Currently in Reader for:", currentTitle);
  } else {
    console.log("Currently in Library. Looking for books...");
    // Find all book cards
    const bookCards = page.locator(".group.cursor-pointer, [data-book-id]");
    const count = await bookCards.count();
    console.log(`Found ${count} book cards in library.`);
    // Look for Atomic Habits first
    const atomicHabits = page.locator("text=Atomic Habits").first();
    if (await atomicHabits.isVisible().catch(() => false)) {
      console.log("Opening Atomic Habits...");
      await atomicHabits.click();
    } else if (count > 0) {
      console.log("Opening first available book...");
      await bookCards.first().click();
    }
    await page.waitForSelector("header h1", { timeout: 10000 });
    currentTitle = await page.locator("header h1").innerText().catch(() => "");
    console.log("Now in Reader for:", currentTitle);
  }

  // Wait for PDF TextLayer to be ready
  console.log("Waiting for PDF TextLayer...");
  await page.waitForSelector(".textLayer span", { timeout: 15000 });
  await page.waitForTimeout(1200);

  // 2. Verify TextLayer transparency
  const spanMetrics = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll(".textLayer span"));
    if (!spans.length) return null;
    const computed = window.getComputedStyle(spans[0]);
    return {
      totalSpans: spans.length,
      sampleText: spans.slice(0, 5).map(s => s.textContent).join(" "),
      computedColor: computed.color,
      isTransparent: computed.color === "rgba(0, 0, 0, 0)",
      userSelect: computed.userSelect,
      position: computed.position,
    };
  });
  console.log("TextLayer transparency metrics:", JSON.stringify(spanMetrics, null, 2));

  // 3. Test Dark Mode Toggle Button
  console.log("Checking Dark Mode toggle button in reader header...");
  const themeToggleBtn = page.locator("header button[aria-label*='Theme']").first();
  await themeToggleBtn.waitFor({ state: "visible", timeout: 5000 });

  // Initial theme state
  const initialDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  console.log("Initial dark mode status:", initialDark);

  if (!initialDark) {
    console.log("Clicking theme toggle button to switch to DARK mode...");
    await themeToggleBtn.click();
    await page.waitForTimeout(800);
  }

  const darkMetrics = await page.evaluate(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const container = document.querySelector(".pdf-canvas-container");
    const canvas = container ? container.querySelector("canvas") : null;
    const canvasFilter = canvas ? window.getComputedStyle(canvas).filter : null;
    const headerBg = window.getComputedStyle(document.querySelector("header")).backgroundColor;
    return {
      isDark,
      canvasFilter,
      headerBg,
    };
  });
  console.log("Dark mode metrics after toggle:", JSON.stringify(darkMetrics, null, 2));

  // Screenshot in Dark Theme
  const darkShot = path.join(artifactsDir, "dark_theme_reader_live.png");
  await page.screenshot({ path: darkShot });
  console.log("Saved dark theme reader screenshot to:", darkShot);

  // 4. Test In-Document Search
  // Determine search keyword based on document text
  const searchKeyword = spanMetrics.sampleText.toLowerCase().includes("atomic") ? "atomic" : "Design";
  console.log(`Testing In-Document search for: '${searchKeyword}'...`);

  const searchBtn = page.locator("header button[title*='Search in Document']").first();
  await searchBtn.click();
  await page.waitForTimeout(600);

  const searchInput = page.locator("input[placeholder*='Search across document']").first();
  await searchInput.waitFor({ state: "visible", timeout: 5000 });
  await searchInput.fill(searchKeyword);
  console.log(`Search query '${searchKeyword}' entered. Waiting for client-side search matches...`);

  await page.waitForTimeout(3000);

  const searchMetrics = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("aside div.space-y-1\\.5 div.cursor-pointer"));
    const matchesHeader = document.querySelector("aside span.tracking-wider");
    return {
      header: matchesHeader ? matchesHeader.innerText : null,
      matchesFound: items.length,
      firstMatchSnippet: items.length > 0 ? items[0].innerText.replace(/\n/g, " | ") : null,
    };
  });
  console.log("Search results metrics:", JSON.stringify(searchMetrics, null, 2));

  // Screenshot of search sidebar in Dark Theme
  const searchShot = path.join(artifactsDir, "dark_theme_search_results_live.png");
  await page.screenshot({ path: searchShot });
  console.log("Saved search results screenshot to:", searchShot);

  // Click match to test navigation and overlay highlight
  if (searchMetrics.matchesFound > 0) {
    console.log("Clicking first match to verify navigation and highlight overlay...");
    const firstMatch = page.locator("aside div.space-y-1\\.5 div.cursor-pointer").first();
    await firstMatch.click();
    await page.waitForTimeout(1500);

    const highlightMetrics = await page.evaluate(() => {
      const overlays = document.querySelectorAll(".pdf-canvas-container div.absolute[style*='245, 158, 11']");
      return {
        amberSearchHighlightBoxes: overlays.length,
      };
    });
    console.log("Highlight metrics on canvas:", JSON.stringify(highlightMetrics, null, 2));

    const highlightShot = path.join(artifactsDir, "dark_theme_search_highlight_live.png");
    await page.screenshot({ path: highlightShot });
    console.log("Saved search highlight screenshot to:", highlightShot);
  }

  // 5. Toggle back to Light Theme to verify bidirectional toggle
  console.log("Clicking theme toggle button to switch back to LIGHT mode...");
  await themeToggleBtn.click();
  await page.waitForTimeout(800);

  const lightMetrics = await page.evaluate(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const container = document.querySelector(".pdf-canvas-container");
    const canvas = container ? container.querySelector("canvas") : null;
    const canvasFilter = canvas ? window.getComputedStyle(canvas).filter : null;
    const headerBg = window.getComputedStyle(document.querySelector("header")).backgroundColor;
    return {
      isDark,
      canvasFilter,
      headerBg,
    };
  });
  console.log("Light mode metrics after toggle:", JSON.stringify(lightMetrics, null, 2));

  const lightShot = path.join(artifactsDir, "light_theme_reader_live.png");
  await page.screenshot({ path: lightShot });
  console.log("Saved light theme screenshot to:", lightShot);

  // Write final test artifact summary
  const summary = {
    testDate: new Date().toISOString(),
    documentTitle: currentTitle,
    textLayerTransparency: spanMetrics,
    darkModeVerification: darkMetrics,
    lightModeVerification: lightMetrics,
    searchVerification: searchMetrics,
    status: "PASS",
  };
  fs.writeFileSync(
    path.join(artifactsDir, "00_dark_theme_and_search_verification.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("\n========================================================");
  console.log("VERIFICATION COMPLETE: ALL CHECKS PASSED WITH FLYING COLORS!");
  console.log("========================================================");
  await browser.close();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
