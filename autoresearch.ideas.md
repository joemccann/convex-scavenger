# Web Bundle Size — Ideas Backlog

## Applied (1124KB → 920KB raw / 281KB → 264KB gzip / 80KB → 71KB CSS)
- Replace react-markdown + remark-gfm with 7KB inline renderer (−137KB)
- Full d3 replacement: selective imports → custom arrayUtils/svgPath/scales (−65KB total)
- CriHistoryChart rewrite from d3 DOM to React SVG (−13KB)
- SWC removeConsole + reactRemoveProperties (−2KB)
- Remove dead dependencies: @fontsource/ibm-plex-mono, @vercel/analytics, ib, zustand
- Move @sinclair/typebox, ws to devDependencies
- Replace Tailwind with 22 inline utility classes + minimal CSS reset (−6KB CSS)
- Remove 45+ dead CSS rules, 2 dead keyframe animations, unused CSS properties
- Remove dead code: store.ts, useIBStatus.ts

## Exhaustively explored and rejected (sessions 1–7)
- Dynamic imports (ChatPanel, PriceChart, tabs): Turbopack adds +4-13KB chunk wrapper overhead
- optimizePackageImports / modularizeImports: Turbopack already tree-shakes optimally
- .browserslistrc modern browsers: Turbopack ignores — polyfills unchanged, app grew 6KB
- experimental.optimizeCss: no effect under Turbopack
- experimental.turbopackInferModuleSideEffects: no change
- experimental.inlineCss: no change to JS, CSS file still generated
- .swcrc custom minification: Turbopack ignores .swcrc entirely
- Replace lucide-react with inline SVG: +6KB — factory pattern minifies better
- Remove "use client" from context files: Turbopack chunking unchanged
- Module boundary inlining: Turbopack overhead is ~20 bytes/module — negligible
- React.lazy for liveline: +1KB chunk overhead + test failure
- Webpack bundler (--webpack): 1193KB — 273KB LARGER than Turbopack
- Move Google Fonts @import to layout <head>: build crash (prerendering fails)
- String/JSX pattern dedup: ~4.6KB theoretical, net <0.5KB after refactor overhead
- reactStrictMode: false: no production effect

## Session 7 additions
- Kit page chunk analysis: 14.7KB separate chunk, but SHARED with production lucide/semantic code — can't eliminate
- Polyfill chunk (112KB): confirmed client-loaded via HTML `<script>` tags on every page — server-generated, framework-controlled
- Liveline 0.0.7: 318KB (larger than 0.0.6 at 316KB) — no savings
- Next.js 16.1.6 is latest stable — no upgrade path

## True floor analysis (920KB)
| Component | Size | Notes |
|-----------|------|-------|
| Framework (React+ReactDOM+Next.js) | 456KB | Untouchable |
| Core-js polyfills | 110KB | Framework-generated, no config to control |
| App code (51 client components) | 332KB | 0.70 source→bundle ratio = optimal |
| Kit page (dev-only) | 14KB | Only accessible via /kit, not linked |
| Error page provider dupe | 5KB | Turbopack error boundary — can't control |
| Small chunks (router, manifest, runtime) | 3KB | Framework infrastructure |

Production dependencies: next, react, react-dom, lucide-react, liveline (5 total)
