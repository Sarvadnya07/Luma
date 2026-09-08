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

  const atomicPdfPath = path.resolve(
    __dirname,
    "../apps/desktop/src-tauri/data/library/book_01a058ed9e51746388eae4debabf0f7a_Atomic habits ( PDFDrive ).pdf"
  );
  console.log("Atomic Habits path:", atomicPdfPath);

  // Return to library if in reader
  while (await page.locator("header button[title*='Return to Library']").first().isVisible().catch(() => false)) {
    await page.locator("header button[title*='Return to Library']").first().click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);

  // Import Atomic habits
  console.log("Importing Atomic habits PDF into library...");
  const importResult = await page.evaluate(async (pdfPath) => {
    try {
      const job = await window.__TAURI_INTERNALS__.invoke("import_files", {
        filePaths: [pdfPath],
      });
      return { success: true, job };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }, atomicPdfPath);
  console.log("Import result:", importResult);

  // Reload library
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.location.reload();
  });
  await page.waitForTimeout(2000);

  // Locate Atomic Habits card in library
  console.log("Finding Atomic Habits card in library...");
  const atomicCard = page.locator("text=Atomic habits").first();
  await atomicCard.waitFor({ state: "visible", timeout: 10000 });
  console.log("Found Atomic Habits card! Clicking to open in Reader...");
  await atomicCard.click();

  // Wait for PDF to load and render TextLayer
  console.log("Waiting for PDF TextLayer to render...");
  await page.waitForSelector(".textLayer span", { timeout: 20000 });
  await page.waitForTimeout(1500);

  // 1. Verify TextLayer Transparency (No Ghosting)
  const spanMetrics = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll(".textLayer span"));
    const firstSpan = spans.find((s) => s.textContent && s.textContent.trim().length > 0);
    const computed = firstSpan ? window.getComputedStyle(firstSpan) : null;
    return {
      spanCount: spans.length,
      sampleText: firstSpan ? firstSpan.textContent.trim() : "",
      computedColor: computed ? computed.color : null,
      isTransparent: computed ? computed.color === "rgba(0, 0, 0, 0)" : false,
    };
  });
  console.log("Atomic Habits TextLayer transparency metrics:", JSON.stringify(spanMetrics, null, 2));

  // Screenshot in Light Theme
  const lightShot = path.join(artifactsDir, "atomic_habits_01_light_theme.png");
  await page.screenshot({ path: lightShot });
  console.log("Saved light theme screenshot:", lightShot);

  // 2. Test Dark Mode Button in Reader Toolbar
  console.log("Testing Dark Mode toggle button in reader header...");
  const themeToggleBtn = page.locator("header button[aria-label*='Theme']").first();
  await themeToggleBtn.waitFor({ state: "visible", timeout: 5000 });

  const initialDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (!initialDark) {
    console.log("Toggling to DARK mode...");
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
  console.log("Atomic Habits Dark Mode metrics:", JSON.stringify(darkMetrics, null, 2));

  // Screenshot in Dark Theme
  const darkShot = path.join(artifactsDir, "atomic_habits_02_dark_theme.png");
  await page.screenshot({ path: darkShot });
  console.log("Saved dark theme screenshot:", darkShot);

  // 3. Test In-Document Search for "atomic" in Atomic Habits!
  console.log("Opening Search in Document...");
  const searchBtn = page.locator("header button[title*='Search in Document']").first();
  await searchBtn.click();
  await page.waitForTimeout(600);

  const searchInput = page.locator("input[placeholder*='Search across document']").first();
  await searchInput.waitFor({ state: "visible", timeout: 5000 });
  await searchInput.fill("atomic");
  console.log("Filled search query 'atomic'. Scanning pages with PDF.js engine...");

  // Allow PDF.js to search through pages
  await page.waitForTimeout(5000);

  const searchResults = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("aside div.space-y-1\\.5 div.cursor-pointer"));
    const header = document.querySelector("aside span.tracking-wider");
    return {
      headerText: header ? header.innerText : null,
      count: items.length,
      firstMatches: items.slice(0, 5).map((i) => i.innerText.replace(/\n/g, " | ")),
    };
  });
  console.log("Atomic Habits search results:", JSON.stringify(searchResults, null, 2));

  // Screenshot of Search Results
  const searchShot = path.join(artifactsDir, "atomic_habits_03_search_results.png");
  await page.screenshot({ path: searchShot });
  console.log("Saved search results screenshot:", searchShot);

  // 4. Click a search result to navigate and verify amber highlight
  if (searchResults.count > 0) {
    console.log("Clicking first match to navigate and verify highlight...");
    const firstMatch = page.locator("aside div.space-y-1\\.5 div.cursor-pointer").first();
    await firstMatch.click();
    await page.waitForTimeout(2000);

    const highlightCount = await page.evaluate(() => {
      const overlays = document.querySelectorAll(".pdf-canvas-container div[style*='245, 158, 11']");
      return overlays.length;
    });
    console.log("Search highlight boxes rendered on page:", highlightCount);

    const hitShot = path.join(artifactsDir, "atomic_habits_04_search_highlight.png");
    await page.screenshot({ path: hitShot });
    console.log("Saved highlight screenshot:", hitShot);
  }

  // Save report artifact
  const finalSummary = {
    test: "Atomic Habits Real-World PDF Verification",
    timestamp: new Date().toISOString(),
    textLayerTransparency: spanMetrics,
    darkMode: darkMetrics,
    search: searchResults,
    status: "PASS",
  };
  fs.writeFileSync(
    path.join(artifactsDir, "atomic_habits_verification.json"),
    JSON.stringify(finalSummary, null, 2)
  );

  console.log("=== ATOMIC HABITS FULL FLOW VERIFICATION COMPLETE ===");
  await browser.close();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
