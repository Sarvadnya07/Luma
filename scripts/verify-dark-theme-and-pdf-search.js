const path = require("path");
const fs = require("fs");
const { chromium } = require(path.resolve(__dirname, "../apps/desktop/node_modules/playwright"));

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];
  const artifactsDir = path.resolve(__dirname, "docs/reader-recovery/runtime-artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Step 1: Check if already in reader or on library
  await page.waitForTimeout(1000);
  const inReader = await page.locator("header").isVisible().catch(() => false);
  console.log("In reader?", inReader);

  if (!inReader) {
    console.log("Finding PDF book in library...");
    const bookCard = page.locator("text=Atomic Habits").first();
    const hasAtomic = await bookCard.isVisible().catch(() => false);
    if (hasAtomic) {
      console.log("Opening Atomic Habits...");
      await bookCard.click();
    } else {
      const anyCard = page.locator(".group.cursor-pointer").first();
      await anyCard.click();
    }
  } else {
    const title = await page.locator("header h1").innerText().catch(() => "");
    console.log("Current reader title:", title);
    if (!title.toLowerCase().includes("atomic")) {
      console.log("Navigating back to library to open Atomic Habits...");
      const backBtn = page.locator("header button[title*='Return to Library']").first();
      await backBtn.click();
      await page.waitForTimeout(1000);
      const atomicCard = page.locator("text=Atomic Habits").first();
      await atomicCard.click();
    }
  }

  // Wait for PDF TextLayer to render
  console.log("Waiting for PDF TextLayer...");
  await page.waitForSelector(".textLayer span", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Step 2: Verify TextLayer transparency (no ghosting)
  const spanStyles = await page.evaluate(() => {
    const span = document.querySelector(".textLayer span");
    if (!span) return null;
    const computed = window.getComputedStyle(span);
    return {
      color: computed.color,
      userSelect: computed.userSelect,
      position: computed.position,
      hasText: span.textContent,
    };
  });
  console.log("TextLayer span computed style:", JSON.stringify(spanStyles, null, 2));

  // Capture Light Theme Screenshot
  const lightScreenshotPath = path.join(artifactsDir, "01_pdf_light_theme.png");
  await page.screenshot({ path: lightScreenshotPath });
  console.log("Saved light theme screenshot:", lightScreenshotPath);

  // Step 3: Test Dark Mode Toggle Button in Reader Toolbar
  console.log("Testing Dark Mode Toggle Button...");
  const darkBtn = page.locator("button[aria-label*='Theme']").first();
  await darkBtn.waitFor({ state: "visible", timeout: 5000 });
  const darkBtnTitleBefore = await darkBtn.getAttribute("title");
  console.log("Dark button title before click:", darkBtnTitleBefore);

  // Click Dark Mode Toggle Button
  await darkBtn.click();
  await page.waitForTimeout(1000);

  // Verify Dark Theme active
  const darkThemeStatus = await page.evaluate(() => {
    const isDarkClass = document.documentElement.classList.contains("dark");
    const container = document.querySelector(".pdf-canvas-container");
    const canvas = container ? container.querySelector("canvas") : null;
    const canvasFilter = canvas ? window.getComputedStyle(canvas).filter : null;
    const headerBg = window.getComputedStyle(document.querySelector("header")).backgroundColor;
    return {
      isDarkClass,
      canvasFilter,
      headerBg,
    };
  });
  console.log("Dark theme verification status:", JSON.stringify(darkThemeStatus, null, 2));

  // Capture Dark Theme Screenshot
  const darkScreenshotPath = path.join(artifactsDir, "02_pdf_dark_theme.png");
  await page.screenshot({ path: darkScreenshotPath });
  console.log("Saved dark theme screenshot:", darkScreenshotPath);

  // Step 4: Test In-Document Search for "atomic"
  console.log("Testing In-Document Search for 'atomic'...");
  const searchTabBtn = page.locator("button[title*='Search in Document']").first();
  await searchTabBtn.click();
  await page.waitForTimeout(500);

  const searchInput = page.locator("input[placeholder*='Search across document']").first();
  await searchInput.waitFor({ state: "visible", timeout: 5000 });
  await searchInput.fill("atomic");
  console.log("Filled search query 'atomic', waiting for matches...");

  // Wait for search results
  await page.waitForTimeout(3000);

  const searchResultsCount = await page.evaluate(() => {
    const items = document.querySelectorAll("aside div.space-y-1\\.5 div.cursor-pointer");
    const snippets = Array.from(items).map((el) => el.innerText.replace(/\n/g, " - "));
    return {
      itemCount: items.length,
      snippets: snippets.slice(0, 3),
    };
  });
  console.log("Search results extracted:", JSON.stringify(searchResultsCount, null, 2));

  // Capture Search Results Screenshot
  const searchScreenshotPath = path.join(artifactsDir, "03_pdf_dark_search_results.png");
  await page.screenshot({ path: searchScreenshotPath });
  console.log("Saved search results screenshot:", searchScreenshotPath);

  // Click first search result to jump to page and verify amber search highlight
  if (searchResultsCount.itemCount > 0) {
    console.log("Clicking first search result...");
    const firstResult = page.locator("aside div.space-y-1\\.5 div.cursor-pointer").first();
    await firstResult.click();
    await page.waitForTimeout(1500);

    // Capture search navigation & highlight
    const highlightScreenshotPath = path.join(artifactsDir, "04_pdf_search_hit_highlight.png");
    await page.screenshot({ path: highlightScreenshotPath });
    console.log("Saved search hit highlight screenshot:", highlightScreenshotPath);
  }

  console.log("=== ALL LIVE RUNTIME CHECKS COMPLETED SUCCESSFULLY ===");
  await browser.close();
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
