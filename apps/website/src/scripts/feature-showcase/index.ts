/*
 * Each bento mock-up plays a short loop of the app in use while it's on screen. Time only runs while the panel is
 * visible (and the tab is shown), so the loops pause off screen. With reduced motion the panels stay as static
 * screenshots (the markup's default state).
 */
import { motionPreference } from './aura';
import { initColorDemo } from './color-demo';
import { initNoteDemo } from './note-demo';
import { initScrollVisuals } from './scroll-visuals';
import { initSearchDemo, initSearchTint } from './search-demo';

initScrollVisuals();
initSearchTint();

if (!motionPreference.matches) {
	initSearchDemo();
	initColorDemo();
	initNoteDemo();
}
