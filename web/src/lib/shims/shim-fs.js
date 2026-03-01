let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("fs");
} catch {}

const noop = () => {};
const noopAsync = () => Promise.resolve();

export const promises = _mod?.promises ?? {
  readFile: noopAsync,
  writeFile: noopAsync,
  mkdir: noopAsync,
  readdir: () => Promise.resolve([]),
  stat: noopAsync,
  access: noopAsync,
  unlink: noopAsync,
};
export const readFile = _mod?.readFile ?? noop;
export const readFileSync = _mod?.readFileSync ?? (() => "");
export const writeFile = _mod?.writeFile ?? noop;
export const writeFileSync = _mod?.writeFileSync ?? noop;
export const existsSync = _mod?.existsSync ?? (() => false);
export const mkdirSync = _mod?.mkdirSync ?? noop;
export const readdirSync = _mod?.readdirSync ?? (() => []);
export const statSync = _mod?.statSync ?? (() => ({}));

export default _mod ?? {
  promises,
  readFile,
  readFileSync,
  writeFile,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
};
