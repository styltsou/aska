const root = document.querySelector<HTMLElement>('[data-consent]');
declare global { interface Window { posthog?: { opt_in_capturing: (options?: { captureEventName: false }) => void; opt_out_capturing: () => void; capture: (event: string) => void } } }

const storageKey = 'mnemee-website-analytics-consent';
type Consent = 'accepted' | 'rejected';

if (root) {
	const panel = root.querySelector<HTMLElement>('[data-consent-panel]');
	const settings = document.querySelectorAll<HTMLButtonElement>('[data-consent-settings]');
	const preferences = root.querySelector<HTMLElement>('[data-consent-preferences]');
	const initialActions = root.querySelector<HTMLElement>('[data-consent-initial-actions]');
	const preferenceActions = root.querySelector<HTMLElement>('[data-consent-preference-actions]');
	const analytics = root.querySelector<HTMLInputElement>('[data-consent-analytics]');
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
	const openPreferences = () => {
		if (analytics) analytics.checked = choice === 'accepted';
		if (panel) panel.hidden = false;
		if (preferences) preferences.hidden = false;
		if (initialActions) initialActions.hidden = true;
		if (preferenceActions) preferenceActions.hidden = false;
	};
	settings.forEach((button) => button.addEventListener('click', openPreferences));
	root.querySelector('[data-consent-edit]')?.addEventListener('click', openPreferences);
	root.querySelector('[data-consent-save]')?.addEventListener('click', () => choose(analytics?.checked ? 'accepted' : 'rejected'));
	root.querySelector('[data-consent-accept]')?.addEventListener('click', () => choose('accepted'));
	root.querySelector('[data-consent-reject]')?.addEventListener('click', () => choose('rejected'));
}


