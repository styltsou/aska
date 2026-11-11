/*
 * The grain aura behind each bento mock-up: its colour follows the demo, and it grows in and drifts with scroll.
 */
export const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

const auras = Array.from(document.querySelectorAll<HTMLElement>('.feature__aura'));

const smooth = (a: number, b: number, x: number) => {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** The aura belonging to the panel `from` sits in. */
export const auraOf = (from: Element) => from.closest('.feature')?.querySelector<HTMLElement>('.feature__aura') ?? null;

export const setAura = (from: Element, color: string) => {
	auraOf(from)?.style.setProperty('--aura-c', color);
};

/** The aura grows in as its panel rises into view and drifts slower than the mock-up, so it trails behind it. */
export function updateAuras() {
	const height = window.innerHeight;
	const rects = auras.map((aura) => aura.parentElement!.getBoundingClientRect());
	auras.forEach((aura, i) => {
		if (motionPreference.matches) {
			['--aura-x', '--aura-y', '--aura-s', '--aura-o'].forEach((name) => aura.style.removeProperty(name));
			return;
		}
		const rect = rects[i];
		const p = Math.max(0, Math.min(1, (height - rect.top) / (height + rect.height)));
		const lead = .5 - p;
		aura.style.setProperty('--aura-s', (.78 + .3 * smooth(0, .5, p)).toFixed(3));
		aura.style.setProperty('--aura-x', (lead * -55).toFixed(1));
		aura.style.setProperty('--aura-y', (lead * 120).toFixed(1));
		aura.style.setProperty('--aura-o', (smooth(0, .22, p) * (1 - .6 * smooth(.8, 1, p))).toFixed(3));
	});
}

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
