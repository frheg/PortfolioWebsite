# PortfolioWebsite (React + Vite)

This site is built with Vite + React and configured for deployment to GitHub Pages.

## Local development

```zsh
npm install
npm run dev
```

## Build

```zsh
npm run build
```

Outputs to `dist/`.

## GitHub Pages deployment

This repo contains a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds the site and deploys `dist/` to Pages on pushes to `main`.

Vite's `base` must match where the site is hosted:
- If hosting at `https://<user>.github.io/PortfolioWebsite/`, set `base: '/PortfolioWebsite/'` in `vite.config.js`.
- For a custom domain (`fredrichegland.no`), set `base: '/'` (this repo is currently configured this way) and include `public/CNAME`.

### First-time setup

1. In GitHub → repo Settings → Pages:
   - Source: GitHub Actions.
   - Custom domain: set to `fredrichegland.no` (and `www.fredrichegland.no`), then save and enforce HTTPS.
2. DNS: In your DNS provider, create CNAME for `www` to `<user>.github.io` and A records for apex pointing to GitHub Pages IPs, or use an ALIAS/ANAME if supported. See GitHub Pages docs for the current IPs.
3. Push to `main` to trigger the workflow.

### Common pitfalls

- 404s for `/src/main.jsx` or assets: ensure `vite.config.js` has `base: '/PortfolioWebsite/'` and that you access the site via `https://<user>.github.io/PortfolioWebsite/` (not the root).
- Favicon path: referenced from `src/assets/favicon.ico` and rewritten by Vite during build.
