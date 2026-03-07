# TODO

## Dependency Graph
- T1 (Scope Alignment) -> T2 (Next.js App Bootstrap) -> T3 (Backend Command Runtime) -> T4 (Conversational Chat UI) -> T5 (Technical Minimalist Design) -> T6 (Verification + Docs)

## Tasks
- [x] T1: Finalize feature scope and command contract
  - depends_on: []
  - Success criteria: command surface includes scan, discover, evaluate, portfolio, journal, and watchlist management.
  - Notes: Keep local `.pi` command/prompt behavior as source-of-truth while exposing chat-friendly actions.

- [x] T2: Scaffold Next.js web application in `web/`
  - depends_on: [T1]
  - Success criteria:
    - New Next.js app builds in isolation.
    - Route entry, root layout, and global styles are in place.
    - `npm run dev` can start without touching CLI-only files.

- [x] T3: Implement command execution API layer
  - depends_on: [T2]
  - Success criteria:
    - `/api/chat` and runtime helpers can invoke `scanner.py`, `discover.py`, `fetch_flow.py`, `fetch_ticker.py`, `fetch_options.py`.
    - `watchlist.json` can be read/updated via chat-safe helper actions.
    - `portfolio.json` and `trade_log.json` are read and formatted for UI.
    - API responses include parseable payload + human-readable summary.

- [x] T4: Build conversational chat experience
  - depends_on: [T3]
  - Success criteria:
    - Message loop supports user prompts and slash-command style actions.
    - Quick action buttons trigger scan/evaluate/watchlist/portfolio/journal flows.
    - Command results render consistently with optional JSON details.

- [x] T5: Apply Technical Minimalist styling
  - depends_on: [T4]
  - Success criteria:
    - Palette is Paper/Forest/Grid with Coral/Mint/Gold accents.
    - Space Grotesk/JetBrains Mono usage for headers and metadata labels.
    - Flat surfaces, 1px/2px radius only, 0/2px border-radius.
    - Image hover behavior uses luminosity blend and grayscale-like idle state.

- [x] T6: Verify and document completion
  - depends_on: [T5]
  - Success criteria:
    - `cd web && npm run build` passes.
    - Manual route/API checks for each major command.
    - `README.md` notes run commands and usage workflow.

## Progress
- [x] Plan drafted
- [x] Discovery complete
- [x] Analysis complete
- [x] Implementation complete
- [x] Report delivered

## Review
- Completed API route checks for `/help`, scan/discover/evaluate/watchlist/portfolio/journal command wiring through `web/src/lib/pi-shell.ts`.
- Verified `cd web && npm run build` and `npm run lint`.
- Verified runtime endpoint by starting `next dev` and POSTing to `/api/chat`.

---

## Session: Repo Architecture Exploration (2026-03-01)

### Dependency Graph
- T1 (Inventory repository structure and identify candidate entrypoints) depends_on: []
- T2 (Inspect script orchestration and command flow across docs + code) depends_on: [T1]
- T3 (Inspect data/config files and runtime state flow) depends_on: [T1]
- T4 (Inspect `.pi` integration points, prompts, and extension hook invocation paths) depends_on: [T1]
- T5 (Synthesize architecture map + command flow + `.pi` hook invocation narrative) depends_on: [T2, T3, T4]
- T6 (Verification pass and document review notes) depends_on: [T5]

### Checklist
- [x] T1 Inventory repository structure and identify candidate entrypoints
- [x] T2 Inspect script orchestration and command flow across docs + code
- [x] T3 Inspect data/config files and runtime state flow
- [x] T4 Inspect `.pi` integration points, prompts, and extension hook invocation paths
- [x] T5 Synthesize architecture map + command flow + `.pi` hook invocation narrative
- [x] T6 Verification pass and document review notes

### Review
- Verified script entrypoint CLIs: `fetch_flow.py`, `discover.py`, `scanner.py`, `kelly.py`, `fetch_options.py`; validated `fetch_ticker.py` usage path.
- Validated JSON data files parse cleanly via `python3 -m json.tool`.
- Confirmed `.pi` hook points: `before_agent_start` and `session_start` in startup extension; `kelly_calc` tool + `positions` command in trading extension.
- Confirmed prompt templates exist for `scan`, `evaluate`, `portfolio`, `journal`; no dedicated `.pi/prompts/discover.md` found.
- Confirmed existing web UI example (`packages/web-ui/example`) is Vite-based and browser-focused.

---

## Session: Upstream `pi-mono` Harness Exploration (2026-03-01)

### Dependency Graph
- T1 (Clone upstream and inventory harness/core packages) depends_on: []
- T2 (Trace runtime flow: CLI main -> session creation -> agent loop) depends_on: [T1]
- T3 (Trace agent/resource/extension definition and load model) depends_on: [T1]
- T4 (Trace configuration model: settings/auth/models/resources paths + precedence) depends_on: [T1]
- T5 (Trace invocation surfaces: CLI modes, print/json, RPC, SDK client API) depends_on: [T2, T3, T4]
- T6 (Synthesize findings and validate references) depends_on: [T5]

### Checklist
- [x] T1 Clone upstream and inventory harness/core packages
- [x] T2 Trace runtime flow: CLI main -> session creation -> agent loop
- [x] T3 Trace agent/resource/extension definition and load model
- [x] T4 Trace configuration model: settings/auth/models/resources paths + precedence
- [x] T5 Trace invocation surfaces: CLI modes, print/json, RPC, SDK client API
- [x] T6 Synthesize findings and validate references

### Review
- Verified bootstrap and mode dispatch in `packages/coding-agent/src/main.ts` and `src/cli/args.ts`, including two-pass arg parsing for extension flags.
- Verified session/runtime assembly in `createAgentSession` and `AgentSession._buildRuntime` (tools, system prompt, extension runner binding).
- Verified core loop semantics in `packages/agent/src/agent.ts` and `src/agent-loop.ts` (steering/follow-up queues, tool call execution, turn boundaries).
- Verified configuration layering and paths in `config.ts`, `settings-manager.ts`, `model-registry.ts`, `resource-loader.ts`, and `package-manager.ts`.
- Verified workflow invocation surfaces across `print-mode.ts`, `rpc-types.ts`, `rpc-mode.ts`, and `rpc-client.ts`, plus SDK exports in `src/index.ts`.

---

## Session: Real-Time Option Contract Price Subscriptions (2026-03-03)

### Problem
IB realtime WS server only subscribed to stock contracts (`ib.contract.stock()`), so options positions (bear put spreads, bull call spreads, short puts) never received real-time price updates.

### Solution
Composite key scheme: stock prices keyed by ticker (`"AAPL"`), option prices by `{SYMBOL}_{YYYYMMDD}_{STRIKE}_{RIGHT}` (e.g., `"EWY_20260417_42_P"`). Both coexist in the same `Record<string, PriceData>` map.

### Checklist
- [x] Add shared types & utilities (`web/lib/pricesProtocol.ts`): `OptionContract`, `optionKey()`, `contractsKey()`, `portfolioLegToContract()`
- [x] Update IB server (`scripts/ib_realtime_server.js`): `normalizeContracts()`, refactored `startLiveSubscription(key, ibContract)`, option subscribe handler via `ib.contract.option()`
- [x] Update client hook (`web/lib/usePrices.ts`): `contracts` option, `contractHash` memoization, contracts in subscribe message
- [x] Extract contracts from portfolio (`web/components/WorkspaceShell.tsx`): `portfolioContracts` useMemo iterates non-Stock legs
- [x] Display real-time option prices (`web/components/WorkspaceSections.tsx`): `legPriceKey()`, real-time MV/daily-change for options, `LegRow` with WS prices

### Files Modified
- `web/lib/pricesProtocol.ts`
- `scripts/ib_realtime_server.js`
- `web/lib/usePrices.ts`
- `web/components/WorkspaceShell.tsx`
- `web/components/WorkspaceSections.tsx`

### Review
- TypeScript compilation passes (no errors in modified files)
- Server syntax check passes (`node --check`)
- Backward compatible: stock subscriptions unchanged, option contracts are additive

---

## Session: MenthorQ CTA Integration (2026-03-07)

### Checklist
- [x] Create `scripts/fetch_menthorq_cta.py` — Playwright login, screenshot, Vision extraction, daily cache
- [x] Integrate MenthorQ data into `scripts/cri_scan.py` — `run_analysis()`, console summary, HTML report section
- [x] Create `scripts/tests/test_menthorq_cta.py` — 20 tests (cache, find, parsing, trading date, CRI shape)
- [x] Update `CLAUDE.md` — command, script, cache file references
- [x] Update `.pi/AGENTS.md` — command, script, data file references
- [x] Update `docs/strategies.md` — MenthorQ section in Strategy 6
- [x] Install Playwright + Chromium + httpx
- [x] Live end-to-end verification — 37 assets, 4 tables, SPX pctl_3m=13 z=-1.56

### Files Created
- `scripts/fetch_menthorq_cta.py`
- `scripts/tests/test_menthorq_cta.py`
- `data/menthorq_cache/cta_2026-03-06.json`

### Files Modified
- `scripts/cri_scan.py`
- `CLAUDE.md`
- `.pi/AGENTS.md`
- `docs/strategies.md`
- `PROGRESS.md`

### Review
- 73/73 tests pass (20 new + 53 existing CRI)
- Live fetch: 42.6s, all 4 tables extracted
- Cache hit: instant on subsequent runs
- CRI scanner gracefully handles missing MenthorQ data (fallback text)

---

## Session: Combo Order Fixes + Leg P&L (2026-03-06)

### Checklist
- [x] Fix ModifyOrderModal BAG price resolution — pass `portfolio`, compute net BID/ASK/LAST from per-leg WS prices
- [x] Fix triplicate executed orders — replace `setInterval` with chained `setTimeout` in cancel/modify polling + dedupe safety net
- [x] Add per-leg P&L in expanded combo rows — `sign × (|MV| − |EC|)` with color coding
- [x] Update CLAUDE.md calculations + price resolution docs

### Files Modified
- `web/components/ModifyOrderModal.tsx`
- `web/components/WorkspaceSections.tsx`
- `web/components/PositionTable.tsx`
- `web/lib/OrderActionsContext.tsx`
- `CLAUDE.md`

### Review
- `tsc --noEmit` — no new type errors
- Orders page: 32 entries (down from 35), no triplicate cancelled rows, combo last prices resolved
- Portfolio page: AAOI expanded legs show per-leg P&L summing to position-level total
