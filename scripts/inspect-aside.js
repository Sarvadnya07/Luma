const path = require("path");
const { chromium } = require(path.resolve(__dirname, "../apps/desktop/node_modules/playwright"));

async function main() {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const p = b.contexts()[0].pages()[0];
  console.log("Current header buttons:");
  const headerBtns = await p.$$eval("header button", (btns) =>
    btns.map((b) => ({ title: b.getAttribute("title"), text: b.innerText }))
  );
  console.log(headerBtns);

  const searchBtn = p.locator("header button[title*='Search']").first();
  console.log("Search button visible?", await searchBtn.isVisible());
  await searchBtn.click();
  await p.waitForTimeout(1000);

  const asides = await p.$$eval("aside", (els) =>
    els.map((el) => ({ class: el.className, text: el.innerText.slice(0, 200) }))
  );
  console.log("Asides:", asides);

  const inputs = await p.$$eval("input", (els) =>
    els.map((el) => ({ placeholder: el.placeholder, value: el.value }))
  );
  console.log("Inputs:", inputs);
  await b.close();
}

main().catch(console.error);
