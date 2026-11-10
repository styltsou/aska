import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function SmoothScroll() {
	useEffect(() => {
		const lenis = new Lenis({
			anchors: true,
			lerp: 0.22,
			smoothWheel: true,
			wheelMultiplier: 1.05,
			syncTouch: true,
			syncTouchLerp: 0.2,
			stopInertiaOnNavigate: true,
		});

		let frameId = 0;
		const raf = (time: number) => {
			lenis.raf(time);
			frameId = requestAnimationFrame(raf);
		};

		frameId = requestAnimationFrame(raf);
		return () => {
			cancelAnimationFrame(frameId);
			lenis.destroy();
		};
	}, []);

	return null;
}
