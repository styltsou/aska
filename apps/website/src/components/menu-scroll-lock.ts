let menuOpen = false;
let syncLenis: ((locked: boolean) => void) | undefined;

export function setMenuScrollLocked(locked: boolean) {
	menuOpen = locked;
	document.documentElement.classList.toggle('has-mobile-menu', locked);
	syncLenis?.(locked);
}

export function registerMenuScrollSync(sync: (locked: boolean) => void) {
	syncLenis = sync;
	sync(menuOpen);
	return () => {
		if (syncLenis === sync) syncLenis = undefined;
	};
}
