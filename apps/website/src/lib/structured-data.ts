import { faqs, features, product } from './content';

/** schema.org JSON-LD for the landing page: the organisation, the site, the web app, and the FAQ. */
export function landingStructuredData(site: URL, appUrl: string) {
	const origin = site.origin;
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': `${origin}/#organization`,
				name: product.name,
				url: `${origin}/`,
				logo: { '@type': 'ImageObject', url: `${origin}/favicon.svg` },
				sameAs: [product.github],
			},
			{
				'@type': 'WebSite',
				'@id': `${origin}/#website`,
				url: `${origin}/`,
				name: product.name,
				description: product.description,
				inLanguage: 'en',
				publisher: { '@id': `${origin}/#organization` },
			},
			{
				'@type': 'WebApplication',
				'@id': `${origin}/#app`,
				name: product.name,
				url: appUrl,
				description: product.summary,
				applicationCategory: 'DesignApplication',
				operatingSystem: 'Web',
				browserRequirements: 'Requires a modern web browser',
				image: `${origin}/og-image.png`,
				keywords: product.keywords.join(', '),
				featureList: features.filter((feature) => feature.status === 'Available').map((feature) => feature.name),
				publisher: { '@id': `${origin}/#organization` },
			},
			{
				'@type': 'FAQPage',
				'@id': `${origin}/#faq`,
				mainEntity: faqs.map(({ question, answer }) => ({
					'@type': 'Question',
					name: question,
					acceptedAnswer: { '@type': 'Answer', text: answer },
				})),
			},
		],
	};
}
