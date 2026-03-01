/** @type {import('next').NextConfig} */

// Per-module shims that work on both server (real Node) and browser (stubs).
const shimDir = "./src/lib/shims";
const genericShim = `${shimDir}/shim-generic.js`;

// Map each Node built-in to its dedicated shim (or generic fallback).
const moduleShims = {
	fs: `${shimDir}/shim-fs.js`,
	path: `${shimDir}/shim-path.js`,
	crypto: `${shimDir}/shim-crypto.js`,
	child_process: `${shimDir}/shim-child_process.js`,
	os: `${shimDir}/shim-os.js`,
	stream: `${shimDir}/shim-stream.js`,
	buffer: `${shimDir}/shim-buffer.js`,
	// Generic shim for modules we don't need specific exports from
	assert: genericShim,
	dns: genericShim,
	http: genericShim,
	https: genericShim,
	http2: genericShim,
	net: genericShim,
	querystring: genericShim,
	tls: genericShim,
	util: genericShim,
};

const nodeBuiltinAliases = Object.fromEntries(
	Object.entries(moduleShims).flatMap(([mod, shim]) => [
		[mod, shim],
		[`node:${mod}`, shim],
	]),
);

const httpProxyAlias = `${shimDir}/http-proxy-shim.js`;
const undiciAlias = `${shimDir}/undici-shim.js`;

const nextConfig = {
	typedRoutes: true,
	transpilePackages: ["pdfjs-dist", "@mariozechner/pi-ai", "@mariozechner/pi-web-ui", "@mariozechner/mini-lit"],
	turbopack: {
		resolveAlias: {
			...nodeBuiltinAliases,
			"@mariozechner/pi-ai": `${shimDir}/pi-ai-index-shim.js`,
			// Avoid Node-only HTTP proxy bootstrap from pi-ai in browser bundles.
			"@mariozechner/pi-ai/dist/utils/http-proxy.js": httpProxyAlias,
			"@mariozechner/pi-ai/dist/utils/http-proxy": httpProxyAlias,
			undici: undiciAlias,
			"node:undici": undiciAlias,
		},
	},
};

export default nextConfig;
