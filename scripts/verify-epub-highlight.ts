import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { chromium, Browser, Page } from "playwright";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port: number, timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await sleep(500);
  }
  return false;
}

async function runVerification() {
  console.log("=== LUMA EPUB HIGHLIGHT REAL DESKTOP VERIFICATION ===");
  const projectRoot = path.resolve(__dirname, "..");
  const exePath = path.join(projectRoot, "target", "debug", "luma-desktop.exe");
  const artifactsDir = path.join(projectRoot, "docs", "reader-recovery", "runtime-artifacts");

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log("1. Starting Tauri desktop application with WebView2 remote debugging on port 9222...");
  const desktopProc: ChildProcess = spawn(exePath, [], {
    cwd: projectRoot,
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
    },
    stdio: "inherit",
  });

  desktopProc.on("error", (err) => {
    console.error("Failed to start desktop app:", err);
  });

  try {
    const portReady = await waitForPort(9222, 35000);
    if (!portReady) {
      throw new Error("Timeout waiting for WebView2 CDP port 9222 to become ready.");
    }
    console.log("2. WebView2 CDP endpoint is ready on port 9222!");

    console.log("3. Connecting Playwright to actual WebView2 runtime...");
    const browser: Browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    if (contexts.length === 0) throw new Error("No browser contexts found in WebView2");

    const pages = contexts[0].pages();
    let page: Page = pages[0];
    if (!page) {
      page = await contexts[0].waitForEvent("page");
    }

    console.log("4. Page connected! Current URL:", page.url());
    await page.waitForLoadState("domcontentloaded");
    await sleep(2000);

    console.log("5. Waiting for library or reader view...");
    // Check if we are already in reader or library
    const inReader = await page.$(".chapter-content, [data-annotation-id], #reader-root");
    if (!inReader) {
      console.log("Opening 'The Architecture of Stillness' EPUB...");
      // Click on book card in library
      const bookCard = await page.waitForSelector("text=The Architecture of Stillness, h3:has-text('The Architecture of Stillness'), [title*='Architecture of Stillness']", { timeout: 10000 });
      await bookCard.click();
      await sleep(2000);
    }

    console.log("6. Waiting for EPUB reader content...");
    await page.waitForSelector(".chapter-content p, .prose-reader p", { timeout: 15000 });
    await sleep(1500);

    // Locate the first paragraph to select text
    const paragraphHandle = await page.$(".chapter-content p, .prose-reader p");
    if (!paragraphHandle) throw new Error("Could not find paragraph element in reader content");

    console.log("7. Calculating paragraph geometry for REAL mouse drag selection...");
    const pBox = await paragraphHandle.boundingBox();
    if (!pBox) throw new Error("Paragraph has no bounding box");

    console.log("Paragraph bounding box:", pBox);

    // Perform an ACTUAL pointer mouse selection across multiple words / lines
    // We select from x: pBox.x + 30, y: pBox.y + 12 to x: pBox.x + 320, y: pBox.y + 12 (or multi-line y: pBox.y + 35)
    const startX = pBox.x + 25;
    const startY = pBox.y + 10;
    const endX = pBox.x + 350;
    const endY = pBox.y + (pBox.height > 40 ? 35 : 10);

    console.log(`8. Performing REAL mouse drag: (${startX}, ${startY}) -> (${endX}, ${endY})...`);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 15 });
    await page.mouse.up();
    await sleep(1000);

    console.log("9. Verifying real browser Selection and Range...");
    const selectionData = await page.evaluate(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      const rects = Array.from(range.getClientRects()).map((r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
      }));

      return {
        selectedText: sel.toString(),
        anchorNode: sel.anchorNode?.nodeName || null,
        focusNode: sel.focusNode?.nodeName || null,
        anchorOffset: sel.anchorOffset,
        focusOffset: sel.focusOffset,
        startContainer: range.startContainer.nodeName,
        startOffset: range.startOffset,
        endContainer: range.endContainer.nodeName,
        endOffset: range.endOffset,
        rangeRects: rects,
      };
    });

    console.log("Selection data captured from real browser:", JSON.stringify(selectionData, null, 2));
    if (!selectionData || !selectionData.selectedText) {
      throw new Error("Selection failed: no text was selected by mouse drag");
    }

    console.log("10. Triggering highlight through the ACTUAL floating toolbar UI...");
    // Find floating toolbar color button
    const highlightButton = await page.waitForSelector("button[title*='Highlight'], button[title*='Yellow'], [data-testid='highlight-button']", { timeout: 8000 });
    await highlightButton.click();
    await sleep(1500);

    console.log("11. Verifying rendered highlight marks...");
    const highlightMarksData = await page.evaluate(() => {
      const marks = Array.from(document.querySelectorAll<HTMLElement>("mark.luma-highlight"));
      return marks.map((m) => {
        const rects = Array.from(m.getClientRects()).map((r) => ({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
        }));
        return {
          id: m.getAttribute("data-annotation-id"),
          text: m.textContent,
          color: m.style.backgroundColor,
          border: m.style.border,
          padding: m.style.padding,
          margin: m.style.margin,
          rects,
        };
      });
    });

    console.log("Rendered highlight marks:", JSON.stringify(highlightMarksData, null, 2));
    if (highlightMarksData.length === 0) {
      throw new Error("Highlight failed: no mark.luma-highlight found in DOM after UI click");
    }

    const screenshotPath = path.join(artifactsDir, "epub-highlight-fixed.png");
    const jsonPath = path.join(artifactsDir, "epub-highlight-fixed.json");

    console.log("12. Capturing visual acceptance screenshot:", screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log("13. Capturing visual acceptance JSON:", jsonPath);
    const jsonResult = {
      timestamp: new Date().toISOString(),
      bookId: "book_arch_stillness",
      chapterId: "ch_1",
      selectedText: selectionData.selectedText,
      startContainer: selectionData.startContainer,
      startOffset: selectionData.startOffset,
      endContainer: selectionData.endContainer,
      endOffset: selectionData.endOffset,
      rangeRects: selectionData.rangeRects,
      highlightRects: highlightMarksData.flatMap((m) => m.rects),
      marks: highlightMarksData,
      screenshot: "epub-highlight-fixed.png",
    };

    fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2), "utf8");
    console.log("=== VERIFICATION COMPLETE: ALL ACCEPTANCE CRITERIA MET! ===");

    await browser.close();
  } finally {
    console.log("Shutting down desktop process...");
    desktopProc.kill();
  }
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
