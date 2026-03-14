# Web Bundle Size — Ideas Backlog

## Applied (1124KB → 920KB, −18.2%)
- Replace react-markdown + remark-gfm with lightweight inline renderer (−137KB raw)
- d3 selective imports instead of `import * as d3` (−16KB raw)
- Rewrite CriHistoryChart from imperative d3 DOM to declarative React SVG (−13KB, removes d3-selection + d3-axis)
- Replace d3-scale with 3.9KB scales.ts (−31KB, removes 6 transitive deps)
- Replace d3-shape with 2.6KB svgPath.ts (−5KB)
- Replace d3-array with 1.5KB arrayUtils.ts
- Replace d3-time-format with Intl.DateTimeFormat
- SWC removeConsole in production (−1KB)
- Strip data-testid from production via SWC reactRemoveProperties (−1KB)
- Remove dead CSS rule blocks (−3KB CSS)
- Remove dead deps: @fontsource/ibm-plex-mono, @vercel/analytics, ib
- Move @sinclair/typebox, ws to devDependencies
- Consolidate 12 duplicate fmt* functions into shared lib/format.ts (code quality, 0KB)

## Explored and rejected
- Dynamic import ChatPanel/MetricCards/WorkspaceSections: +13KB overhead from chunk wrappers
- Dynamic import PriceChart only: +4KB overhead
- Dynamic import all ticker-detail tabs: +11KB overhead
- optimizePackageImports / modularizeImports: Turbopack already handles tree-shaking
- reactStrictMode: false: no effect on production bundle
- Removing dead packages: no bundle change (Turbopack tracks imports, not package.json)
- Removing 11 dead exports from lib/utils.ts: Turbopack already tree-shook them — 0KB
- CSS dead selector audit: only 2 truly dead (googleapis, sr-only) — negligible
- Lucide-react optimization: Turbopack already tree-shakes to 25 used icons

## Remaining (diminishing returns — none expected to move needle)
- Replace liveline canvas chart (~39KB) with custom Canvas API (major rewrite, risky)
- Route-level code splitting (requires architecture change, Turbopack adds overhead)
- Reduce sectionTooltips.ts verbose text (changes content, not a pure optimization)
- core-js polyfill chunk (112KB): controlled by Next.js, no user-facing config to remove
