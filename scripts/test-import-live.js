const { chromium } = require("../apps/desktop/node_modules/playwright");
const path = require("path");

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];

  const epubPath = path.resolve(__dirname, "../tests/fixtures/sample_book.epub");
  const pdfPath = path.resolve(__dirname, "../tests/fixtures/sample_doc.pdf");

  console.log("Importing EPUB:", epubPath);
  console.log("Importing PDF:", pdfPath);

  const importResult = await page.evaluate(async (paths) => {
    try {
      const job = await window.__TAURI_INTERNALS__.invoke("import_files", {
        filePaths: paths,
      });
      return { success: true, job };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }, [epubPath, pdfPath]);

  console.log("Import result:", JSON.stringify(importResult, null, 2));

  // Wait 1 second for database and event triggers
  await page.waitForTimeout(1000);

  // Reload/refresh books in the UI
  await page.evaluate(async () => {
    window.dispatchEvent(new CustomEvent("luma-book-imported"));
    window.location.reload();
  });

  await page.waitForTimeout(1500);

  // Take screenshot of Library with imported books
  const screenshotPath = path.resolve(
    __dirname,
    "../docs/reader-recovery/runtime-artifacts/02_library_with_books.png"
  );
  await page.screenshot({ path: screenshotPath });
  console.log("Saved library screenshot to:", screenshotPath);

  // Check what books are now in the DOM
  const booksInDom = await page.$$eval("[data-book-id], .group, h4, h3", (els) =>
    els.map((e) => ({
      tag: e.tagName,
      text: e.innerText.trim(),
      className: e.className,
      bookId: e.getAttribute("data-book-id"),
    }))
  );

  console.log("Books found in DOM:", JSON.stringify(booksInDom.slice(0, 10), null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
