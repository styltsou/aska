const section = document.querySelector<HTMLElement>('[data-scroll-stories]');
const viewport = section?.querySelector<HTMLElement>('[data-stories-viewport]');
const track = section?.querySelector<HTMLElement>('[data-stories-track]');
const progress = section?.querySelector<HTMLElement>('[data-stories-progress]');
const desktop = window.matchMedia('(min-width: 761px) and (min-height: 650px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mentionCard = section?.querySelector<HTMLElement>('.story-card__detail');
const mentionTrigger = mentionCard?.querySelector<HTMLButtonElement>('.story-card__mention');
const mentionClose = mentionCard?.querySelector<HTMLButtonElement>('.story-card__detail-close');
const noteView = mentionCard?.querySelector<HTMLElement>('[data-detail-view="note"]');
const mentionView = mentionCard?.querySelector<HTMLElement>('[data-detail-view="mention"]');
const sizeMentionCard = (expanded: boolean) => {
	const view = expanded ? mentionView : noteView;
	if (!mentionCard || !view) return;
	const style = getComputedStyle(mentionCard);
	const chrome = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
	mentionCard.style.height = `${view.getBoundingClientRect().height + chrome}px`;
};
const showMention = (expanded: boolean) => {
	sizeMentionCard(expanded);
	mentionTrigger?.setAttribute('aria-expanded', String(expanded));
	noteView?.setAttribute('aria-hidden', String(expanded));
	mentionView?.setAttribute('aria-hidden', String(!expanded));
	(expanded ? mentionClose : mentionTrigger)?.focus();
};
if (mentionCard && noteView && mentionView) {
	sizeMentionCard(false);
	mentionCard.dataset.ready = '';
	const noteResizeObserver = new ResizeObserver(() => sizeMentionCard(mentionTrigger?.getAttribute('aria-expanded') === 'true'));
	noteResizeObserver.observe(noteView);
	noteResizeObserver.observe(mentionView);
	document.addEventListener('astro:before-swap', () => noteResizeObserver.disconnect(), { once: true });
}
mentionTrigger?.addEventListener('click', () => showMention(true));
mentionClose?.addEventListener('click', () => showMention(false));

if (section && viewport && track && progress) {
	const sticky = section.querySelector<HTMLElement>('.principles__sticky');
	let distance = 0;
	let pinTop = 0; // where the pinned box sticks: centred in the viewport
	let frame = 0;

	const render = () => {
		frame = 0;
		if (section.dataset.pinned !== 'true') {
			// Phones and short screens: the cards scroll natively, so the bar follows the viewport's own scroll position.
			const max = viewport.scrollWidth - viewport.clientWidth;
			progress.style.transform = `scaleX(${max > 0 ? Math.min(Math.max(viewport.scrollLeft / max, 0), 1) : 0})`;
			return;
		}
		const scrolled = Math.min(distance, Math.max(0, pinTop - section.getBoundingClientRect().top));
		track.style.transform = `translate3d(${-scrolled}px, 0, 0)`;
		progress.style.transform = `scaleX(${distance ? scrolled / distance : 0})`;
	};
	const requestRender = () => {
		if (!frame) frame = requestAnimationFrame(render);
	};
	const measure = () => {
		const enabled = desktop.matches && !reducedMotion.matches;
		section.dataset.pinned = enabled ? 'true' : '';
		track.style.transform = '';
		progress.style.transform = '';
		section.style.height = '';
		section.style.removeProperty('--pin-top');
		if (!enabled || !sticky) { requestRender(); return; }
		distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
		const boxHeight = sticky.offsetHeight;
		pinTop = Math.max(0, (window.innerHeight - boxHeight) / 2);
		section.style.setProperty('--pin-top', `${pinTop}px`);
		section.style.height = `${boxHeight + distance}px`;
		requestRender();
	};

	new ResizeObserver(measure).observe(viewport);
	window.addEventListener('resize', measure, { passive: true });
	window.addEventListener('scroll', requestRender, { passive: true });
	viewport.addEventListener('scroll', requestRender, { passive: true });
	desktop.addEventListener('change', measure);
	reducedMotion.addEventListener('change', measure);
	measure();
}

export {};
