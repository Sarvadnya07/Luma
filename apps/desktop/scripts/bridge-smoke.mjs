import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn("target-bridge-validation/debug/browser_reader_bridge.exe", [], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
let errorOutput = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); process.stdout.write(chunk); });
child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); process.stderr.write(chunk); });

const waitFor = async (pattern, timeoutMs = 30000) => {
  const started = Date.now();
  while (!pattern.test(output) && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!pattern.test(output)) throw new Error(`bridge startup timeout; stderr=${errorOutput}`);
};

try {
  await waitFor(/LUMA_BROWSER_BRIDGE_URL=(\S+)/);
  const url = output.match(/LUMA_BROWSER_BRIDGE_URL=(\S+)/)[1];
  const bookId = output.match(/LUMA_BROWSER_BOOK_ID=(\S+)/)[1];
  const call = async (command, args = {}) => {
    const response = await fetch(`${url}/api/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, args }),
    });
    const body = await response.json();
    if (!response.ok || body.error) throw new Error(`${command}: ${JSON.stringify(body)}`);
    return body.result;
  };
  const health = await fetch(`${url}/health`);
  console.log(`HEALTH ${health.status} ${await health.text()}`);
  const books = await call("list_books");
  console.log(`BOOKS ${JSON.stringify(books)}`);
  const document = await call("open_reader_document", { bookId });
  console.log(`DOCUMENT ${JSON.stringify(document)}`);
  const chapter = await call("get_reader_chapter", { bookId, spineIndex: 0 });
  console.log(`CHAPTER ${JSON.stringify(chapter)}`);
  if (!chapter.html_content || !chapter.text_content) throw new Error("chapter content missing");
} finally {
  child.kill();
}
