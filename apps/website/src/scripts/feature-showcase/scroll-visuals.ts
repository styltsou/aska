/*
 * Each mock-up slides in as its panel rises into view (and its aura grows with it). Reduced motion leaves everything put.
 */
import { motionPreference, updateAuras } from './aura';

const scrollVisuals = Array.from(document.querySelectorAll<HTMLElement>('.feature-visual'));
const visualOffsets = new WeakMap<HTMLElement, number>();
let scrollFrame = 0;

const updateScrollVisuals = () => {
	scrollFrame = 0;
	const height = window.innerHeight;
	// Read positions together, excluding the last vertical translation, before writing new transforms.
	const offsets = scrollVisuals.map((visual) => {
		const top = visual.getBoundingClientRect().top - (visualOffsets.get(visual) ?? 0);
		const progress = Math.max(0, Math.min(1, (height - top) / (height * .6)));
		const remaining = 1 - progress * progress * (3 - 2 * progress);
		return motionPreference.matches ? 0 : remaining;
	});
	updateAuras();
	scrollVisuals.forEach((visual, index) => {
		const remaining = offsets[index];
		visualOffsets.set(visual, remaining * 48);
		if (motionPreference.matches) visual.style.removeProperty('translate');
		else visual.style.translate = `${remaining * 32}px ${remaining * 48}px`;
	});
};
const scheduleScrollVisuals = () => {
	if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollVisuals);
};

export function initScrollVisuals() {
	window.addEventListener('scroll', scheduleScrollVisuals, { passive: true });
	window.addEventListener('resize', scheduleScrollVisuals);
	motionPreference.addEventListener('change', scheduleScrollVisuals);
	updateScrollVisuals();
	document.addEventListener('astro:before-swap', () => {
		window.removeEventListener('scroll', scheduleScrollVisuals);
		window.removeEventListener('resize', scheduleScrollVisuals);
		motionPreference.removeEventListener('change', scheduleScrollVisuals);
		cancelAnimationFrame(scrollFrame);
	}, { once: true });
}
