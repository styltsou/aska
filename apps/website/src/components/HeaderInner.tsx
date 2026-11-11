import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import { setMenuScrollLocked } from "./menu-scroll-lock";

interface Props {
	loginHref: string;
	signupHref: string;
}

export function HeaderInner({ loginHref, signupHref }: Props) {
	const [isOpen, setIsOpen] = useState(false);

	const close = useCallback(() => {
		setMenuScrollLocked(false);
		setIsOpen(false);
	}, []);

	const toggle = useCallback(() => {
		if (isOpen) close();
		else {
			setMenuScrollLocked(true);
			setIsOpen(true);
		}
	}, [close, isOpen]);

	const scrollToTop = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		close();
		window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
		if (window.location.hash) {
			window.history.replaceState(null, "", window.location.pathname + window.location.search);
		}
	}, [close]);

	useEffect(() => () => setMenuScrollLocked(false), []);

	useEffect(() => {
		if (!isOpen) return;
		const desktop = window.matchMedia("(min-width: 641px)");
		const onResize = () => { if (desktop.matches) close(); };

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") close();
		}
		document.addEventListener("keydown", onKeyDown);
		desktop.addEventListener("change", onResize);
		onResize();
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			desktop.removeEventListener("change", onResize);
		};
	}, [close, isOpen]);

	return (
		<div className="site-header__inner" data-menu-open={isOpen || undefined}>
			<div className="site-header__row">
				<a className="brand" href="/" aria-label="Mnemee home" onClick={scrollToTop}>
					<img className="brand__logo" src="/mnemee-logo.svg" alt="" />
				</a>
				<nav className="desktop-nav" aria-label="Primary navigation">
					<a href="#workflow">Features</a>
					<a href="#canvas">Use cases</a>
					<a href="#faq">FAQ</a>
				</nav>
				<div className="desktop-actions">
					<a className="app-button app-button--compact app-button--secondary" href={loginHref}>Log in</a>
					<a className="app-button app-button--compact app-button--primary" href={signupHref}>Create account</a>
				</div>
				<button
					className="mobile-menu-toggle"
					type="button"
					aria-expanded={isOpen}
					aria-controls="mobile-menu"
					aria-label={isOpen ? "Close menu" : "Open menu"}
					onClick={toggle}
				>
					<span className="mobile-menu-toggle__icon" aria-hidden="true">
						<span />
						<span />
					</span>
				</button>
			</div>

			<div className="mobile-menu-content" id="mobile-menu" aria-hidden={!isOpen} data-lenis-prevent>
				<nav className="mobile-menu-nav" aria-label="Mobile navigation">
					<a onClick={close} href="#workflow">Features</a>
					<a onClick={close} href="#canvas">Use cases</a>
					<a onClick={close} href="#faq">FAQ</a>
				</nav>
				<div className="mobile-menu-footer">
					<a onClick={close} className="app-button app-button--primary" href={signupHref}>Create account</a>
					<a onClick={close} className="app-button app-button--secondary" href={loginHref}>Log in</a>
				</div>
			</div>
		</div>
	);
}
