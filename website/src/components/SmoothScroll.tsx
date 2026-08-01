import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function SmoothScroll() {
	useEffect(() => {
		const anchorOffset = Number.parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--anchor-offset'),
		);
		const lenis = new Lenis({
			anchors: { offset: -anchorOffset },
			lerp: 0.12,
			smoothWheel: true,
			wheelMultiplier: 1,
			syncTouch: true,
			syncTouchLerp: 0.12,
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
