/*
 * Search: type the query, results come in, the selection steps down with the arrow key, then Enter.
 * The aura follows the selected result's artwork.
 */
import { press, startDemo, type } from '../demo-kit';
import { auraOf, dominantColor, setAura } from './aura';

// A colour that would vanish against the page (near-black on the dark theme, near-white on the light one) is swapped for a
// light or mid grey, and the note, which has no artwork, is grey.
const isDark = () => document.documentElement.dataset.theme === 'dark';
const visibleOnTheme = (rgb: string | null) => {
	const grey = isDark() ? '#d2d2d2' : '#6a6a6a';
	const parts = rgb?.match(/\d+/g)?.map(Number);
	if (!parts || parts.length < 3) return grey;
	const [r, g, b] = parts;
	const lum = (.2126 * r + .7152 * g + .0722 * b) / 255;
	if (isDark()) {
		if (lum < .22) return grey;
		// Dim colours are lifted toward white so the grain still reads.
		const lift = Math.max(0, .5 - lum) * .9;
		return `rgb(${[r, g, b].map((c) => Math.round(c + (255 - c) * lift)).join(' ')})`;
	}
	return lum > .78 ? grey : rgb!;
};

let tintToken = 0;
let tinted: HTMLElement | undefined;
async function tintSearch(result: HTMLElement | undefined) {
	const token = ++tintToken;
	tinted = result;
	const root = document.querySelector('[data-demo="search"]');
	if (!root) return;
	const img = result?.querySelector('img');
	const colour = visibleOnTheme(img ? await dominantColor(img) : null);
	if (token !== tintToken) return;
	setAura(root, colour);
	// While the query is still being typed there is no result yet, so the wash stays barely there.
	auraOf(root)?.classList.toggle('is-quiet', !result);
}

/** Tints the aura from the first result even when the loop doesn't play (reduced motion), and keeps it right across theme changes. */
export function initSearchTint() {
	void tintSearch(document.querySelector<HTMLElement>('[data-demo="search"] [data-result]') ?? undefined);
	new MutationObserver(() => void tintSearch(tinted)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

export function initSearchDemo() {
	const search = document.querySelector<HTMLElement>('[data-demo="search"]');
	const query = search?.querySelector<HTMLElement>('[data-query]');
	const placeholder = search?.querySelector<HTMLElement>('[data-placeholder]');
	const resultsList = search?.querySelector<HTMLElement>('[data-results]');
	const results = Array.from(search?.querySelectorAll<HTMLElement>('[data-result]') ?? []);
	const keyDown = search?.querySelector<HTMLElement>('[data-key-down]');
	const keyEnter = search?.querySelector<HTMLElement>('[data-key-enter]');
	if (!(search && query && placeholder && resultsList && results.length && keyDown && keyEnter)) return;

	const QUERY = query.textContent ?? '';
	const select = (index: number) => {
		results.forEach((el, i) => el.classList.toggle('palette__item--selected', i === index));
		void tintSearch(results[index]);
	};
	startDemo(search, async (wait) => {
		query.textContent = '';
		placeholder.hidden = false;
		resultsList.classList.add('is-empty');
		select(-1);
		await wait(700);
		placeholder.hidden = true;
		await type(query, QUERY, wait, 30);
		await wait(250);
		resultsList.classList.remove('is-empty');
		select(0);
		await wait(1100);
		for (const index of [1, 2]) {
			await press(keyDown, wait);
			select(index);
			await wait(900);
		}
		await press(keyEnter, wait);
		await wait(1600);
	});
}
