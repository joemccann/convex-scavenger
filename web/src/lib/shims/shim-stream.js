let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  if (_require) _mod = _require("stream");
} catch {}

class StubStream {
  constructor() {
    this._events = {};
  }
  on(event, fn) { this._events[event] = fn; return this; }
  once(event, fn) { return this.on(event, fn); }
  emit(event, ...args) { this._events[event]?.(...args); return true; }
  pipe(dest) { return dest; }
  read() { return null; }
  write() { return true; }
  end() { return this; }
  destroy() { return this; }
}

export const Readable = _mod?.Readable ?? class Readable extends StubStream {};
export const Writable = _mod?.Writable ?? class Writable extends StubStream {};
export const Transform = _mod?.Transform ?? class Transform extends StubStream {};
export const PassThrough = _mod?.PassThrough ?? class PassThrough extends StubStream {};

export default _mod ?? {
  Readable,
  Writable,
  Transform,
  PassThrough,
};
