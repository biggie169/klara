# Klara product page

Static product page for the Klara Hair Loss Prevention System (shampoo + treatment, made in Korea by NIBEC). It's a concept page: checkout is a placeholder.

- `public/index.html`: the page
- `public/app.js`: the 360° bottle spin, product switcher, quantity and bag, language switching and cookie consent
- `public/i18n.js`: page copy in English, German, French, Spanish, Italian, Dutch and Polish
- `public/assets/`: bottle images, spin sprite sheets, press logos and the self-hosted Poppins font (SIL OFL)

## Run locally

    npx wrangler dev

## Deploy to Cloudflare

    npx wrangler login
    npx wrangler deploy

This deploys as a Cloudflare Worker that serves static assets (`wrangler.jsonc`). It goes live at `klara.<your-subdomain>.workers.dev`.
