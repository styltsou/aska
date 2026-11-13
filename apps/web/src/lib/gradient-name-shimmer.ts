/**
 * Sweeping highlight for a color's name while the AI is still naming it. All
 * parts sit behind `motion-safe:` so reduced motion shows the plain text.
 */
export const GRADIENT_NAME_SHIMMER =
  "motion-safe:animate-gradient-name-sweep motion-safe:bg-[linear-gradient(105deg,var(--foreground)_35%,color-mix(in_srgb,var(--foreground)_35%,transparent)_50%,var(--foreground)_65%)] motion-safe:bg-[length:220%_100%] motion-safe:bg-clip-text motion-safe:text-transparent";
