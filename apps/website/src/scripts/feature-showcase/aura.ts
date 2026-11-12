/*
 * The grain aura behind each bento mock-up follows the demo's colour.
 */
export const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

/** The aura belonging to the panel `from` sits in. */
export const auraOf = (from: Element) => from.closest('.feature')?.querySelector<HTMLElement>('.feature__aura') ?? null;

export const setAura = (from: Element, color: string) => {
	auraOf(from)?.style.setProperty('--aura-c', color);
};

// Reads an image's dominant colour (weighted toward the saturated pixels, so a grey wall doesn't win over a red door).
const swatchCache = new WeakMap<HTMLImageElement, string>();
export async function dominantColor(img: HTMLImageElement) {
	const cached = swatchCache.get(img);
	if (cached) return cached;
	try {
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 24;
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		ctx.drawImage(img, 0, 0, 24, 24);
		const { data } = ctx.getImageData(0, 0, 24, 24);
		let r = 0, g = 0, b = 0, total = 0;
		for (let i = 0; i < data.length; i += 4) {
			const max = Math.max(data[i], data[i + 1], data[i + 2]);
			const weight = .1 + (max - Math.min(data[i], data[i + 1], data[i + 2])) / 255;
			r += data[i] * weight; g += data[i + 1] * weight; b += data[i + 2] * weight; total += weight;
		}
		const colour = `rgb(${Math.round(r / total)} ${Math.round(g / total)} ${Math.round(b / total)})`;
		swatchCache.set(img, colour);
		return colour;
	} catch {
		return null;
	}
}
