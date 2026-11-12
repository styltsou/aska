/*
 * Fits the fixed 1280 × 800 app into whatever width the mock-up has, and plays the demo from the scroll position the
 * hero sends (0 → 1 across its hold). Every frame is a pure function of that progress, so scrolling back rewinds it.
 * A grabbing cursor follows the first card; the later items appear and are edited in place.
 *   1. The loose orange card slides into the empty top-right slot.
 *   2. A new colour card appears in the freed space.
 *   3. A text label is typed onto the canvas.
 *   4. A new note appears and gets written into.
 */
const APP_W = 1280;
const LABEL = 'Spring direction';
const NOTE_TITLE = 'Direction';
const NOTE_BODY = 'Sage for headlines, clay for the accents.';

type Point = { x: number; y: number };
const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
const span = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const between = (p: number, from: number, to: number) => p >= from && p < to;
const typed = (text: string, p: number, from: number, to: number) => text.slice(0, Math.round(text.length * span(p, from, to)));

for (const root of document.querySelectorAll<HTMLElement>('.hero-workspace')) {
	const q = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
	const app = q('.app');
	const drag = q('[data-demo-drag]');
	const grab = q<SVGElement>('[data-demo-grab]');
	const added = q('[data-demo-new]');
	const text = q('[data-demo-text]');
	const textContent = q('[data-demo-text-content]');
	const note = q('[data-demo-note]');
	const noteTitle = q('[data-demo-note-title]');
	const noteBody = q('[data-demo-note-body]');
	const caretTitle = q('[data-demo-caret-title]');
	const caretBody = q('[data-demo-caret-body]');
	if (!app || !drag || !grab || !added || !text || !textContent || !note || !noteTitle || !noteBody || !caretTitle || !caretBody) continue;

	const scaleApp = () => {
		app.style.setProperty('--app-scale', String(root.clientWidth / APP_W));
		root.dataset.scaled = '';
	};
	scaleApp();
	new ResizeObserver(scaleApp).observe(root);
	root.addEventListener('demo:resize', scaleApp);

	// Canvas units → app px (the canvas sits at 80% zoom, offset inside the board, which sits right of the sidebar).
	const toApp = (p: Point): Point => ({ x: 240 - 12 + p.x * .8, y: 56 + 4 + p.y * .8 });

	const dragFrom = { x: 1010, y: 474 };
	const dragTo = { x: 976, y: 48 };
	// Where the camera looks at each stage (canvas units: the centre of whatever is happening).
	const cardHalf = { x: 140, y: 175 };
	const overview = { x: 560, y: 360 };
	const colourAt = { x: 1116, y: 590 };
	const labelAt = { x: 470, y: 718 };
	const noteAt = { x: 812, y: 650 };

	const render = (p: number) => {
		// 1. Drag
		const move = ease(span(p, .04, .22));
		const card = mix(dragFrom, dragTo, move);
		drag.style.transform = `translate3d(${(card.x - dragFrom.x).toFixed(2)}px, ${(card.y - dragFrom.y).toFixed(2)}px, 0)`;
		drag.toggleAttribute('data-lifted', between(p, .025, .24));
		drag.toggleAttribute('data-selected', between(p, .025, .4));
		grab.style.opacity = String(ease(span(p, .01, .025)) * (1 - ease(span(p, .22, .25))));

		// 2. Colour
		const appear = ease(span(p, .4, .47));
		added.style.opacity = p >= .4 ? appear.toFixed(3) : '0';
		added.style.transform = `scale(${lerp(.96, 1, appear).toFixed(4)})`;
		added.toggleAttribute('data-selected', between(p, .41, .54));

		// 3. Text
		text.style.opacity = p >= .56 ? '1' : '0';
		textContent.textContent = typed(LABEL, p, .57, .68);
		text.toggleAttribute('data-editing', between(p, .56, .74));

		// 4. Note
		const noteIn = ease(span(p, .76, .81));
		note.style.opacity = p >= .76 ? noteIn.toFixed(3) : '0';
		note.style.transform = `scale(${lerp(.96, 1, noteIn).toFixed(4)})`;
		note.toggleAttribute('data-selected', p >= .77);
		noteTitle.textContent = typed(NOTE_TITLE, p, .82, .86);
		noteBody.textContent = typed(NOTE_BODY, p, .87, .96);
		caretTitle.toggleAttribute('data-on', between(p, .77, .87));
		caretBody.toggleAttribute('data-on', p >= .87);

		// Where the camera should look: the whole canvas, easing onto the dragged card, following it, then each new item in
		// turn. The hero uses this to pan a mock-up that's larger than its panel (phones).
		const cardCentre = { x: card.x + cardHalf.x, y: card.y + cardHalf.y };
		let at: Point;
		if (p < .04) at = mix(overview, { x: dragFrom.x + cardHalf.x, y: dragFrom.y + cardHalf.y }, ease(span(p, 0, .04)));
		else if (p < .34) at = cardCentre;
		else if (p < .5) at = mix(cardCentre, colourAt, ease(span(p, .32, .44)));
		else if (p < .6) at = mix(colourAt, labelAt, ease(span(p, .5, .58)));
		else if (p < .78) at = mix(labelAt, noteAt, ease(span(p, .68, .76)));
		else at = noteAt;
		root.dispatchEvent(new CustomEvent('demo:focus', { detail: toApp(at) }));
	};

	render(0);
	root.addEventListener('demo:progress', (event) => render((event as CustomEvent<number>).detail));
}

export {};
