const scene = document.querySelector<HTMLElement>('.browser-extension-scene');
const stage = scene?.querySelector<HTMLElement>('.browser-extension-stage');
const panel = scene?.querySelector<HTMLElement>('.browser-extension');
const cursor = scene?.querySelector<SVGElement>('.extension-preview__cursor');
const preview = scene?.querySelector<HTMLElement>('.extension-preview');
const windowMock = scene?.querySelector<HTMLElement>('.browser-window');
const visual = scene?.querySelector<HTMLElement>('.browser-extension__visual');
const extensionButton = scene?.querySelector<HTMLElement>('.browser-window__mark');
const saveButton = scene?.querySelector<HTMLElement>('.extension-preview__save');
const saveDefault = scene?.querySelector<HTMLElement>('.extension-preview__save-default');
const saveDone = scene?.querySelector<HTMLElement>('.extension-preview__save-done');
const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
if (scene && stage && panel && cursor && preview && windowMock && extensionButton && saveButton && saveDefault && saveDone) {
	let initialHeight = 0;
	let frame = 0;
	let savedTimer: ReturnType<typeof setTimeout> | null = null;
	let isSaved = false;
	const reset = () => {
		cancelAnimationFrame(frame);
		frame = 0;
		if (savedTimer !== null) clearTimeout(savedTimer);
		savedTimer = null;
		isSaved = false;
		delete scene.dataset.active;
		scene.style.removeProperty('--extension-inset');
		panel.style.removeProperty('height');
		windowMock.style.removeProperty('transform');
		visual?.style.removeProperty('height');
		for (const element of [cursor, preview, saveDefault, saveDone]) element.removeAttribute('style');
	};
	const configure = () => {
		reset();
		if (!motion.matches) return;
		initialHeight = panel.getBoundingClientRect().height;
		const available = window.innerHeight - 84;
		// Leave very short screens in their natural, scrollable layout.
		if (available < 420) return;
		// A panel a little taller than the screen (split-screen laptops, small tablets) gets a shorter browser preview so the
		// whole scene still fits and plays; only if even that cannot make it fit does it fall back to the static layout.
		if (initialHeight > available) {
			const visualHeight = visual?.getBoundingClientRect().height ?? 0;
			const shrunk = visualHeight - (initialHeight - available);
			if (!visual || shrunk < 230) return;
			visual.style.height = `${shrunk}px`;
			initialHeight = panel.getBoundingClientRect().height;
			if (initialHeight > available + 1) { visual.style.removeProperty('height'); return; }
		}
		scene.style.setProperty('--extension-inset', `${(available - initialHeight) / 2}px`);
		scene.dataset.active = '';
		render();
	};
	const render = () => {
		frame = 0;
		if (!scene.hasAttribute('data-active')) return;
		const travel = Math.max(1, scene.offsetHeight - stage.offsetHeight);
		const progress = clamp((68 - scene.getBoundingClientRect().top) / travel);
		const grow = smooth(progress / .30);
		const endHeight = window.innerHeight - 84;
		panel.style.height = `${initialHeight + (endHeight - initialHeight) * grow}px`;
		// The tall browser stays fixed in size; its lower article is revealed as it rises into the expanding frame.
		const travelUp = Math.min(window.innerWidth <= 820 ? 18 : 100, (endHeight - initialHeight) * .7);
		windowMock.style.transform = `translateY(${-travelUp * grow}px)`;
		const approachToolbar = smooth((progress - .30) / .13);
		const open = smooth((progress - .45) / .05);
		const approachSave = smooth((progress - .53) / .14);
		const appear = smooth((progress - .29) / .035);
		const leave = smooth((progress - .88) / .06);
		const press = smooth((progress - .69) / .02) * (1 - smooth((progress - .72) / .02));
		if (progress < .69) {
			if (savedTimer !== null) clearTimeout(savedTimer);
			savedTimer = null;
			isSaved = false;
		} else if (!isSaved && savedTimer === null) {
			// The click stays scroll-driven; its confirmation completes on its own.
			savedTimer = setTimeout(() => {
				savedTimer = null;
				isSaved = true;
				schedule();
			}, 180);
		}
		const close = smooth((progress - .88) / .08);
		const bounds = windowMock.getBoundingClientRect();
		const toolbar = extensionButton.getBoundingClientRect();
		const save = saveButton.getBoundingClientRect();
		const toolbarX = toolbar.left - bounds.left + toolbar.width / 2 - 4;
		const toolbarY = toolbar.top - bounds.top + toolbar.height / 2 - 3;
		const saveX = save.left - bounds.left + save.width * .7;
		const saveY = save.top - bounds.top + save.height / 2;
		const cursorX = toolbarX - 60 * (1 - approachToolbar) + (saveX - toolbarX) * approachSave;
		const cursorY = toolbarY + 90 * (1 - approachToolbar) + (saveY - toolbarY) * approachSave;
		cursor.style.opacity = String(appear * (1 - leave));
		cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) scale(${1 - press * .12})`;
		const visibility = open * (1 - close);
		preview.style.opacity = String(visibility);
		preview.style.transform = `translateY(${(1 - visibility) * -4}px) scale(${.98 + visibility * .02})`;
		saveDefault.style.opacity = isSaved ? '0' : '1';
		saveDone.style.opacity = isSaved ? '1' : '0';
	};
	const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
	configure();
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', configure);
	motion.addEventListener('change', configure);
	document.addEventListener('astro:before-swap', () => {
		window.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', configure);
		motion.removeEventListener('change', configure);
		cancelAnimationFrame(frame);
		reset();
	}, { once: true });
}

export {};
