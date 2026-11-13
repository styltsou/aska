const root = document.querySelector<HTMLElement>('[data-consent]');
declare global { interface Window { posthog?: { opt_in_capturing: (options?: { captureEventName: false }) => void; opt_out_capturing: () => void; capture: (event: string) => void } } }

const storageKey = 'mnemee-website-analytics-consent';
type Consent = 'accepted' | 'rejected';

if (root) {
	const panel = root.querySelector<HTMLElement>('[data-consent-panel]');
	const settings = document.querySelectorAll<HTMLButtonElement>('[data-consent-settings]');
	const preferences = root.querySelector<HTMLElement>('[data-consent-preferences]');
	const edit = root.querySelector<HTMLButtonElement>('[data-consent-edit]');
	const primary = root.querySelector<HTMLButtonElement>('[data-consent-primary]');
	const label = root.querySelector<HTMLElement>('[data-consent-label]');
	const analytics = root.querySelector<HTMLInputElement>('[data-consent-analytics]');
	const key = root.dataset.key;
	const host = root.dataset.host;
	let choice: Consent | null = null;
	let loaded = false;
	let panelAnimation: Animation | undefined;
	let loader: HTMLScriptElement | undefined;
	let editing = false;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
		loader = script;
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

	const closePanel = (reload: boolean) => {
		if (!panel) return;
		panelAnimation?.cancel();
		panel.inert = true;
		const finish = () => {
			if (panel.contains(document.activeElement)) settings[0]?.focus({ preventScroll: true });
			panel.hidden = true;
			panel.inert = false;
			if (reload) window.location.reload();
		};
		if (reducedMotion.matches) { finish(); return; }
		panelAnimation = panel.animate(
			[{ opacity: 1, transform: 'translateX(-50%) translateY(0)' }, { opacity: 0, transform: 'translateX(-50%) translateY(8px)' }],
			{ duration: 160, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
		);
		panelAnimation.finished.then(finish).catch(() => {});
	};

	const choose = (value: Consent) => {
		choice = value;
		const shouldReload = value === 'rejected' && loaded;
		try { localStorage.setItem(storageKey, value); } catch { /* Apply this choice for the current page. */ }
		if (value === 'accepted') {
			if (loaded && window.posthog) {
				window.posthog.opt_in_capturing({ captureEventName: false });
			} else {
				loadAnalytics();
			}
		}
		else if (loaded) {
			// Stop capture immediately, then reload once the exit completes to clear an in-flight loader.
			window.posthog?.opt_out_capturing();
			loader?.remove();
			if (!window.posthog) loaded = false;
		}
		closePanel(shouldReload);
	};

	if (panel) panel.hidden = choice !== null;
	if (choice === 'accepted') loadAnalytics();
	const openPreferences = () => {
		if (!panel) return;
		const wasHidden = panel.hidden;
		panelAnimation?.cancel();
		panel.inert = false;
		const oldHeight = panel.getBoundingClientRect().height;
		const oldWidth = primary?.getBoundingClientRect().width ?? 0;
		const animateChange = !reducedMotion.matches && !wasHidden && !editing;
		const oldLabel = animateChange && label ? label.cloneNode(true) as HTMLElement : null;
		if (oldLabel && primary) {
			oldLabel.removeAttribute('data-consent-label');
			oldLabel.setAttribute('aria-hidden', 'true');
			oldLabel.className = 'consent__old-label';
			primary.append(oldLabel);
		}
		editing = true;
		if (analytics) analytics.checked = choice === 'accepted';
		panel.hidden = false;
		panel.dataset.view = 'preferences';
		if (preferences) preferences.hidden = false;
		if (edit) edit.hidden = true;
		if (label) label.textContent = 'Save preferences';
		if (animateChange) {
			const newHeight = panel.getBoundingClientRect().height;
			panelAnimation = panel.animate([{ height: `${oldHeight}px`, overflow: 'hidden' }, { height: `${newHeight}px`, overflow: 'hidden' }], { duration: 220, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
			preferences?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
			if (primary && label && oldLabel) {
				const newWidth = primary.getBoundingClientRect().width;
				primary.animate([{ width: `${oldWidth}px` }, { width: `${newWidth}px` }], { duration: 220, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
				label.animate([{ opacity: 0 }, { opacity: 1 }], { delay: 80, duration: 110, easing: 'ease-out', fill: 'backwards' });
				oldLabel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, easing: 'ease-out' }).finished.finally(() => oldLabel.remove());
			}
		}
		analytics?.focus({ preventScroll: true });
	};
	settings.forEach((button) => button.addEventListener('click', openPreferences));
	edit?.addEventListener('click', openPreferences);
	primary?.addEventListener('click', () => choose(editing ? (analytics?.checked ? 'accepted' : 'rejected') : 'accepted'));
}


