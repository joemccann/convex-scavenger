let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("crypto");
} catch {}

export const randomUUID = _mod?.randomUUID ?? (() => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
});

export const createHash = _mod?.createHash ?? ((algorithm) => {
  let data = "";
  const hash = {
    update(input) {
      data += typeof input === "string" ? input : String(input);
      return hash;
    },
    digest(encoding) {
      // Fallback: simple non-cryptographic hash for browser environments
      let h = 0;
      for (let i = 0; i < data.length; i++) {
        const ch = data.charCodeAt(i);
        h = ((h << 5) - h + ch) | 0;
      }
      const hex = (h >>> 0).toString(16).padStart(8, "0");
      if (encoding === "hex") return hex;
      if (encoding === "base64") return btoa(hex);
      return hex;
    },
  };
  return hash;
});

export default _mod ?? {
  randomUUID,
  createHash,
};
