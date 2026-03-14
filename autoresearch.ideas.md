# Web Bundle Size — Ideas Backlog

## Applied (1124KB → 913KB raw / 281KB → 264KB gzip / 80KB → 57KB CSS)
- Replace react-markdown + remark-gfm with 7KB inline renderer (−137KB)
- Full d3 replacement: custom arrayUtils/svgPath/scales (−65KB total)
- CriHistoryChart rewrite from d3 DOM to React SVG (−13KB)
- SWC removeConsole + reactRemoveProperties (−2KB)
- Remove dead deps: @fontsource/ibm-plex-mono, @vercel/analytics, ib, zustand
- Move @sinclair/typebox, ws to devDependencies
- Remove 45+ dead CSS rules, 2 dead keyframe animations, unused CSS properties
- Remove dead code: store.ts, useIBStatus.ts
- Consolidate inline formatters → shared format.ts (−2KB)
- Extract inline styles to CSS utility classes (−2KB JS, +1KB CSS)
- Upgrade lucide-react 0.544→0.577 (−1KB gzip)
- Remove 8 unused CSS custom properties (−1KB CSS)
- Remove 8 dead CSS rules from legacy CtaTables
- Merge 50+ duplicate CSS rule declarations into grouped selectors (−6KB CSS)
- CSS class name shortening campaign: 9 batches, ~300 classes renamed to 2-4 char names (−12KB raw, −23KB CSS)
- Remove 40+ orphaned CSS rules from class rename leftovers (−3KB CSS)
- Remove unused buildTweetText export

## Exhaustively explored and rejected
- Dynamic imports: Turbopack adds +4-13KB chunk wrapper overhead
- All Next.js experimental flags: no effect under Turbopack
- Next.js 16.2.0-canary: +59KB REGRESSION
- .browserslistrc / .swcrc: Turbopack ignores both
- Replace lucide-react with inline SVG: +6KB — factory pattern minifies better
- Remove "use client" from context files: no effect
- React.lazy for liveline: +1KB + test failure
- Webpack bundler: 1193KB — 273KB LARGER than Turbopack
- Google Fonts @import to layout <head>: build crash
- sideEffects: false in package.json: no effect
- Extract shared SortTh component: −572B raw but +244B gzip
- Font-size CSS classes (text-9/10/11/12): −224B raw but +67B gzip
- CSS var name shortening: only ~574B total, breaks design system naming
- CSS nesting: only ~182B savings
- liveline 0.0.7: +1KB gzip regression
- Removing unused exports: Turbopack already tree-shakes them

## Key insights
1. **gzip vs raw tradeoffs**: Extracting to shared modules can HURT gzip. Always check gzip.
2. **2-char class names are optimal**: Shorter than gzip backreference overhead (3+ bytes), so they save BOTH raw AND gzip.
3. **CSS class name length directly impacts bundle**: Each char × occurrences = raw bytes. Turbopack does NOT deduplicate className string literals.
4. **Orphan cleanup is required after mass renames**: CSS selectors not caught by replace leave dead rules.
5. **Test-referenced classes are untouchable**: ~2.8KB of class name chars remain but all are in test assertions.

## True floor analysis (913KB)
| Component | Size | Notes |
|-----------|------|-------|
| Framework (React+ReactDOM+Next.js) | 456KB | Untouchable |
| Core-js polyfills | 110KB | Framework-generated, no config |
| App code | ~329KB | Class names minimized, formatters consolidated |
| Kit page (dev-only) | 14KB | Separate chunk, not loaded on main routes |
| Error page provider dupe | 5KB | Turbopack error boundary |
| Small chunks | ~10KB | Router, manifest, runtime |

## Remaining potential (all < 1KB each, severely diminishing)
- Remaining inline style properties (~250 across components) — single-property classes hurt gzip
- sectionTooltips.ts: ~7KB of tooltip text in bundle — can't move without behavior change
- Test-referenced long class names: ~2.8KB but off-limits
- aria-label text: 357B — can't remove (accessibility)
- title attributes: 279B — can't remove (UX)
