import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/markdown';

export const GET: APIRoute = ({ site }) =>
	new Response(robotsTxt(site!), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
