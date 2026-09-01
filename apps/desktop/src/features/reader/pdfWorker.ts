import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

// Set worker source for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };
