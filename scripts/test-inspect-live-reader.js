const { chromium } = require('../apps/desktop/node_modules/playwright');

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];

  page.on('console', msg => console.log(`[PAGE CONSOLE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]:', err));

  const info = await page.evaluate(async () => {
    const spans = Array.from(document.querySelectorAll('.textLayer span')).map(s => ({
      text: s.innerText,
      box: s.getBoundingClientRect(),
      style: s.getAttribute('style')
    }));

    const pageContainers = Array.from(document.querySelectorAll('[data-page-num]')).map(p => ({
      pageNum: p.getAttribute('data-page-num'),
      box: p.getBoundingClientRect(),
      spansCount: p.querySelectorAll('.textLayer span').length
    }));

    const books = await window.__TAURI_INTERNALS__.invoke('list_books');
    const annotations = {};
    for (const b of books) {
      try {
        annotations[b.id] = await window.__TAURI_INTERNALS__.invoke('list_annotations', { bookId: b.id });
      } catch (e) {
        annotations[b.id] = { error: String(e) };
      }
    }

    return {
      title: document.title,
      url: window.location.href,
      pageContainers,
      spansCount: spans.length,
      firstSpans: spans.slice(0, 5),
      books: books.map(b => ({ id: b.id, title: b.title })),
      annotations
    };
  });

  console.log('READER STATUS:', JSON.stringify(info, null, 2));
  await browser.close();
}

main().catch(console.error);
