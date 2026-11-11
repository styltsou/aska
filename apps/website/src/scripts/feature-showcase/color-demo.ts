/*
 * Colour: the cursor picks green, blue, then red; the count, the grid and the aura follow each pick.
 */
import { cursorMover, startDemo } from '../demo-kit';
import { setAura } from './aura';

export function initColorDemo() {
	const color = document.querySelector<HTMLElement>('[data-demo="color"]');
	const colorMock = color?.querySelector<HTMLElement>('[data-mock]');
	const colorCursor = color?.querySelector<SVGElement>('[data-cursor]');
	const count = color?.querySelector<HTMLElement>('[data-count]');
	const grids = Array.from(color?.querySelectorAll<HTMLElement>('[data-results-for]') ?? []);
	if (!(color && colorMock && colorCursor && count && grids.length)) return;

	const cursor = cursorMover(colorMock, colorCursor);
	const swatch = (hex: string) => color.querySelector<HTMLElement>(`[data-swatch="${hex}"]`);
	const pick = (hex: string) => {
		color.querySelectorAll('[data-swatch]').forEach((el) => el.classList.toggle('is-active', el.getAttribute('data-swatch') === hex));
		const grid = grids.find((g) => g.dataset.resultsFor === hex);
		grids.forEach((g) => g.classList.toggle('is-shown', g === grid));
		count.textContent = grid?.dataset.countFor ?? '0';
		setAura(color, hex);
	};
	startDemo(color, async (wait) => {
		cursor.show(false);
		await wait(200);
		cursor.park();
		await wait(100);
		cursor.show(true);
		await wait(500);
		for (const grid of grids.slice(1).concat(grids[0])) {
			const target = swatch(grid.dataset.resultsFor ?? '');
			if (!target) continue;
			await cursor.moveTo(target, wait, 300);
			await wait(150);
			await cursor.click(wait);
			pick(grid.dataset.resultsFor ?? '');
			await wait(1800);
		}
		await cursor.moveTo({ x: colorMock.offsetWidth + 40, y: colorMock.offsetHeight * .6 }, wait, 285);
		await wait(600);
	});
}
