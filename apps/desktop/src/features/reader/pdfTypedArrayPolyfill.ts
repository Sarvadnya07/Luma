/**
 * ES2025 TypedArray hex/base64 methods + Map upsert methods, used by
 * pdfjs-dist v6 in both the main thread and its worker. WebView2 / Chromium
 * runtimes older than 140 do not provide them, and pdf.js fails with
 * "hashOriginal.toHex is not a function" (worker) or "getOrInsertComputed is
 * not a function" (main thread) before a single page renders. This module must
 * be imported by BOTH the main-thread pdf bootstrap and the worker entry so
 * both realms are patched before pdf.js executes.
 */

interface TypedArrayHexBase64 {
  toHex(): string;
  toBase64(): string;
}

// Attach to every TypedArray prototype, matching the ES2025 %TypedArray% methods.
const prototypes: (new () => ArrayBufferView)[] = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  // BigInt64Array/BigFloat variants omitted: pdf.js only calls these on byte views.
];

for (const ctor of prototypes) {
  const proto = ctor.prototype as unknown as Record<string, unknown>;
  if (typeof proto.toHex !== "function") {
    proto.toHex = function (this: Uint8Array): string {
      let out = "";
      for (let i = 0; i < this.length; i++) {
        out += (this[i] as number).toString(16).padStart(2, "0");
      }
      return out;
    };
  }
  if (typeof proto.toBase64 !== "function") {
    const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    proto.toBase64 = function (this: Uint8Array): string {
      let out = "";
      const len = this.length;
      for (let i = 0; i < len; i += 3) {
        const b0 = this[i] as number;
        const hasB1 = i + 1 < len;
        const hasB2 = i + 2 < len;
        const b1 = hasB1 ? (this[i + 1] as number) : 0;
        const b2 = hasB2 ? (this[i + 2] as number) : 0;
        out += B64[b0 >> 2];
        out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
        out += hasB1 ? B64[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
        out += hasB2 ? B64[b2 & 0x3f] : "=";
      }
      return out;
    };
  }
}

// --- Map upsert proposal (ES2025 `getOrInsert` / `getOrInsertComputed`) ----
// pdf.js v6's WorkerTransport uses map.getOrInsertComputed(key, fn) on the
// main thread. Polyfill both upsert methods on Map.prototype when missing.

type MapUpsert<K, V> = {
  getOrInsert(key: K, value: V): V;
  getOrInsertComputed(key: K, callbackfn: (key: K) => V): V;
};

const mapProto = Map.prototype as unknown as MapUpsert<unknown, unknown> & Record<string, unknown>;

if (typeof mapProto.getOrInsert !== "function") {
  mapProto.getOrInsert = function (key, value) {
    if (!this.has(key)) {
      this.set(key, value);
    }
    return this.get(key);
  };
}

if (typeof mapProto.getOrInsertComputed !== "function") {
  mapProto.getOrInsertComputed = function (key, callbackfn) {
    if (!this.has(key)) {
      this.set(key, callbackfn(key));
    }
    return this.get(key);
  };
}

export type { TypedArrayHexBase64 };
