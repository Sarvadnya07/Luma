/**
 * Custom pdf.js worker entry.
 *
 * pdfjs-dist v6 uses the ES2025 TypedArray methods `toHex`/`toBase64` inside
 * its worker. WebView2 / Chromium runtimes older than 140 do not implement
 * them, and pdf.js fails with "hashOriginal.toHex is not a function" before a
 * single page renders. A worker has its own realm, so the polyfill has to run
 * INSIDE the worker before pdf.js's own code — this entry does exactly that,
 * then hands off to the stock pdf.worker.
 */
import "./pdfTypedArrayPolyfill";
import "pdfjs-dist/build/pdf.worker.mjs";
