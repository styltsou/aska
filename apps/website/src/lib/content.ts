/*
 * What the site says about Mnemee, in one place. The page's FAQ, the JSON-LD, llms.txt and the markdown version of the
 * page all read from here, so they never drift apart.
 */
export const product = {
	name: 'Mnemee',
	tagline: 'Keep the reference. Find the direction.',
	title: 'Mnemee | A visual workspace for your references',
	description: 'Collect images, videos, links, and notes. Arrange ideas on a canvas and find the references you need with Mnemee.',
	summary: 'Mnemee is a visual workspace for the references you want to keep and the ideas you want to make. Collect images, videos, links, and notes in one place, arrange them on a canvas, and find them again by color or by words.',
	keywords: ['visual workspace', 'reference manager', 'moodboard', 'visual bookmarking', 'image collection', 'color search', 'canvas', 'notes', 'design references', 'creative inspiration'],
	github: 'https://github.com/styltsou/mnemee',
	issues: 'https://github.com/styltsou/mnemee/issues',
} as const;

export const features = [
	{
		name: 'Semantic search',
		status: 'Coming soon',
		description: "Search across a collection using the meaning and visual qualities of what you've saved, so you can find the idea even when you can't name the file.",
	},
	{
		name: 'Color search',
		status: 'Available',
		description: 'Pick a color to find matching images in your Inbox or collection, and follow it back to where the image sits.',
	},
	{
		name: 'AI writing',
		status: 'Available',
		description: 'Ask AI to help write or refine a passage, right inside a note where your ideas live.',
	},
	{
		name: 'Browser extension',
		status: 'Coming soon',
		description: 'Save pages, images, colors, and more from the web into Mnemee, right when you find them. Planned for Chrome and Firefox.',
	},
] as const;

export const useCases = [
	{ name: 'Pull a moodboard together', description: 'Drop every find into your Inbox while you research, then move the strongest into a collection and arrange them on its canvas, next to your notes.' },
	{ name: 'Keep the source close', description: 'Save photos and articles as you go. Every item keeps its source link, so the original is one click away.' },
	{ name: 'Find "that green one"', description: 'Pick a color and Mnemee finds the matching images in your Inbox or a collection, or search the words from a title or note.' },
	{ name: 'Keep ideas close as you sketch', description: 'Collect the gestures, palettes, and details that catch your eye, and leave a note beside each reference.' },
] as const;

export const faqs = [
	{
		question: 'What can I save in Mnemee?',
		answer: 'Images, videos, links, and written notes. Everything you add lands in your Inbox first, so you can capture a reference in the moment and decide where it belongs later.',
	},
	{
		question: 'How is it different from bookmarks or a folder of screenshots?',
		answer: 'A bookmark list keeps a pointer; Mnemee keeps the material itself, next to the source link and the thought it sparked. References can live on a collection canvas, where you arrange them like you would on a wall.',
	},
	{
		question: 'How does color search work?',
		answer: 'Pick one or more colors and Mnemee finds the saved images that match, in your Inbox or inside a collection, and takes you back to where each one sits. Text search works alongside it, so you can follow whichever clue you remember.',
	},
	{
		question: 'Do I need to organize everything right away?',
		answer: 'No. Save first and give things shape when you are ready. Move references into collections, arrange them on the canvas, and use folders when an idea needs a place of its own.',
	},
	{
		question: 'Can I keep my own notes next to the references?',
		answer: 'Yes. Write a note in the Inbox or place it on a collection canvas, right beside the images and links it belongs to, so the reasoning stays with the reference.',
	},
] as const;
