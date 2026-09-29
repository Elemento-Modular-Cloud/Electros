# Electros documentation (VitePress)

User guide for [Electros](https://www.electros.cloud) — intended to ship as **`docs.electros.cloud`**, a sibling of `www.electros.cloud`.

Visual language matches the marketing site: Elemento theme tokens (`#FFA600` accent), Inter / Red Hat Display, and the Electros shield mark.

## Languages

| Locale | Path |
|--------|------|
| English (default) | `/` |
| Italian | `/it/` |
| French | `/fr/` |

VitePress shows a language switcher in the nav. Locale content lives under `docs/it/` and `docs/fr/` (mirrored markdown). Screenshots stay in `docs/user-guide/assets/` and are linked from each locale.

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

Output is written to `docs/.vitepress/dist/`. Deploy that folder to the `docs.electros.cloud` host (or your CDN / Pages project). For GitHub Pages, the workflow on `main` builds this folder and pushes the static site to the `gh-pages` branch.
