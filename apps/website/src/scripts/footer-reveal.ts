/* The footer sits fixed behind the page and is revealed as the page ends: its content eases in, and the page leaves room for it. */
const root = document.documentElement;
const footer = document.querySelector<HTMLElement>('.site-footer');
const main = document.querySelector<HTMLElement>('main');
const motionTargets = footer ? Array.from(footer.querySelectorAll<HTMLElement>('.site-footer__about, .site-footer__main > nav, .site-footer__elsewhere, .site-footer__bottom, .site-footer__word')) : [];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// On phones the footer is nearly a screen tall, so its content stays put: animating it would keep it blurred and dim
// until the very bottom of the page.
const compactFooter = window.matchMedia('(max-width: 780px)');
let revealFrame = 0;
const checkMotion = () => {
	revealFrame = 0;
	if (!main || !footer) return;
	const pageEdge = main.getBoundingClientRect().bottom;
	const footerRect = footer.getBoundingClientRect();
	const progress = Math.max(0, Math.min(1, (footerRect.bottom - pageEdge) / Math.max(footerRect.height, 1)));
	const remaining = 1 - progress;
	motionTargets.forEach((target) => {
		if (reducedMotion.matches || compactFooter.matches) {
			target.style.removeProperty('opacity');
			target.style.removeProperty('filter');
			target.style.removeProperty('transform');
			return;
		}
		target.style.opacity = String(1 - remaining * 0.5);
		target.style.filter = `blur(${remaining * 3}px)`;
		target.style.transform = `perspective(900px) translate3d(0, ${remaining * 12}px, ${remaining * -45}px)`;
	});
};
const scheduleMotion = () => {
	if (!revealFrame) revealFrame = requestAnimationFrame(checkMotion);
};
window.addEventListener('scroll', scheduleMotion, { passive: true });
window.addEventListener('resize', scheduleMotion);
reducedMotion.addEventListener('change', scheduleMotion);
compactFooter.addEventListener('change', scheduleMotion);
const syncFooterReveal = () => {
	if (footer) root.style.setProperty('--footer-reveal', `${footer.offsetHeight}px`);
	scheduleMotion();
};
if (footer) {
	new ResizeObserver(syncFooterReveal).observe(footer);
	syncFooterReveal();
}
document.querySelector<HTMLButtonElement>('[data-scroll-top]')?.addEventListener('click', () => {
	window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
	if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
});
export {};
