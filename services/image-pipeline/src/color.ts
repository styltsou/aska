/**
 * Colour-space primitives used by the image pipeline.
 *
 * Palette clustering happens in Oklab because Euclidean distance in that space
 * is a substantially better approximation of perceived colour difference than
 * distance in gamma-encoded sRGB.
 *
 * The conversion matrices below are defined by Bjorn Ottosson's Oklab
 * specification. They are fixed colour-science constants, not extraction
 * parameters and the inverse matrices must remain paired.
 */

export type Rgb = { r: number; g: number; b: number };

export type Oklab = {
	oklabL: number;
	oklabA: number;
	oklabB: number;
};

type Vector3 = readonly [number, number, number];
type Matrix3 = readonly [Vector3, Vector3, Vector3];

const SRGB_8BIT_MAX = 255;
const SRGB_DECODE_THRESHOLD = 0.04045;
const SRGB_ENCODE_THRESHOLD = 0.0031308;
const SRGB_LINEAR_SCALE = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_SCALE = 1.055;
const SRGB_GAMMA = 2.4;

/** Fixed Oklab conversion matrix from linear sRGB to LMS cone responses. */
const LINEAR_SRGB_TO_LMS: Matrix3 = [
	[0.4122214708, 0.5363325363, 0.0514459929],
	[0.2119034982, 0.6806995451, 0.1073969566],
	[0.0883024619, 0.2817188376, 0.6299787005],
];

/** Fixed Oklab conversion matrix from cube-root LMS to Oklab. */
const LMS_TO_OKLAB: Matrix3 = [
	[0.2104542553, 0.793617785, -0.0040720468],
	[1.9779984951, -2.428592205, 0.4505937099],
	[0.0259040371, 0.7827717662, -0.808675766],
];

/** Inverse Oklab conversion matrix from Oklab to cube-root LMS. */
const OKLAB_TO_CUBE_ROOT_LMS: Matrix3 = [
	[1, 0.3963377774, 0.2158037573],
	[1, -0.1055613458, -0.0638541728],
	[1, -0.0894841775, -1.291485548],
];

/** Inverse Oklab conversion matrix from LMS to linear sRGB. */
const LMS_TO_LINEAR_SRGB: Matrix3 = [
	[4.0767416621, -3.3077115913, 0.2309699292],
	[-1.2684380046, 2.6097574011, -0.3413193965],
	[-0.0041960863, -0.7034186147, 1.707614701],
];

/** Converts one 8-bit sRGB channel to a linear-light component. */
function srgbByteToLinear(value: number): number {
	const normalized = value / SRGB_8BIT_MAX;
	return normalized <= SRGB_DECODE_THRESHOLD
		? normalized / SRGB_LINEAR_SCALE
		: ((normalized + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE) ** SRGB_GAMMA;
}

/** Converts a linear-light component to a clamped 8-bit sRGB channel. */
function linearToSrgbByte(value: number): number {
	const srgb =
		value <= SRGB_ENCODE_THRESHOLD
			? SRGB_LINEAR_SCALE * value
			: SRGB_GAMMA_SCALE * value ** (1 / SRGB_GAMMA) - SRGB_GAMMA_OFFSET;
	return Math.round(Math.max(0, Math.min(SRGB_8BIT_MAX, srgb * SRGB_8BIT_MAX)));
}

/** Multiplies a three-component vector by a fixed 3x3 colour-conversion matrix. */
function multiplyMatrix(
	matrix: Matrix3,
	[x, y, z]: Vector3,
): [number, number, number] {
	return [
		matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
		matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
		matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
	];
}

/**
 * Converts an 8-bit sRGB colour to Oklab.
 *
 * Oklab is used for clustering and similarity calculations; it is not used as
 * the final display encoding.
 */
export function rgbToOklab(color: Rgb): Oklab {
	const linearRgb: Vector3 = [
		srgbByteToLinear(color.r),
		srgbByteToLinear(color.g),
		srgbByteToLinear(color.b),
	];
	const lms = multiplyMatrix(LINEAR_SRGB_TO_LMS, linearRgb);
	const l = Math.cbrt(lms[0]);
	const m = Math.cbrt(lms[1]);
	const s = Math.cbrt(lms[2]);
	const [oklabL, oklabA, oklabB] = multiplyMatrix(LMS_TO_OKLAB, [l, m, s]);

	return { oklabL, oklabA, oklabB };
}

/** Converts an Oklab colour to a clamped 8-bit sRGB colour for display. */
export function oklabToRgb(oklab: Oklab): Rgb {
	const cubeRootLms = multiplyMatrix(OKLAB_TO_CUBE_ROOT_LMS, [
		oklab.oklabL,
		oklab.oklabA,
		oklab.oklabB,
	]);
	const lms: [number, number, number] = [
		cubeRootLms[0] ** 3,
		cubeRootLms[1] ** 3,
		cubeRootLms[2] ** 3,
	];
	const [r, g, b] = multiplyMatrix(LMS_TO_LINEAR_SRGB, lms);

	return {
		r: linearToSrgbByte(r),
		g: linearToSrgbByte(g),
		b: linearToSrgbByte(b),
	};
}

/** Returns squared Oklab distance, avoiding an unnecessary square root during comparisons. */
export function oklabDistanceSquared(a: Oklab, b: Oklab): number {
	const deltaL = a.oklabL - b.oklabL;
	const deltaA = a.oklabA - b.oklabA;
	const deltaB = a.oklabB - b.oklabB;

	return deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
}

/** Returns Oklab chroma: distance from the neutral lightness axis. */
export function oklabChroma(color: Oklab): number {
	return Math.hypot(color.oklabA, color.oklabB);
}

/** Formats an 8-bit RGB colour as a lowercase CSS hexadecimal colour. */
export function rgbToHex(color: Rgb): string {
	return `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
