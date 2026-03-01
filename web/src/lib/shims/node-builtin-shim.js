/**
 * Universal shim for Node built-in modules.
 * Provides named exports so Turbopack static analysis passes for both
 * client (browser) and server (Node.js) bundles.
 *
 * On the server, the real Node modules are loaded via globalThis.__nodeBuiltins
 * which is populated at module load time.
 */

// Populate real modules on the server using a Function constructor to
// avoid Turbopack intercepting the require() call.
const _real = {};
if (typeof process !== "undefined" && process.versions?.node) {
	try {
		// Use Function constructor to create a require that Turbopack won't intercept
		const _require = new Function("return typeof require !== 'undefined' ? require : null")();
		if (_require) {
			for (const mod of ["fs", "crypto", "child_process", "path", "os", "stream", "buffer", "util", "http", "https", "net", "tls", "dns", "assert", "querystring"]) {
				try { _real[mod] = _require(mod); } catch {}
			}
			try { _real.http2 = _require("http2"); } catch {}
		}
	} catch {}
}

const noop = () => {};

// fs
export const promises = _real.fs?.promises ?? {};
export const readFile = _real.fs?.readFile ?? noop;
export const readFileSync = _real.fs?.readFileSync ?? noop;
export const writeFile = _real.fs?.writeFile ?? noop;
export const writeFileSync = _real.fs?.writeFileSync ?? noop;
export const existsSync = _real.fs?.existsSync ?? (() => false);
export const mkdirSync = _real.fs?.mkdirSync ?? noop;
export const readdirSync = _real.fs?.readdirSync ?? (() => []);
export const statSync = _real.fs?.statSync ?? noop;

// crypto
export const randomUUID = _real.crypto?.randomUUID ?? (() => Math.random().toString(36).slice(2));
export const createHash = _real.crypto?.createHash ?? noop;

// child_process
export const spawn = _real.child_process?.spawn ?? noop;
export const exec = _real.child_process?.exec ?? noop;
export const execSync = _real.child_process?.execSync ?? noop;

// path
export const join = _real.path?.join ?? ((...a) => a.join("/"));
export const resolve = _real.path?.resolve ?? ((...a) => a.join("/"));
export const dirname = _real.path?.dirname ?? ((p) => p);
export const basename = _real.path?.basename ?? ((p) => p);
export const extname = _real.path?.extname ?? (() => "");
export const sep = _real.path?.sep ?? "/";
export const normalize = _real.path?.normalize ?? ((p) => p);
export const relative = _real.path?.relative ?? ((from, to) => to);
export const isAbsolute = _real.path?.isAbsolute ?? (() => false);
export const parse = _real.path?.parse ?? ((p) => ({ root: "", dir: "", base: p, ext: "", name: p }));

// os
export const homedir = _real.os?.homedir ?? (() => "/");
export const platform = _real.os?.platform ?? (() => "browser");
export const tmpdir = _real.os?.tmpdir ?? (() => "/tmp");

// stream
export const Readable = _real.stream?.Readable ?? class {};
export const Writable = _real.stream?.Writable ?? class {};
export const Transform = _real.stream?.Transform ?? class {};
export const PassThrough = _real.stream?.PassThrough ?? class {};

// buffer
export const Buffer = _real.buffer?.Buffer ?? globalThis.Buffer ?? { from: () => new Uint8Array(), alloc: () => new Uint8Array() };

// Default: export the fs module (most common use case) or a proxy
export default _real.fs ?? {};
