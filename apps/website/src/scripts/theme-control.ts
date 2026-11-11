/* The footer's appearance (theme) switch: saved preference, system theme, and the sliding thumb. */
const storageKey = 'mnemee-theme';
const root = document.documentElement;
const themeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-theme-option]'));
const themeOptions = document.querySelector<HTMLElement>('.theme-control__options');
const themeThumb = document.querySelector<HTMLElement>('.theme-control__thumb');
const themeThumbLabels = document.querySelector<HTMLElement>('.theme-control__thumb-labels');
const positionThumb = (animate = false) => {
	const selected = themeButtons.find((button) => button.getAttribute('aria-pressed') === 'true');
	if (!selected || !themeOptions || !themeThumb || !themeThumbLabels) return;
	themeOptions.toggleAttribute('data-animate', animate);
	themeThumb.style.width = `${selected.offsetWidth}px`;
	themeThumb.style.transform = `translateX(${selected.offsetLeft}px)`;
	themeThumbLabels.style.transform = `translateX(${-selected.offsetLeft}px)`;
};
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
type ThemePreference = 'system' | 'light' | 'dark';
const updateTheme = (preference: ThemePreference, animateThumb = false) => {
	const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
	root.dataset.theme = theme;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? 'oklch(0.145 0 0)' : '#ffffff');
	themeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeOption === preference)));
	positionThumb(animateThumb);
};
const readSavedTheme = () => {
	try { const theme = localStorage.getItem(storageKey); return theme === 'light' || theme === 'dark' ? theme : 'system'; }
	catch { return 'system'; }
};
let preference: ThemePreference = readSavedTheme();
updateTheme(preference);
positionThumb();
if (themeOptions) {
	const themeResizeObserver = new ResizeObserver(() => positionThumb());
	themeResizeObserver.observe(themeOptions);
	themeButtons.forEach((button) => themeResizeObserver.observe(button));
	document.addEventListener('astro:before-swap', () => themeResizeObserver.disconnect(), { once: true });
}
themeButtons.forEach((button) => button.addEventListener('click', (event) => {
	preference = button.dataset.themeOption as ThemePreference;
	try { localStorage.setItem(storageKey, preference); } catch { /* Keep the selected theme for this visit. */ }
	updateTheme(preference, event.detail > 0);
}));
systemTheme.addEventListener('change', () => { if (preference === 'system') updateTheme(preference); });
window.addEventListener('storage', (event) => {
	if (event.key !== storageKey && event.key !== null) return;
	preference = readSavedTheme();
	updateTheme(preference);
});
export {};
