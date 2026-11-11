import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/markdown';
import { appBaseUrl } from '../lib/site-urls';

export const GET: APIRoute = ({ site }) =>
	new Response(llmsTxt(site!, appBaseUrl), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
