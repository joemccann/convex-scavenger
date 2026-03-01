let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("buffer");
} catch {}

const BrowserBuffer = {
  from(input, encoding) {
    if (typeof input === "string") {
      const encoder = new TextEncoder();
      return encoder.encode(input);
    }
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (Array.isArray(input)) return new Uint8Array(input);
    return new Uint8Array();
  },
  alloc(size) {
    return new Uint8Array(size);
  },
  isBuffer(obj) {
    return obj instanceof Uint8Array;
  },
  concat(list, totalLength) {
    if (!totalLength) totalLength = list.reduce((acc, buf) => acc + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of list) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  },
};

export const Buffer = _mod?.Buffer ?? globalThis.Buffer ?? BrowserBuffer;

export default _mod ?? { Buffer };
