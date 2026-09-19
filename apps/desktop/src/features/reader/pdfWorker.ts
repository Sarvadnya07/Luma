import "./pdfTypedArrayPolyfill";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "./pdfWorkerEntry.ts?url";
import "./pdfWorkerEntry.ts";

// Set worker source for pdfjs-dist: our entry polyfills the ES2025 TypedArray
// methods pdf.js v6 expects, then loads the stock worker — so older WebView2 /
// Chromium runtimes render PDFs instead of failing with
// "hashOriginal.toHex is not a function".
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };
