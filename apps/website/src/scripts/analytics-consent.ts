const root = document.querySelector<HTMLElement>('[data-consent]');
declare global { interface Window { posthog?: { opt_in_capturing: (options?: { captureEventName: false }) => void; opt_out_capturing: () => void; capture: (event: string) => void } } }

const storageKey = 'mnemee-website-analytics-consent';
type Consent = 'accepted' | 'rejected';

if (root) {
	const panel = root.querySelector<HTMLElement>('[data-consent-panel]');
	const settings = root.querySelector<HTMLButtonElement>('[data-consent-settings]');
	const key = root.dataset.key;
	const host = root.dataset.host;
	let choice: Consent | null = null;
	let loaded = false;

	try {
		const saved = localStorage.getItem(storageKey);
		if (saved === 'accepted' || saved === 'rejected') choice = saved;
	} catch {
		// The choice will apply for this page only when storage is unavailable.
	}

	const loadAnalytics = () => {
		if (loaded || !key || !host) return;
		loaded = true;
		const script = document.createElement('script');
		const assetsHost = host.replace('.i.posthog.com', '-assets.i.posthog.com');
		script.src = `${assetsHost}/static/loader.js`;
		script.async = true;
		script.crossOrigin = 'anonymous';
		script.dataset.projectToken = key;
		script.dataset.apiHost = host;
		script.dataset.config = JSON.stringify({
			defaults: '2026-08-30',
			autocapture: false,
			capture_pageview: false,
			capture_pageleave: false,
			disable_session_recording: true,
			disable_surveys: true,
			cross_subdomain_cookie: false,
		});
		script.onload = () => {
			if (choice !== 'accepted') return;
			window.posthog?.opt_in_capturing({ captureEventName: false });
			window.posthog?.capture('$pageview');
		};
		document.head.append(script);
	};

	const choose = (value: Consent) => {
		choice = value;
		try { localStorage.setItem(storageKey, value); } catch { /* Apply this choice for the current page. */ }
		if (panel) panel.hidden = true;
		if (value === 'accepted') loadAnalytics();
		else if (loaded) {
			// Clear the SDK's persisted data when it has loaded; reload also cancels an in-flight loader.
			window.posthog?.opt_out_capturing();
			window.location.reload();
		}
	};

	if (panel) panel.hidden = choice !== null;
	if (choice === 'accepted') loadAnalytics();
	settings?.addEventListener('click', () => { if (panel) panel.hidden = false; });
	root.querySelector('[data-consent-accept]')?.addEventListener('click', () => choose('accepted'));
	root.querySelector('[data-consent-reject]')?.addEventListener('click', () => choose('rejected'));
}


