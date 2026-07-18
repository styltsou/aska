import { useState, useEffect, useCallback } from "react";

interface Props {
	loginHref: string;
	signupHref: string;
}

export function HeaderInner({ loginHref, signupHref }: Props) {
	const [isOpen, setIsOpen] = useState(false);

	const close = useCallback(() => {
		setIsOpen(false);
	}, []);

	const toggle = useCallback(() => {
		setIsOpen((current) => !current);
	}, []);

	useEffect(() => {
		document.documentElement.classList.toggle("has-mobile-menu", isOpen);
		return () => document.documentElement.classList.remove("has-mobile-menu");
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") close();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [close, isOpen]);

	return (
		<div className="site-header__inner" data-menu-open={isOpen || undefined}>
			<div className="site-header__chrome" aria-hidden="true" />
			<div className="site-header__row">
				<a className="brand" href="#top" aria-label="Aska home">
					<img className="brand__logo" src="/aska-logo.svg" alt="" />
				</a>
				<nav className="desktop-nav" aria-label="Primary navigation">
					<a href="#product">Product</a>
					<a href="#workflow">Workflow</a>
					<a href="#archive">Archive</a>
				</nav>
				<div className="desktop-actions">
					<a className="text-link" href={loginHref}>Log in</a>
					<a className="button button--primary" href={signupHref}>Create account</a>
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

			<div className="mobile-menu-content" id="mobile-menu" aria-hidden={!isOpen}>
				<nav className="mobile-menu-nav" aria-label="Mobile navigation">
					<a onClick={close} href="#product">Product</a>
					<a onClick={close} href="#workflow">Workflow</a>
					<a onClick={close} href="#archive">Archive</a>
				</nav>
				<div className="mobile-menu-footer">
					<a onClick={close} className="button button--primary" href={loginHref}>Log in</a>
					<a onClick={close} className="button button--quiet" href={signupHref}>Create account</a>
				</div>
			</div>
		</div>
	);
}
