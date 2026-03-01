let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("child_process");
} catch {}

const notAvailable = () => {
  throw new Error("child_process is not available in the browser");
};

export const spawn = _mod?.spawn ?? notAvailable;
export const exec = _mod?.exec ?? notAvailable;
export const execSync = _mod?.execSync ?? notAvailable;

export default _mod ?? {
  spawn,
  exec,
  execSync,
};
