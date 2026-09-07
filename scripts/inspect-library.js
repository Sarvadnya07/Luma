const { chromium } = require('../apps/desktop/node_modules/playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];

  const bookElements = await page.evaluate(() => {
    return {
      title: document.title,
      allHeadings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
        text: h.innerText,
        box: h.getBoundingClientRect(),
        visible: h.offsetParent !== null,
        className: h.className,
        parentTag: h.parentElement?.tagName,
        parentClass: h.parentElement?.className
      })),
      allDivsWithTitle: Array.from(document.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent.includes('Stillness')).map(el => ({
        tag: el.tagName,
        text: el.textContent,
        box: el.getBoundingClientRect(),
        visible: el.offsetParent !== null,
        className: el.className
      }))
    };
  });
  console.log('LIBRARY ELEMENTS:', JSON.stringify(bookElements, null, 2));
  await browser.close();
})().catch(console.error);
