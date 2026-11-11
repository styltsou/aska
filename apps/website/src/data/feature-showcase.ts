import blueRedWall from '../assets/images/blue-red-wall.jpg';
import curvedArchitecture from '../assets/images/curved-architecture.jpg';
import brutalistShadows from '../assets/images/brutalist-shadows.jpg';
import concreteSculptures from '../assets/images/concrete-sculptures.jpg';
import greenAbstract02 from '../assets/images/green-abstract-02.webp';
import greenAbstract03 from '../assets/images/green-abstract-03.webp';
import greenAbstract05 from '../assets/images/green-abstract-05.webp';
import greenAbstract07 from '../assets/images/green-abstract-07.webp';
import heroGreen01 from '../assets/images/hero-green-01.webp';
import heroGreen03 from '../assets/images/hero-green-03.webp';
import heroGreen04 from '../assets/images/hero-green-04.webp';
import heroBlue01 from '../assets/images/hero-blue-01.webp';
import heroBlue02 from '../assets/images/hero-blue-02.webp';
import heroBlue03 from '../assets/images/hero-blue-03.webp';
import heroBlue04 from '../assets/images/hero-blue-04.webp';
import heroBlue05 from '../assets/images/hero-blue-05.webp';
import heroRed01 from '../assets/images/hero-red-01.webp';
import heroRed02 from '../assets/images/hero-red-02.webp';
import heroRed03 from '../assets/images/hero-red-03.webp';
import heroRed04 from '../assets/images/hero-red-04.webp';
import heroRed05 from '../assets/images/hero-red-05.webp';

export const thumb = { width: 64, densities: [1, 2], quality: 74, alt: '' } as const;
export const tile = { width: 200, densities: [1, 2], quality: 76, alt: '' } as const;

// The images pinned on the board behind the command palette (see the markup for where each sits).
export const boardImages = { stair: curvedArchitecture, leaf: heroGreen03, shadows: brutalistShadows, wall: blueRedWall, green: greenAbstract05, mossy: heroGreen01 };


// The palette's results: an image, a note, then more images, as the app lists them.
export const searchResults = [
	{ image: curvedArchitecture, label: 'Curved concrete stair', detail: 'Studio archive', kind: 'Image' },
	{ image: blueRedWall, label: 'Painted wall, late light', detail: 'Spring campaign', kind: 'Image' },
	{ image: brutalistShadows, label: 'Brutalist shadows at noon', detail: 'Material library', kind: 'Image' },
	{ note: true, label: 'Light studies', detail: 'Soft light reads flat on raw concrete, so…', kind: 'Note' },
	{ image: concreteSculptures, label: 'Concrete sculptures', detail: 'Studio archive', kind: 'Image' },
];
// The filter bar's eight preset colours (apps/web/src/components/filter-bar).
export const filterColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'];
// What each colour the demo picks finds: three masonry columns and a match count.
export const colorResults = [
	{ color: '#22c55e', count: 12, columns: [[greenAbstract05, heroGreen03], [heroGreen01, greenAbstract02], [greenAbstract07, greenAbstract03, heroGreen04]] },
	{ color: '#3b82f6', count: 9, columns: [[heroBlue01, heroBlue04], [heroBlue02, heroBlue05], [heroBlue03, blueRedWall]] },
	{ color: '#ef4444', count: 7, columns: [[heroRed01, heroRed04], [heroRed02, heroRed05], [heroRed03]] },
];
export const pointer = 'M5 3.2v15.6l4.2-4 2.8 6.3 2.6-1.1-2.8-6.2h5.9z';
