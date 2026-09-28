# Electros documentation (VitePress)

User guide for [Electros](https://www.electros.cloud) — intended to ship as **`docs.electros.cloud`**, a sibling of `www.electros.cloud`.

Visual language matches the marketing site: Elemento theme tokens (`#FFA600` accent), Inter / Red Hat Display, and the Electros shield mark.

## Run locally

```bash
cd docs
npm install
npm run docs:dev
```

Then open the local VitePress URL (default port **5174**).

## Build

```bash
cd docs
npm run docs:build
npm run docs:preview
```

Output is written to `docs/.vitepress/dist/`. Deploy that folder to the `docs.electros.cloud` host (or your CDN / Pages project).
