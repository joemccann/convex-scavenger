let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("path");
} catch {}

export const join = _mod?.join ?? ((...parts) => parts.filter(Boolean).join("/").replace(/\/+/g, "/"));
export const resolve = _mod?.resolve ?? ((...parts) => join(...parts));
export const dirname = _mod?.dirname ?? ((p) => {
  const parts = p.split("/");
  parts.pop();
  return parts.join("/") || ".";
});
export const basename = _mod?.basename ?? ((p, ext) => {
  const base = p.split("/").pop() || "";
  if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
  return base;
});
export const extname = _mod?.extname ?? ((p) => {
  const base = p.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot) : "";
});
export const sep = _mod?.sep ?? "/";
export const normalize = _mod?.normalize ?? ((p) => p.replace(/\/+/g, "/"));
export const relative = _mod?.relative ?? ((from, to) => to);
export const isAbsolute = _mod?.isAbsolute ?? ((p) => p.startsWith("/"));
export const parse = _mod?.parse ?? ((p) => {
  const dir = dirname(p);
  const base = basename(p);
  const ext = extname(p);
  const name = base.slice(0, base.length - ext.length);
  return { root: isAbsolute(p) ? "/" : "", dir, base, ext, name };
});

export default _mod ?? {
  join,
  resolve,
  dirname,
  basename,
  extname,
  sep,
  normalize,
  relative,
  isAbsolute,
  parse,
};
