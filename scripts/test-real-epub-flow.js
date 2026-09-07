const { chromium } = require("../apps/desktop/node_modules/playwright");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];

  const artifactsDir = path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts");

  // 1. Click on "The Architecture of Stillness" to open the EPUB
  console.log("Clicking on 'The Architecture of Stillness' book card...");
  const epubCard = page.locator("text='The Architecture of Stillness'").first();
  await epubCard.click();

  // Wait for the reader view to load
  await page.waitForSelector(".prose-reader, .reader-text-container", { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Take screenshot of opened EPUB
  const openScreenshot = path.join(artifactsDir, "03_real_epub_opened.png");
  await page.screenshot({ path: openScreenshot });
  console.log("Saved EPUB opened screenshot:", openScreenshot);

  // 2. Locate first visible paragraph in the reader
  const paragraph = page.locator(".prose-reader p, .reader-text-container p").first();
  const paraText = await paragraph.innerText();
  console.log("First paragraph text:", paraText);

  // 3. Real mouse drag selection across the text
  const box = await paragraph.boundingBox();
  console.log("Paragraph bounding box:", box);

  if (!box) {
    throw new Error("Could not get bounding box for paragraph");
  }

  // Move mouse to start of paragraph, press down, drag right 250px, release
  const startX = box.x + 20;
  const startY = box.y + 12;
  const endX = box.x + 280;
  const endY = box.y + 12;

  console.log(`Dragging mouse from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();

  // Wait for selection to register and selection toolbar to appear
  await page.waitForTimeout(600);

  // 4. Capture window.getSelection() from the actual browser DOM
  const selectionData = await page.evaluate(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
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
      anchorNodeText: sel.anchorNode?.textContent?.slice(0, 50),
      anchorNodeType: sel.anchorNode?.nodeType,
      anchorOffset: sel.anchorOffset,
      focusNodeText: sel.focusNode?.textContent?.slice(0, 50),
      focusNodeType: sel.focusNode?.nodeType,
      focusOffset: sel.focusOffset,
      isCollapsed: sel.isCollapsed,
      rangeCount: sel.rangeCount,
      boundingClientRect: {
        x: range.getBoundingClientRect().x,
        y: range.getBoundingClientRect().y,
        width: range.getBoundingClientRect().width,
        height: range.getBoundingClientRect().height,
      },
      clientRects: rects,
    };
  });

  console.log("Real Captured Browser Selection:", JSON.stringify(selectionData, null, 2));

  // Save selection artifact
  fs.writeFileSync(
    path.join(artifactsDir, "04_real_epub_selection.json"),
    JSON.stringify(selectionData, null, 2)
  );

  // Take screenshot of active selection and toolbar
  const selectionScreenshot = path.join(artifactsDir, "04_real_epub_selection.png");
  await page.screenshot({ path: selectionScreenshot });
  console.log("Saved selection screenshot:", selectionScreenshot);

  // TEST B — Click Highlight button on the toolbar
  console.log("Looking for Highlight button in selection toolbar...");
  const highlightBtn = page.locator("button[title*='Highlight'], button:has-text('Highlight'), button[class*='bg-amber-400'], button[class*='bg-yellow']").first();
  const hlVisible = await highlightBtn.isVisible();
  console.log("Highlight button visible?", hlVisible);

  if (hlVisible) {
    await highlightBtn.click();
    console.log("Clicked Highlight button!");
    await page.waitForTimeout(1000);

    // Take screenshot after highlighting
    const highlightScreenshot = path.join(artifactsDir, "05_real_epub_highlighted.png");
    await page.screenshot({ path: highlightScreenshot });
    console.log("Saved highlight screenshot:", highlightScreenshot);

    // Inspect if <mark> elements were injected into the actual DOM
    const marks = await page.$$eval("mark", (marks) =>
      marks.map((m) => ({
        tag: m.tagName,
        className: m.className,
        text: m.innerText,
        styleBg: m.style.backgroundColor,
        annotationId: m.getAttribute("data-annotation-id"),
      }))
    );
    console.log("Rendered <mark> tags in DOM:", JSON.stringify(marks, null, 2));

    fs.writeFileSync(
      path.join(artifactsDir, "05_real_epub_marks.json"),
      JSON.stringify(marks, null, 2)
    );
  } else {
    console.log("Selection toolbar buttons:", await page.$$eval("button", btns => btns.map(b => ({ text: b.innerText, title: b.getAttribute("title"), class: b.className }))));
  }

  await browser.close();
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
