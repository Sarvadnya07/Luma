import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Fitness function: the frontend must not carry its own application data.
 *
 * Every user-visible entity (books, documents, annotations, notes, statistics)
 * is owned by the local database and reached through a transport. These checks
 * fail the build if fabricated content, test fixtures or an implicit in-memory
 * data source are reintroduced into production modules.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..");

/** Files that are allowed to contain synthetic data. */
const isTestOrHarnessFile = (file: string) =>
  /(^|\/)(__tests__|testing)(\/|$)/.test(file) || /\.(test|spec)\.tsx?$/.test(file);

function productionFiles(dir = SRC, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      productionFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc.filter((file) => !isTestOrHarnessFile(relative(SRC, file).split("\\").join("/")));
}

const FILES = productionFiles().map((path) => ({
  path: relative(SRC, path).split("\\").join("/"),
  source: readFileSync(path, "utf8"),
}));

/** Patterns whose presence in production source means invented content. */
const FORBIDDEN_CONTENT: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\bimport\b[^;]*from\s+["'][^"']*(__tests__|testing\/)[^"']*["']/, why: "imports test fixtures or a test backend" },
  { pattern: /images\.unsplash\.com/, why: "references a remote stock image as book content" },
  { pattern: /data:image\/(png|jpe?g|gif|webp);base64,/, why: "embeds image bytes as content" },
  { pattern: /\b(mockBooks|sampleBooks|demoBooks|fakeBooks|mockData|dummyBooks|placeholderBooks)\b/, why: "names a fabricated library data set" },
  { pattern: /\buseMock\b|\bmockStore\b/, why: "reintroduces an implicit in-memory data source" },
  { pattern: /00000000-0000-0000-0000-000000000001/, why: "hardcodes a shared device identity" },
  { pattern: /\bbook_(great_gatsby|meditations|arch_stillness|design_everyday|foundation)\b/, why: "references removed sample records" },
  { pattern: /\bMeditations\b/, why: "hardcodes a removed sample book title" },
];

describe("production source contains no fabricated application data", () => {
  it("scans a non-trivial number of production files", () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  for (const { pattern, why } of FORBIDDEN_CONTENT) {
    it(`never ${why}`, () => {
      const offenders = FILES.filter(({ source }) => pattern.test(source)).map((f) => f.path);
      expect(offenders, `${why} in: ${offenders.join(", ")}`).toEqual([]);
    });
  }

  it("keeps every data command routed through a transport", () => {
    const client = FILES.find((f) => f.path === "lib/tauri.ts");
    expect(client).toBeDefined();
    expect(client!.source).toContain("class DataServicesUnavailableError");
    // No command may answer with a locally synthesised result.
    expect(client!.source).not.toMatch(/=>\s*\(\s*\{/);
  });
});
