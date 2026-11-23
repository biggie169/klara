# Klara product page

Static product page for the Klara Hair Loss Prevention System (shampoo + treatment, made in Korea by NIBEC). It's a concept page: checkout is a placeholder.

- `src/index.html`: the page source (edit this, then build)
- `build.js`: renders a fully translated page per language into `public/` (`/`, `/de/`, `/fr/`, `/es/`, `/it/`, `/nl/`, `/pl/`), plus `robots.txt` and, once the domain is set, `sitemap.xml`, canonical and hreflang links
- `public/app.js`: the 360° bottle spin, product switcher, quantity and bag, language switching and cookie consent
- `public/i18n.js`: page copy in English, German, French, Spanish, Italian, Dutch and Polish
- `public/assets/`: bottle images, spin sprite sheets, press logos and the self-hosted Poppins font (SIL OFL)

## Build

After any change to `src/index.html` or `public/i18n.js`:

    SITE_URL=https://your-domain node build.js

Leave out `SITE_URL` until the live domain is known; the canonical, hreflang and sitemap entries need it. Commit the generated `public/` files: Cloudflare serves them as they are.

## Run locally

    npx wrangler dev

## Deploy to Cloudflare

    npx wrangler login
    npx wrangler deploy

This deploys as a Cloudflare Worker that serves static assets (`wrangler.jsonc`). It goes live at `klara.<your-subdomain>.workers.dev`.
