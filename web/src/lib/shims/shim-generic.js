// Generic empty shim for Node built-in modules that don't need specific exports.
// Used for: http, https, http2, net, tls, dns, assert, querystring, util
//
// On the server, attempts to load the real module.
// In the browser, exports an empty object.

let _mod;
try {
  const _require = new Function("return typeof require !== 'undefined' ? require : null")();
  // Cannot know which module this shim replaces, so just export empty.
  // Specific modules that need real exports should use dedicated shims.
} catch {}

export default {};
