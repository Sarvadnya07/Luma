const { chromium } = require("../apps/desktop/node_modules/playwright");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];

  const artifactsDir = path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts");

  // Inspect books via Tauri IPC
  const books = await page.evaluate(async () => {
    return await window.__TAURI_INTERNALS__.invoke("list_books", {
      filter: null,
      sort: null,
      page: 0,
      pageSize: 100,
    });
  });

  console.log("Books in database:", books.map((b) => ({ id: b.id, title: b.title, format: b.format })));

  const epub = books.find((b) => b.title.includes("Stillness") || b.title.includes("Architecture"));
  if (!epub) {
    throw new Error("EPUB book not found in library");
  }

  console.log("Opening EPUB in reader:", epub.title, epub.id);

  // Invoke openReaderDocument directly via Tauri IPC to verify backend response
  const docResult = await page.evaluate(async (bookId) => {
    try {
      const doc = await window.__TAURI_INTERNALS__.invoke("open_reader_document", {
        bookId,
        fileId: null,
      });
      return { success: true, doc };
    } catch (e) {
      return { success: false, error: e.toString() };
    }
  }, epub.id);

  console.log("open_reader_document result:", JSON.stringify(docResult, null, 2));

  // Now trigger openBook in the React state
  const openStateResult = await page.evaluate(async (epubBook) => {
    try {
      // Access Zustand reader store from window if available or trigger via React
      // In Luma, we can check window.__READER_STORE__ or dispatch a custom event
      const store = window.__READER_STORE__;
      if (store) {
        await store.getState().openBook(epubBook);
        return { success: true, method: "store" };
      }
      return { success: false, reason: "no __READER_STORE__ on window" };
    } catch (e) {
      return { success: false, error: e.toString() };
    }
  }, epub);

  console.log("openStateResult:", openStateResult);

  // Let's also check if clicking the Hero card in the UI opens the book
  if (books[0]) {
    console.log("Clicking Hero Continue Reading card in UI...");
    const heroCard = page.locator(".group:has-text('Continue where you left off'), .group:has-text('Available')").first();
    if (await heroCard.isVisible()) {
      await heroCard.click();
      console.log("Clicked hero card!");
    }
  }

  await page.waitForTimeout(2000);

  const currentScreenShot = path.join(artifactsDir, "04_after_click_hero.png");
  await page.screenshot({ path: currentScreenShot });
  console.log("Saved screenshot:", currentScreenShot);

  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
