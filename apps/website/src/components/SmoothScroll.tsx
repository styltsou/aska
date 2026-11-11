import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { registerMenuScrollSync } from './menu-scroll-lock';

export function SmoothScroll() {
	useEffect(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let lenis: Lenis | undefined;
		let frameId = 0;
		const unregister = registerMenuScrollSync((locked) => {
			if (locked) lenis?.stop();
			else lenis?.start();
		});

		const raf = (time: number) => {
			lenis?.raf(time);
			frameId = requestAnimationFrame(raf);
		};
		const syncMotion = () => {
			cancelAnimationFrame(frameId);
			lenis?.destroy();
			lenis = undefined;
			if (reducedMotion.matches) return;

			lenis = new Lenis({
				anchors: true,
				lerp: 0.18,
				smoothWheel: true,
				// Keep touch input and its platform-native momentum directly under the finger.
				syncTouch: false,
				stopInertiaOnNavigate: true,
			});
			if (document.documentElement.classList.contains('has-mobile-menu')) lenis.stop();
			frameId = requestAnimationFrame(raf);
		};

		syncMotion();
		reducedMotion.addEventListener('change', syncMotion);
		return () => {
			unregister();
			reducedMotion.removeEventListener('change', syncMotion);
			cancelAnimationFrame(frameId);
			lenis?.destroy();
		};
	}, []);

	return null;
}
