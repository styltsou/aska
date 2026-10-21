# Aska Extension

A browser extension for Aska, built with [WXT](https://wxt.dev/) and React.

## Development

```sh
npm install
npm run dev
```

WXT starts a development browser with the extension loaded. Use `npm run build` to create a production build, or `npm run zip` to package it for distribution. See the [WXT documentation](https://wxt.dev/guide/installation.html) for browser-specific setup and commands.

## Color picker

Open the extension on an HTTP or HTTPS page and choose **Use eyedropper**.
The extension captures the visible tab once and samples that local image as
the cursor moves. Click to select a color, or press Escape to cancel. The
selected HEX value is kept locally in `askaPendingColor` and appears in the
popup on your next visit. It is ready for the future authenticated Inbox save
flow. The screenshot is neither persisted nor uploaded.
