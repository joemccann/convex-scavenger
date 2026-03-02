# Convex Scavenger Web

## Prerequisites

- Node.js 20+
- API keys in `web/.env`

### API keys

Create `web/.env` from the template before running:

```bash
cd /Users/joemccann/dev/apps/finance/convex-scavenger/web
cp .env.example .env
```

Set at least:

- `ANTHROPIC_API_KEY`
- or `CLAUDE_CODE_API_KEY`
- or `CLAUDE_API_KEY`
- `UW_TOKEN`

Optional:

- `ANTHROPIC_MODEL`
- `ANTHROPIC_API_URL`

`UW_TOKEN` is required for Unusual Whales-backed PI commands (`scan`, `discover`, `fetch_*`, `evaluate`).

## Run

1. `cp .env.example .env`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000`

## Tests

- `npm test` runs integration checks for:
  - `/api/assistant` route in mock mode
  - project PI command entrypoints (`fetch_ticker`, `fetch_flow`, `discover`, `scanner`)
  - `kelly.py` output parsing

```bash
ASSISTANT_MOCK=1 npm test
```
