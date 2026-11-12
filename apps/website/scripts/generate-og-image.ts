/*
 * Generates the social preview image (public/og-image.png, 1200x630) by screenshotting the dev-only page
 * src/pages/internal/[name].astro, which renders the real hero workspace so the cards match the app. Run it after
 * changing the copy or the artwork, with the dev server running:
 *
 *   bun run dev        (in one terminal)
 *   bun run og         (in another)
 *
 * Environment: OG_URL (default http://localhost:4321/internal/og-card) and CHROME (path to a Chrome/Chromium binary).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const url = process.env.OG_URL ?? 'http://localhost:4321/internal/og-card';
const chrome =
	process.env.CHROME ??
	['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome not found: set CHROME to its path.');

const output = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'og-'));
const raw = join(dir, 'raw.png');

try {
	execFileSync(chrome, [
		'--headless=new',
		'--disable-gpu',
		'--hide-scrollbars',
		'--force-device-scale-factor=1',
		'--window-size=1200,630',
		'--virtual-time-budget=8000',
		`--user-data-dir=${join(dir, 'profile')}`,
		`--screenshot=${raw}`,
		url,
	]);
	await sharp(raw).extract({ left: 0, top: 0, width: 1200, height: 630 }).png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 }).toFile(output);
	console.log(`wrote ${output}`);
} finally {
	rmSync(dir, { recursive: true, force: true });
}
