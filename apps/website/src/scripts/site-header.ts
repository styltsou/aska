/*
 * The header mirrors the page beneath it. Every frame it builds a hard-stop gradient from each section that overlaps
 * the bar, in that section's own colour, so a section boundary crossing the bar shows in the bar at exactly the same
 * height instead of the whole bar snapping. Where a fade wash lies under the bar (`data-fade`, which may reach past
 * its own element into the neighbouring sections), the bar repaints that stretch of the same ramp in 4px bands.
 */
const header = document.querySelector<HTMLElement>('.site-header');
const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-header-surface]'));
const fades = Array.from(document.querySelectorAll<HTMLElement>('[data-fade]'));
const hero = document.querySelector<HTMLElement>('.hero');
const heroMedia = document.querySelector<HTMLElement>('.hero__media');
const canvasFrame = document.querySelector<HTMLElement>('.canvas-surface');
const canvasTransition = document.querySelector<HTMLElement>('.hero-transition');
const desktop = window.matchMedia('(min-width: 1024px)');
const surfaceColor: Record<string, string> = {
	surface: 'var(--surface)',
	canvas: 'var(--canvas)',
	footer: 'var(--footer-surface)',
};
const colorFor = (section: HTMLElement) => surfaceColor[section.dataset.headerSurface ?? 'surface'] ?? 'var(--surface)';
// The same smootherstep ramp as the fades' CSS (index.astro): percentage of the end colour at 0, 5%, … 100%.
const RAMP = [0, .12, .86, 2.66, 5.79, 10.35, 16.31, 23.52, 31.74, 40.69, 50, 59.31, 68.26, 76.48, 83.69, 89.65, 94.21, 97.34, 99.14, 99.88, 100];
const rampAt = (t: number) => {
	const x = Math.min(Math.max(t, 0), 1) * 20;
	const i = Math.min(19, Math.floor(x));
	return RAMP[i] + (RAMP[i + 1] - RAMP[i]) * (x - i);
};
// A fade's painted extent: its ::before when it has one (the long washes), otherwise the element itself.
const fadeZone = (el: HTMLElement, barTop: number) => {
	const box = el.getBoundingClientRect();
	const before = getComputedStyle(el, '::before');
	const washed = before.content !== 'none' && before.position === 'absolute';
	const [from, to] = (el.dataset.fade ?? 'surface canvas').split(' ').map((name) => surfaceColor[name] ?? 'var(--canvas)');
	return {
		top: box.top + (washed ? parseFloat(before.top) || 0 : 0) - barTop,
		bottom: box.bottom - (washed ? parseFloat(before.bottom) || 0 : 0) - barTop,
		from,
		to,
	};
};

if (header && sections.length) {
	let frame = 0;
	const sync = () => {
		frame = 0;
		const bar = header.getBoundingClientRect();

		// On desktop, while the hero image is still under the header, only the left half is solid (see the CSS),
		// so the image passes behind the account buttons. The pinned hero reports this itself: the layout ends once
		// its panel has started expanding and dropped below the bar.
		const overHero = hero?.dataset.state
			? hero.dataset.state === 'split'
			: !!heroMedia && heroMedia.getBoundingClientRect().bottom > bar.top + 8;
		if (desktop.matches && overHero) {
			delete header.dataset.frame;
			header.dataset.surface = 'hero';
			header.style.removeProperty('background-image');
			return;
		}

		const height = bar.height;
		const frameBounds = canvasFrame?.getBoundingClientRect();
		const frameStart = canvasTransition?.getBoundingClientRect().top ?? frameBounds?.top;
		if (frameBounds && frameStart !== undefined && frameStart < bar.bottom && frameBounds.bottom > bar.top) header.dataset.frame = 'canvas';
		else delete header.dataset.frame;
		const zones = fades.map((el) => fadeZone(el, bar.top)).filter((zone) => zone.bottom > 0 && zone.top < height);
		const stops: string[] = [];
		const band = (color: string, start: number, end: number) => stops.push(`${color} ${start.toFixed(2)}px`, `${color} ${end.toFixed(2)}px`);
		// Paints [start, end) in a section's colour, except where a fade wash lies, which gets the ramp instead.
		const paint = (color: string, start: number, end: number) => {
			let y = start;
			while (y < end) {
				const zone = zones.find((z) => y >= z.top && y < z.bottom);
				if (!zone) {
					const next = Math.min(end, ...zones.map((z) => z.top).filter((top) => top > y));
					band(color, y, next);
					y = next;
					continue;
				}
				const next = Math.min(end, zone.bottom, y + 4);
				const t = ((y + next) / 2 - zone.top) / (zone.bottom - zone.top);
				band(`color-mix(in oklab, ${zone.to} ${rampAt(t).toFixed(1)}%, ${zone.from})`, y, next);
				y = next;
			}
		};

		// Sections are in page order; any gap between them is plain page canvas. Before the first section, on narrow
		// screens, the bar is over the hero (or nothing at the very top), which sits on the page surface.
		const lead = desktop.matches ? 'var(--canvas)' : 'var(--surface)';
		let cursor = 0;
		for (const section of sections) {
			const bounds = section.getBoundingClientRect();
			const start = Math.max(bounds.top - bar.top, 0);
			const end = Math.min(bounds.bottom - bar.top, height);
			if (end <= start || end <= cursor) continue;
			if (start > cursor) paint(cursor === 0 ? lead : 'var(--canvas)', cursor, start);
			paint(colorFor(section), Math.max(start, cursor), end);
			cursor = end;
		}
		if (cursor < height) paint(cursor === 0 ? lead : 'var(--canvas)', cursor, height);
		header.dataset.surface = 'mirror';
		header.style.backgroundImage = stops.length ? `linear-gradient(to bottom, ${stops.join(', ')})` : '';
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(sync);
	};
	sync();
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	window.addEventListener('hero:state', schedule);
	desktop.addEventListener('change', schedule);
	document.addEventListener('astro:before-swap', () => {
		window.removeEventListener('scroll', schedule);
		window.removeEventListener('hero:state', schedule);
		window.removeEventListener('resize', schedule);
		desktop.removeEventListener('change', schedule);
	}, { once: true });
}

export {};
