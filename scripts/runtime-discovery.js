const { chromium } = require("../apps/desktop/node_modules/playwright");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Connecting to live Tauri app via CDP on port 9222...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  console.log("Connected to page:", page.url(), "Title:", await page.title());

  const consoleLogs = [];
  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    consoleLogs.push({ type: "error", text: err.toString() });
    console.error(`[BROWSER PAGE ERROR] ${err}`);
  });

  // Capture screenshot of initial view
  const screenshotPath = path.resolve(
    __dirname,
    "../docs/reader-recovery/runtime-artifacts/01_live_app_initial.png"
  );
  await page.screenshot({ path: screenshotPath });
  console.log("Saved initial screenshot to:", screenshotPath);

  // Inspect DOM elements
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("Body text snippet (first 300 chars):", bodyText.slice(0, 300));

  const buttons = await page.$$eval("button", (btns) =>
    btns.map((b) => ({ text: b.innerText.trim(), title: b.getAttribute("title") }))
  );
  console.log("Buttons found on page:", JSON.stringify(buttons, null, 2));

  // Save inspection artifact
  const inspectionArtifact = {
    url: page.url(),
    title: await page.title(),
    consoleLogs,
    buttonsCount: buttons.length,
    buttons,
  };

  fs.writeFileSync(
    path.resolve(__dirname, "../docs/reader-recovery/runtime-artifacts/01_initial_state.json"),
    JSON.stringify(inspectionArtifact, null, 2)
  );

  await browser.close();
  console.log("Discovery complete!");
}

main().catch((err) => {
  console.error("Runtime discovery error:", err);
  process.exit(1);
});
