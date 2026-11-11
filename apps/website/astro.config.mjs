// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // The canonical origin of the marketing site. It feeds canonical and Open Graph URLs, the sitemap and llms.txt.
  site: process.env.SITE_URL ?? 'https://mnemee.space',
  devToolbar: { enabled: false },
  integrations: [react()]
});
