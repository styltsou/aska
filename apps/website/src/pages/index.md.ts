import type { APIRoute } from 'astro';
import { landingMarkdown } from '../lib/markdown';
import { appBaseUrl } from '../lib/site-urls';

export const GET: APIRoute = ({ site }) =>
	new Response(landingMarkdown(site!, appBaseUrl), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
