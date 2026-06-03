# Tim Givney — Personal Website

Source for [timgivney.com](https://timgivney.com) — the personal website of Tim Givney, mechanical engineer (Newcastle, NSW Australia).

Built with **React 19 + Vite + Tailwind CSS v4**. All images and the downloadable PDF are bundled locally under `client/public/assets/` — the site has no external/runtime dependencies and no third-party branding.

## Develop

```bash
corepack enable        # makes pnpm available
pnpm install
pnpm run dev           # http://localhost:3000
```

## Build

```bash
pnpm run build         # outputs static site to dist/
pnpm run preview       # preview the production build
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site
and publishes `dist/` to **GitHub Pages** (`https://timgivney.com`).
No manual steps required after the initial Pages "Source: GitHub Actions" setting.

## Project structure

```
client/
  index.html          ← document head: SEO meta, Open Graph, JSON-LD, favicons
  public/             ← static assets served at site root
    assets/           ← images + downloadable PDF
    favicon.*, og-image.png, robots.txt, sitemap.xml, site.webmanifest
  src/
    pages/Home.tsx    ← the website page content
    pages/NotFound.tsx
    components/        ← UI primitives (shadcn/ui) + ThemeContext, ErrorBoundary
    index.css         ← Tailwind + design tokens (cobalt #1B3F6B / gold #C9A84C)
vite.config.ts
```

## SEO

- Descriptive `<title>`, meta description, keywords, canonical URL
- Open Graph + Twitter Card tags with a generated `og-image.png`
- `Person` JSON-LD structured data
- `robots.txt` + `sitemap.xml`
- Lazy-loaded images with descriptive `alt` text; single `<h1>`
