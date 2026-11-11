/*
 * Note: open the agent from the empty line's placeholder, generate formatted text, then keep it.
 * The aura is quiet while idle and shifts to a soft violet (with a pulse) only while the agent streams.
 */
import { press, startDemo, type } from '../demo-kit';
import { auraOf, setAura } from './aura';

const IDLE = '#9a96a8';
const WRITING = '#a58bf2';

const REWRITE = [
	{ text: 'Let the ' },
	{ text: 'rough concrete', tag: 'strong' },
	{ text: ' and polished floor create a ' },
	{ text: 'deliberate contrast', tag: 'em' },
	{ text: '. Keep the surfaces honest: let the light reveal their textures, while a quieter palette gives the entrance room to breathe. Use the changing daylight to bring warmth and depth to the space.' },
] as const;

export function initNoteDemo() {
	const note = document.querySelector<HTMLElement>('[data-demo="note"]');
	const prompt = note?.querySelector<HTMLElement>('[data-prompt]');
	const instruction = note?.querySelector<HTMLElement>('[data-instruction]');
	const send = note?.querySelector<HTMLElement>('[data-send]');
	const keep = note?.querySelector<HTMLElement>('[data-keep]');
	const empty = note?.querySelector<HTMLElement>('[data-empty]');
	const hint = note?.querySelector<HTMLElement>('[data-hint]');
	const draftRow = note?.querySelector<HTMLElement>('[data-draft-row]');
	const draft = note?.querySelector<HTMLElement>('[data-draft]');
	const rail = note?.querySelector<HTMLElement>('[data-rail]');
	const saveStatus = note?.querySelector<HTMLElement>('[data-save-status]');
	if (!(note && prompt && instruction && send && keep && empty && hint && draftRow && draft && rail && saveStatus)) return;

	const INSTRUCTION = instruction.textContent ?? '';
	startDemo(note, async (wait) => {
		setAura(note, IDLE);
		empty.hidden = false;
		hint.hidden = false;
		draftRow.hidden = true;
		draft.textContent = '';
		prompt.hidden = true;
		prompt.dataset.phase = 'prompt';
		instruction.textContent = '';
		rail.classList.remove('is-on', 'is-streaming');
		saveStatus.textContent = 'Edited 2m ago';
		await wait(900);
		empty.hidden = true;
		prompt.hidden = false;
		await wait(400);
		await type(instruction, INSTRUCTION, wait, 25);
		await wait(200);
		await press(send, wait, 160);
		// Stream the generated draft into the empty paragraph.
		prompt.dataset.phase = 'streaming';
		setAura(note, WRITING);
		auraOf(note)?.classList.add('is-writing');
		rail.classList.add('is-on', 'is-streaming');
		draftRow.hidden = false;
		for (const part of REWRITE) {
			const container: HTMLElement = 'tag' in part ? document.createElement(part.tag) : draft;
			if (container !== draft) draft.append(container);
			for (const chunk of part.text.match(/\S+\s*|\s+/g) ?? []) {
				container.append(document.createTextNode(chunk));
				await wait(25);
			}
		}
		// Review: Retry / Discard / Keep, with the rail still marking the draft.
		rail.classList.remove('is-streaming');
		auraOf(note)?.classList.remove('is-writing');
		setAura(note, IDLE);
		prompt.dataset.phase = 'review';
		instruction.textContent = '';
		await wait(800);
		await press(keep, wait, 160);
		prompt.hidden = true;
		rail.classList.remove('is-on');
		saveStatus.textContent = 'Saving…';
		await wait(500);
		saveStatus.textContent = 'Edited just now';
		await wait(800);
	});
}
