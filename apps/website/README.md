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

## Website analytics

Set `PUBLIC_POSTHOG_KEY` to the public project token from PostHog and `PUBLIC_POSTHOG_HOST` to the matching regional ingestion host at build time. The default host is the EU cloud (`https://eu.i.posthog.com`); use the host shown in your PostHog project settings. Never use a personal API key here. The consent prompt is available during Astro development for design testing, but analytics never loads in development. In production builds, both are disabled when the project token is absent. The marketing site is deployed separately to Cloudflare; set these as Cloudflare build variables for the live deployment. Rebuild and deploy after changing these values.

The website loads PostHog only after a visitor accepts analytics. It tracks page views, with interaction autocapture, session replay, and surveys disabled. Visitors can change their choice using Analytics preferences. This setup does not instrument the separately deployed app.


