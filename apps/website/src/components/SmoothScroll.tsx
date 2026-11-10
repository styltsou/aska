import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function SmoothScroll() {
	useEffect(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let lenis: Lenis | undefined;
		let frameId = 0;

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
			frameId = requestAnimationFrame(raf);
		};

		syncMotion();
		reducedMotion.addEventListener('change', syncMotion);
		return () => {
			reducedMotion.removeEventListener('change', syncMotion);
			cancelAnimationFrame(frameId);
			lenis?.destroy();
		};
	}, []);

	return null;
}
