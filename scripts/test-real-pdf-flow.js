const { chromium } = require("../apps/desktop/node_modules/playwright");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = browser.contexts()[0].pages()[0];

  const artifactsDir = path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts");

  // Inspect the textLayer spans on the currently open PDF
  const textSpans = await page.$$eval(".textLayer span", (spans) =>
    spans.map((s) => ({
      text: s.innerText,
      left: s.offsetLeft,
      top: s.offsetTop,
      width: s.offsetWidth,
      height: s.offsetHeight,
      transform: s.style.transform,
      style: s.getAttribute("style"),
    }))
  );

  console.log("TextLayer spans found:", JSON.stringify(textSpans, null, 2));

  // Find the span containing "System Design Handbook"
  const targetSpan = page.locator(".textLayer span:has-text('System Design Handbook')").first();
  const isTargetVisible = await targetSpan.isVisible();
  console.log("Target span visible?", isTargetVisible);

  if (!isTargetVisible) {
    throw new Error("Target text 'System Design Handbook' not visible in TextLayer");
  }

  const box = await targetSpan.boundingBox();
  console.log("Target span bounding box:", box);

  if (!box) {
    throw new Error("Could not get bounding box for target span");
  }

  // Real mouse drag selection across "System Design Handbook"
  const startX = box.x + 2;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width - 2;
  const endY = startY;

  console.log(`Dragging mouse from (${startX}, ${startY}) to (${endX}, ${endY})...`);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.mouse.up();

  await page.waitForTimeout(600);

  // Capture window.getSelection() from the real browser
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
      anchorNodeText: sel.anchorNode?.textContent,
      anchorOffset: sel.anchorOffset,
      focusNodeText: sel.focusNode?.textContent,
      focusOffset: sel.focusOffset,
      boundingClientRect: {
        x: range.getBoundingClientRect().x,
        y: range.getBoundingClientRect().y,
        width: range.getBoundingClientRect().width,
        height: range.getBoundingClientRect().height,
      },
      clientRects: rects,
    };
  });

  console.log("Real Captured PDF Browser Selection:", JSON.stringify(selectionData, null, 2));

  fs.writeFileSync(
    path.join(artifactsDir, "05_real_pdf_selection.json"),
    JSON.stringify(selectionData, null, 2)
  );

  const selScreenshot = path.join(artifactsDir, "05_real_pdf_selection.png");
  await page.screenshot({ path: selScreenshot });
  console.log("Saved PDF selection screenshot:", selScreenshot);

  // Click the highlight button on the selection toolbar
  const hlButton = page.locator("button[class*='bg-[#fef08a]'], button[title*='Highlight'], button[class*='bg-amber']").first();
  if (await hlButton.isVisible()) {
    console.log("Clicking highlight button in toolbar...");
    await hlButton.click();
    await page.waitForTimeout(1000);

    const hlScreenshot = path.join(artifactsDir, "06_real_pdf_highlighted.png");
    await page.screenshot({ path: hlScreenshot });
    console.log("Saved PDF highlight screenshot:", hlScreenshot);

    // Inspect highlight overlay in the DOM
    const overlays = await page.$$eval(".pointer-events-none div[style*='background']", (divs) =>
      divs.map((d) => ({
        style: d.getAttribute("style"),
        className: d.className,
      }))
    );
    console.log("Overlays in DOM:", JSON.stringify(overlays, null, 2));

    fs.writeFileSync(
      path.join(artifactsDir, "06_real_pdf_overlays.json"),
      JSON.stringify(overlays, null, 2)
    );
  } else {
    console.log("Toolbar buttons found:", await page.$$eval("button", btns => btns.map(b => ({ text: b.innerText, class: b.className }))));
  }

  await browser.close();
}

main().catch((err) => {
  console.error("PDF test error:", err);
  process.exit(1);
});
