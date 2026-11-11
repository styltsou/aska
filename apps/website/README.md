# Mnemee Website

The marketing site for Mnemee, built with Astro. It is a package in the Mnemee
monorepo, so dependencies are installed from the repository root.

## Development

```sh
bun install            # from the repository root
cd apps/website
cp .env.example .env
bun run dev
```

Set `PUBLIC_APP_URL` to the deployed application base URL. The landing page uses it to generate its `/login` and `/signup` links. It defaults to `https://app.mnemee.space`.

```sh
bun run build
```

## SEO and sharing

- `SITE_URL` sets the canonical origin used for canonical and Open Graph URLs, the sitemap, `robots.txt` and `llms.txt` (default `https://mnemee.space`).
- Page copy that is shared between the page, the JSON-LD, `llms.txt` and `/index.md` lives in `src/lib/content.ts`; edit it there.
- `/index.md` is a markdown version of the landing page and `/llms.txt` is a short guide for language models. Both are generated at build time.
- The social preview image is `public/og-image.png`. Regenerate it with `bun run og` after changing the tagline or artwork.
