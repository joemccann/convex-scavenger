let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("os");
} catch {}

export const homedir = _mod?.homedir ?? (() => "/");
export const platform = _mod?.platform ?? (() => "browser");
export const tmpdir = _mod?.tmpdir ?? (() => "/tmp");

export default _mod ?? {
  homedir,
  platform,
  tmpdir,
};
