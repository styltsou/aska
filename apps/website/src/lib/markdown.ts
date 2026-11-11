import { faqs, features, product, useCases } from './content';

/** The landing page as markdown, for agents and anyone who prefers plain text. */
export function landingMarkdown(site: URL, appUrl: string) {
	const origin = site.origin;
	return `# ${product.name}

> ${product.tagline} ${product.summary}

- Website: ${origin}/
- App: ${appUrl}
- Source: ${product.github}

## What you can do

${features.map((feature) => `### ${feature.name}${feature.status === 'Coming soon' ? ' (coming soon)' : ''}\n\n${feature.description}`).join('\n\n')}

## Ways people use it

${useCases.map((useCase) => `- **${useCase.name}.** ${useCase.description}`).join('\n')}

## Frequently asked questions

${faqs.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}

## Get started

- Create an account: ${appUrl}/signup
- Log in: ${appUrl}/login
- Questions or feedback: ${product.issues}
`;
}

/** llms.txt: a short, structured guide to the site for language models (https://llmstxt.org). */
export function llmsTxt(site: URL, appUrl: string) {
	const origin = site.origin;
	return `# ${product.name}

> ${product.summary}

Mnemee keeps images, videos, links, and notes together in one workspace. Everything you save lands in an Inbox first; from there you can move it into collections and arrange it on a canvas next to your notes. You can find things again by color or by words.

## Pages

- [Home (markdown)](${origin}/index.md): The full landing page as plain markdown: features, use cases, and FAQ.
- [Home](${origin}/): The landing page.

## Product

- [Sign up](${appUrl}/signup): Create a Mnemee account.
- [Log in](${appUrl}/login): Open your workspace.

## Optional

- [Source code](${product.github}): The Mnemee repository on GitHub.
- [Ask a question](${product.issues}): Open an issue to ask or give feedback.
`;
}

export function sitemapXml(site: URL) {
	const origin = site.origin;
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${origin}/</loc>
		<changefreq>monthly</changefreq>
		<priority>1.0</priority>
	</url>
</urlset>
`;
}

export function robotsTxt(site: URL) {
	return `User-agent: *
Allow: /

Sitemap: ${site.origin}/sitemap.xml
`;
}
