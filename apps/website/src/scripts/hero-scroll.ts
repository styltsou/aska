/*
 * Scroll-pinned hero (see the CSS; phones get their own choreography, described at the end). The stage stays pinned while the page scrolls through the hero's
 * extra height:
 *   1. Expand: the image panel grows from the right half to cover the whole hero, its top settling under the navbar,
 *      sliding over the copy, while the mock-up glides from its cropped spot to the centre at full size.
 *   2. Hold: everything rests with the mock-up centred (room for the interactive demo later).
 *   3. Release: the pin ends and the hero scrolls off like any other section.
 * The panel keeps its final box the whole time and is revealed with clip-path, so nothing reflows while scrolling.
 * `data-state` on the hero tells the navbar when to leave its over-the-image layout.
 *
 * Phones ("compact"): the navbar stays a normal bar above the hero. The copy sits on top and the image card below it; on
 * scroll the copy lifts away while the card grows upward to fill the screen and the mock-up scales from a cropped peek to
 * fitting the width. Then the hold plays the same demo, and the pin releases.
 */
const hero = document.querySelector<HTMLElement>('.hero');
const media = hero?.querySelector<HTMLElement>('.hero__media');
const win = hero?.querySelector<HTMLElement>('.hero__window');
const backdrop = hero?.querySelector<HTMLElement>('.hero__backdrop');
const copy = hero?.querySelector<HTMLElement>('.hero__copy');
const header = document.querySelector<HTMLElement>('.site-header');
const wide = window.matchMedia('(min-width: 1024px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)');
const compact = window.matchMedia('(max-width: 1023px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)');
const NAV = 52; // the navbar's height: on phones the pinned stage sticks right below it

// How far the panel's top edge drops: from 16px (under the transparent navbar) to the navbar's bottom edge at 52px,
// so the band above the panel is exactly the bar and its content sits centred in it.
const DROP = 52 - 16;
const RADIUS = 12;
const EXPAND_SHARE = .24; // share of the pinned scroll spent expanding; the rest is the hold, where the demo plays
const RATIO = .625; // the mock-up is 16:10

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
// Sine curves keep the motion even: no sudden rush in the middle of the scroll.
const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

if (hero && media && win && backdrop) {
	let geo: { compact: boolean; stuck: number; startTop: number; boxH: number; boxW: number; startX: number; startY: number; startW: number; endX: number; endY: number; endW: number; expand: number; travel: number } | null = null;
	let lastDemo = -1;
	const workspace = win.querySelector<HTMLElement>('.hero-workspace');
	let frame = 0;

	// The navbar may already have synced this frame, so tell it when the state flips.
	const setState = (state?: 'split' | 'open') => {
		if (hero.dataset.state === state) return;
		if (state) hero.dataset.state = state;
		else delete hero.dataset.state;
		window.dispatchEvent(new Event('hero:state'));
	};

	const reset = () => {
		geo = null;
		setState();
		for (const el of [media, win, backdrop, copy]) el?.removeAttribute('style');
		lastDemo = -1;
		workspace?.dispatchEvent(new CustomEvent('demo:progress', { detail: 0 }));
		if (header) {
			delete header.dataset.morph;
			header.style.removeProperty('--hero-drop');
			header.style.removeProperty('--hero-w');
		}
	};

	const measure = () => {
		const boxW = media.clientWidth;
		const boxH = media.clientHeight;
		const isCompact = compact.matches;
		// Phones: the card starts just under the copy (the copy's offsets are relative to the stage, the panel's to its inset).
		const startTop = isCompact && copy ? Math.max(copy.offsetTop + copy.offsetHeight + 28 - media.offsetTop, boxH * .3) : 0;
		// Start: the same spot the CSS gives the mock-up (9% into the visible right half, overflowing to the right).
		// Phones zoom in to a cropped, panned view of the app; wider tablets show it nearly whole, so the zoom eases off with width.
		const zoom = lerp(2.3, .94, clamp((boxW - 360) / 300));
		const endW = isCompact ? boxW * zoom : Math.min(boxW - 144, (boxH - DROP - 88) / RATIO, 1280);
		const startW = isCompact ? endW * .674 : Math.max(boxW * .64, 780);
		// End: as large as fits under the navbar with some air around it (phones: the full width less a margin).
		const stageH = hero.querySelector<HTMLElement>('.hero__stage')?.offsetHeight ?? window.innerHeight;
		geo = {
			compact: isCompact,
			stuck: isCompact ? NAV : 0,
			startTop,
			boxH,
			boxW,
			startX: isCompact ? lerp(boxW * .05, (boxW - startW) / 2, clamp((boxW - 360) / 300)) : boxW * .545,
			startY: isCompact ? startTop + 22 : Math.max(96, boxH * .14),
			startW,
			endX: (boxW - endW) / 2,
			endY: isCompact ? (boxH - endW * RATIO) / 2 : DROP + (boxH - DROP - endW * RATIO) / 2,
			endW,
			expand: (hero.offsetHeight - stageH) * (isCompact ? .21 : EXPAND_SHARE),
			travel: hero.offsetHeight - stageH,
		};
		// The mock-up is laid out at its final size and scaled down at the start, so it rests sharp at the end.
		win.style.left = '0px';
		win.style.top = '0px';
		win.style.width = `${endW}px`;
	};

	// Phones: the mock-up is wider than the panel, so its resting spot pans to keep the demo's focus point centred.
	let focus = { x: 640, y: 400 }; // in app px (the app is 1280 × 800), reported by the demo
	let lastT = 0;
	const clampTo = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
	const place = () => {
		if (!geo) return;
		let endX = geo.endX;
		let endY = geo.endY;
		if (geo.compact) {
			const k = geo.endW / 1280;
			const margin = 12;
			endX = clampTo(geo.boxW / 2 - focus.x * k, geo.boxW - geo.endW - margin, margin);
			endY = clampTo(geo.boxH / 2 - focus.y * k, geo.boxH - geo.endW * RATIO - margin, margin);
			// Wider tablets show the app nearly whole, so the pan toward the demo's focus gives way to centring it in the image.
			const centred = clamp((geo.boxW - 360) / 300);
			endX = lerp(endX, geo.endX, centred);
			endY = lerp(endY, geo.endY, centred);
		}
		const scale = lerp(geo.startW / geo.endW, 1, lastT);
		win.style.transform = `translate3d(${lerp(geo.startX, endX, lastT).toFixed(2)}px, ${lerp(geo.startY, endY, lastT).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
	};
	workspace?.addEventListener('demo:focus', (event) => {
		focus = (event as CustomEvent<{ x: number; y: number }>).detail;
		if (geo?.compact) place();
	});

	const render = () => {
		frame = 0;
		if (!wide.matches && !compact.matches) {
			if (geo) reset();
			return;
		}
		if (!geo) measure();
		if (!geo) return;

		const scrolled = geo.stuck - hero.getBoundingClientRect().top;
		const progress = clamp(scrolled / geo.expand);
		const t = easeInOut(progress);
		// The top edge drops below the navbar early, before the panel reaches the logo and links.
		const top = geo.compact ? lerp(geo.startTop, 0, t) : easeOut(clamp(progress / .3)) * DROP;
		const left = geo.compact ? 0 : (geo.boxW / 2) * (1 - t);
		media.style.clipPath = `inset(${top.toFixed(2)}px 0 0 ${left.toFixed(2)}px round ${RADIUS}px)`;
		media.style.setProperty('--border-top', `${top.toFixed(2)}px`);
		media.style.setProperty('--border-left', `${left.toFixed(2)}px`);

		lastT = t;
		place();
		backdrop.style.transform = `scale(${lerp(1.1, 1.03, t).toFixed(4)})`;
		// The copy gently recedes toward the growing panel, with blur arriving as it fades.
		if (copy) {
			const fade = easeInOut(clamp(progress / (geo.compact ? .6 : .9)));
			const blur = 3 * easeInOut(clamp((fade - .2) / .8));
			const x = geo.compact ? 0 : 12 * fade;
			const y = geo.compact ? 12 * fade : 0;
			copy.style.opacity = (1 - fade).toFixed(3);
			copy.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(1 - .03 * fade).toFixed(4)})`;
			copy.style.filter = `blur(${blur.toFixed(2)}px)`;
		}

		// The navbar morphs with the scroll too (full width and dropped → page width and centred), not on a timer.
		if (header && !geo.compact) {
			header.dataset.morph = '';
			header.style.setProperty('--hero-drop', (1 - easeInOut(clamp(progress / .3))).toFixed(4));
			// It contracts to the page width only once the pin has ended and the hero is scrolling away, so it stays aligned
			// with the full-width image all through the hero and lines up with the next section by the time that arrives.
			const leaving = clamp((scrolled - geo.travel) / window.innerHeight);
			header.style.setProperty('--hero-w', easeInOut(clamp((leaving - .1) / .55)).toFixed(4));
		}

		// The mock-up's demo plays across the hold, with a little rest at each end.
		const hold = clamp((scrolled - geo.expand) / (geo.travel - geo.expand));
		const demo = clamp((hold - .01) / .92);
		if (demo !== lastDemo) {
			lastDemo = demo;
			workspace?.dispatchEvent(new CustomEvent('demo:progress', { detail: demo }));
		}

		if (!geo.compact) setState(progress < .3 ? 'split' : 'open');
	};

	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(render);
	};
	const remeasure = () => {
		geo = null;
		schedule();
	};

	render();
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', remeasure);
	wide.addEventListener('change', remeasure);
	compact.addEventListener('change', remeasure);
	document.addEventListener('astro:before-swap', () => {
		window.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', remeasure);
		wide.removeEventListener('change', remeasure);
		compact.removeEventListener('change', remeasure);
	}, { once: true });
}

export {};
