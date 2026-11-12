const section = document.querySelector<HTMLElement>('[data-scroll-stories]');
const viewport = section?.querySelector<HTMLElement>('[data-stories-viewport]');
const track = section?.querySelector<HTMLElement>('[data-stories-track]');
const progress = section?.querySelector<HTMLElement>('[data-stories-progress]');
const compactTouch = window.matchMedia('(max-width: 760px) and (any-pointer: coarse)');
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
	let gesture: { pointerId: number; x: number; y: number; scrollY: number; active: boolean } | undefined;

	const render = () => {
		frame = 0;
		if (section.dataset.pinned !== 'true') {
			// Unpinned layouts scroll horizontally, so the bar follows the viewport's own scroll position.
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
		// Narrow touch screens stay swipeable. Other layouts pin only when the whole stage fits.
		const enabled = !reducedMotion.matches && !compactTouch.matches
			&& !!sticky && sticky.offsetHeight <= window.innerHeight;
		section.dataset.pinned = enabled ? 'true' : '';
		if (enabled) viewport.scrollLeft = 0;
		viewport.setAttribute('aria-label', enabled
			? 'Use cases; scroll vertically to explore, or swipe on a touch screen'
			: 'Use cases; swipe or scroll horizontally to explore');
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
	viewport.addEventListener('pointerdown', (event) => {
		if (section.dataset.pinned !== 'true' || event.pointerType !== 'touch' || !event.isPrimary) return;
		if ((event.target as Element).closest('a, button')) return;
		const pinStart = section.getBoundingClientRect().top + window.scrollY - pinTop;
		if (window.scrollY < pinStart - 1 || window.scrollY > pinStart + distance + 1) return;
		gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, scrollY: window.scrollY, active: false };
	});
	viewport.addEventListener('pointermove', (event) => {
		if (!gesture || event.pointerId !== gesture.pointerId) return;
		const dx = event.clientX - gesture.x;
		if (!gesture.active) {
			if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(event.clientY - gesture.y)) return;
			gesture.active = true;
			viewport.setPointerCapture(event.pointerId);
		}
		const pinStart = section.getBoundingClientRect().top + window.scrollY - pinTop;
		window.scrollTo(0, Math.min(pinStart + distance, Math.max(pinStart, gesture.scrollY - dx)));
	});
	const endGesture = (event: PointerEvent) => {
		if (gesture?.pointerId === event.pointerId) gesture = undefined;
	};
	viewport.addEventListener('pointerup', endGesture);
	viewport.addEventListener('pointercancel', endGesture);

	new ResizeObserver(measure).observe(viewport);
	window.addEventListener('resize', measure, { passive: true });
	window.addEventListener('scroll', requestRender, { passive: true });
	viewport.addEventListener('scroll', requestRender, { passive: true });
	compactTouch.addEventListener('change', measure);
	reducedMotion.addEventListener('change', measure);
	measure();
}

export {};
