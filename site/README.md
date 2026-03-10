# Radon Site

Marketing site for Radon, built as a standalone Next.js app in `site/`.

## Local Development

```bash
cd site
npm install
npm run dev
```

The site runs on `http://localhost:3333`.

## Vercel Deployment

The Vercel project for the site should use `site/` as its **Root Directory**.

This app includes [vercel.json](/Users/joemccann/dev/apps/finance/radon/site/vercel.json) with an `ignoreCommand` that only allows a deploy to continue when files under `site/` changed. Pushes that only touch `web/`, `scripts/`, `data/`, or other repo paths will skip the site build.

The ignore step is implemented by [vercel-ignore-build.mjs](/Users/joemccann/dev/apps/finance/radon/site/scripts/vercel-ignore-build.mjs). It compares the current commit against the previous deployed commit and defaults to **continuing the build** if Vercel cannot determine the diff.
