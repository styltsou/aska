# Mnemee Website

The standalone marketing site for Mnemee, built with Astro.

## Development

```sh
bun install
cp .env.example .env
bun run dev
```

Set `PUBLIC_APP_URL` to the deployed application base URL. The landing page uses it to generate its `/login` and `/signup` links. It defaults to `https://app.mnemee.space`.

```sh
bun run build
```
