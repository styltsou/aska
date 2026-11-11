/*
 * Generates the social preview image (public/og-image.png, 1200x630) from the site's own assets: the hero watercolour, a few
 * of the product's cards, the logo and the tagline. Run it after changing the tagline or the artwork:
 *
 *   bun run og
 *
 * Text is drawn with the system font named by OG_FONT (default "Segoe UI"), because sharp's renderer cannot load the
 * site's web font; the committed image is what ships, so this only needs to run on whichever machine regenerates it.
 */
import sharp, { type OverlayOptions } from 'sharp';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const asset = (name: string) => `${root}src/assets/images/${name}`;
const W = 1200;
const H = 630;
const FONT = process.env.OG_FONT ?? 'Segoe UI';

type Layer = OverlayOptions;

const roundedMask = (w: number, h: number, r: number) =>
	Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);

/** A rounded, tilted card with a soft shadow, centred on (cx, cy). */
async function card(image: Buffer, w: number, h: number, angle: number, cx: number, cy: number): Promise<Layer[]> {
	const face = await sharp(image).resize(w, h, { fit: 'cover' }).composite([{ input: roundedMask(w, h, 16), blend: 'dest-in' }]).png().toBuffer();
	// A hairline so the card edge reads against the watercolour.
	const border = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="none" stroke="#fff" stroke-opacity=".45"/></svg>`);
	const framed = await sharp(face).composite([{ input: border }]).png().toBuffer();
	const tilted = await sharp(framed).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
	const { width = w, height = h } = await sharp(tilted).metadata();
	const shadow = await sharp({ create: { width, height, channels: 4, background: { r: 6, g: 14, b: 34, alpha: 0.55 } } })
		.composite([{ input: tilted, blend: 'dest-in' }])
		.png()
		.toBuffer()
		.then((buffer) => sharp(buffer).extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(18).png().toBuffer());
	const left = Math.round(cx - width / 2);
	const top = Math.round(cy - height / 2);
	return [
		{ input: shadow, left: left - 40, top: top - 40 + 18 },
		{ input: tilted, left, top },
	];
}

const text = (markup: string, size: number, opacity = 1, extra = '') =>
	sharp({ text: { text: `<span font="${FONT} ${size}" foreground="#ffffff" alpha="${Math.round(opacity * 65535)}" ${extra}>${markup}</span>`, font: FONT, rgba: true, dpi: 72 } })
		.png()
		.toBuffer();

async function main() {
	// Background: the hero watercolour, deepened toward navy on the left where the text sits.
	const backdrop = await sharp(asset('hero.webp'))
		.resize(W, H, { fit: 'cover', position: 'attention' })
		.modulate({ saturation: 1.25, brightness: 0.92 })
		.png()
		.toBuffer();
	const wash = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#0a1633" stop-opacity=".9"/><stop offset=".52" stop-color="#0a1633" stop-opacity=".55"/><stop offset="1" stop-color="#0a1633" stop-opacity=".12"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);

	// The logo, inverted for the dark wash (white tile, dark bars, white wordmark).
	const logo = await sharp(
		Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122 32" width="${122 * 1.5}" height="${32 * 1.5}"><g transform="rotate(-6 16 16)"><rect x="2" y="2" width="28" height="28" rx="8" fill="#fff"/><rect x="9" y="15" width="5" height="10" rx="1.5" fill="#151515"/><rect x="15" y="11" width="5" height="14" rx="1.5" fill="#151515"/><rect x="21" y="7" width="5" height="18" rx="1.5" fill="#151515"/></g><text x="40" y="22" fill="#fff" font-family="${FONT}, Arial, sans-serif" font-size="18" font-weight="600">mnemee</text></svg>`),
		{ density: 216 },
	).png().toBuffer();

	const headline1 = await text('Keep the reference.', 62, 1, 'letter_spacing="-1500"');
	const headline2 = await text('Find the direction.', 62, 0.62, 'letter_spacing="-1500"');
	const sub = await text('A visual workspace for your references.', 28, 0.82);
	const url = await text('mnemee.space', 24, 0.66);

	// A few of the product's own cards, fanned off the right-hand side.
	const clay = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="340"><rect width="280" height="340" fill="#141414"/><rect width="280" height="280" fill="#c8643b"/><text x="16" y="313" fill="#f5f5f5" font-family="${FONT}, Arial, sans-serif" font-size="20" font-weight="600">Clay</text><text x="264" y="313" text-anchor="end" fill="#9a9a9a" font-family="Consolas, monospace" font-size="15">#C8643B</text></svg>`)).png().toBuffer();
	const layers = [
		...(await card(await sharp(asset('curved-architecture.jpg')).toBuffer(), 260, 328, -5, 780, 255)),
		...(await card(await sharp(asset('blue-minimal-wall.jpg')).toBuffer(), 260, 328, 4, 985, 415)),
		...(await card(clay, 214, 260, -3, 1055, 150)),
	];

	const left = 72;
	const output = `${root}public/og-image.png`;
	await sharp(backdrop)
		.composite([
			{ input: wash },
			...layers,
			{ input: logo, left, top: 70 },
			{ input: headline1, left, top: 242 },
			{ input: headline2, left, top: 242 + 80 },
			{ input: sub, left, top: 242 + 80 + 96 },
			{ input: url, left, top: H - 72 },
		])
		.png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
		.toFile(output);
	console.log(`wrote ${output}`);
}

await main();
