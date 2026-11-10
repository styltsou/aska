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
