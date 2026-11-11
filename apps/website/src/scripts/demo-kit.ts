/*
 * Small building blocks the scripted demo loops share: on-screen time, a demo cursor, and typing.
 */
export type Wait = (ms: number) => Promise<void>;
export type Point = { x: number; y: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Runs `run` in a loop. Time only passes while `root` is on screen and the tab is shown, so the loops pause off screen.
 */
export function startDemo(root: HTMLElement, run: (wait: Wait) => Promise<void>) {
	let visible = false;
	new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: .35 }).observe(root);
	// Waits `ms` of on-screen time.
	const wait: Wait = async (ms) => {
		let left = ms;
		while (left > 0) {
			const step = Math.min(left, 20);
			await sleep(step);
			if (visible && !document.hidden) left -= step;
		}
	};
	void (async () => {
		for (;;) await run(wait);
	})();
}

/** Moves a demo cursor (inside a scaled mock) to an element's centre, in the mock's own coordinates. */
export function cursorMover(mock: HTMLElement, cursor: SVGElement) {
	let at: Point = { x: mock.offsetWidth + 40, y: mock.offsetHeight * .7 };
	const centreOf = (el: Element): Point => {
		const m = mock.getBoundingClientRect();
		const r = el.getBoundingClientRect();
		const k = m.width / mock.offsetWidth || 1;
		return { x: (r.left + r.width / 2 - m.left) / k, y: (r.top + r.height / 2 - m.top) / k };
	};
	const place = (p: Point, pressed = false) => {
		cursor.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${pressed ? .86 : 1})`;
	};
	place(at);
	return {
		async moveTo(target: Element | Point, wait: Wait, duration = 340) {
			const to = target instanceof Element ? centreOf(target) : target;
			const from = at;
			const steps = Math.max(1, Math.round(duration / 20));
			for (let i = 1; i <= steps; i++) {
				await wait(duration / steps);
				const t = easeInOut(i / steps);
				place({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
			}
			at = to;
		},
		async click(wait: Wait) {
			place(at, true);
			await wait(120);
			place(at);
		},
		show(on: boolean) { cursor.style.opacity = on ? '1' : '0'; },
		park() { at = { x: mock.offsetWidth + 40, y: mock.offsetHeight * .7 }; place(at); },
	};
}

export async function type(el: HTMLElement, text: string, wait: Wait, perChar = 30) {
	for (let i = 1; i <= text.length; i++) {
		el.textContent = text.slice(0, i);
		await wait(perChar);
	}
}

/** Briefly marks a key or button as pressed. */
export async function press(key: HTMLElement, wait: Wait, ms = 140) {
	key.classList.add('is-pressed');
	await wait(ms);
	key.classList.remove('is-pressed');
}
