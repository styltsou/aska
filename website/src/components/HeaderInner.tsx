import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
	loginHref: string;
	signupHref: string;
}

export function HeaderInner({ loginHref, signupHref }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const isOpenRef = useRef(false);
	const animLockRef = useRef(false);

	const open = useCallback(() => {
		if (animLockRef.current) return;
		animLockRef.current = true;

		isOpenRef.current = true;
		setIsOpen(true);
		document.documentElement.classList.add('has-mobile-menu');
	}, []);

	const close = useCallback(() => {
		if (animLockRef.current) return;
		animLockRef.current = true;

		isOpenRef.current = false;
		setIsOpen(false);
	}, []);

	const toggle = useCallback(() => {
		if (isOpenRef.current) close();
		else open();
	}, [open, close]);

	const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
		if (e.target !== e.currentTarget) return;
		if (e.propertyName === 'height') {
			animLockRef.current = false;
			if (!isOpenRef.current) {
				document.documentElement.classList.remove('has-mobile-menu');
			}
		}
	}, []);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && isOpenRef.current && !animLockRef.current) close();
		}
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [close]);

	return (
		<div
			className="site-header__inner"
			data-menu-open={isOpen || undefined}
			onTransitionEnd={handleTransitionEnd}
		>
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
					aria-label={isOpen ? 'Close menu' : 'Open menu'}
					onClick={toggle}
				>
					<span className="mobile-menu-toggle__icon" aria-hidden="true">
						<span />
						<span />
					</span>
				</button>
			</div>

			<div className="mobile-menu-content">
				<nav className="mobile-menu-nav" aria-label="Mobile navigation">
					<a onClick={close} href="#product">Product</a>
					<a onClick={close} href="#workflow">Workflow</a>
					<a onClick={close} href="#archive">Archive</a>
				</nav>
				<div className="mobile-menu-footer">
					<a onClick={close} className="button button--quiet" href={signupHref}>Create account</a>
					<a onClick={close} className="button button--primary" href={loginHref}>Log in</a>
				</div>
			</div>
		</div>
	);
}
