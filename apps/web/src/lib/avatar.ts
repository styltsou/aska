/**
 * Avatar sources, in the order they win:
 *   1. the user's explicit choice (`user.avatar`): `gradient:<id>` today,
 *      `upload:<key>` once avatar uploads ship
 *   2. the identity provider's picture (`user.image`, Google)
 *   3. a gradient derived from the user id, so nobody gets a blank circle
 *
 * Signing in with or linking Google only ever updates `user.image`, so it can
 * never replace a choice the user made.
 */

export type AvatarGradient = {
  id: string;
  label: string;
  /** Full CSS `background` value. */
  background: string;
};

const radial = (at: string, from: string, to: string, base: string) =>
  `radial-gradient(circle at ${at}, ${from} 0%, ${to} 55%, ${base} 100%)`;

// Ids are stored on the user, so never rename or reuse one.
export const AVATAR_GRADIENTS: readonly AvatarGradient[] = [
  {
    id: "aurora",
    label: "Aurora",
    background: radial("30% 25%", "#7df9c8", "#3b82f6", "#1e1b4b"),
  },
  {
    id: "dusk",
    label: "Dusk",
    background: radial("70% 20%", "#fda4af", "#a855f7", "#1e1b4b"),
  },
  {
    id: "lagoon",
    label: "Lagoon",
    background: radial("25% 30%", "#a5f3fc", "#06b6d4", "#0c4a6e"),
  },
  {
    id: "ember",
    label: "Ember",
    background: radial("35% 25%", "#fde68a", "#f97316", "#7f1d1d"),
  },
  {
    id: "orchid",
    label: "Orchid",
    background: radial("65% 30%", "#f5d0fe", "#d946ef", "#4a044e"),
  },
  {
    id: "meadow",
    label: "Meadow",
    background: radial("30% 30%", "#d9f99d", "#22c55e", "#064e3b"),
  },
  {
    id: "glacier",
    label: "Glacier",
    background: radial("70% 25%", "#e0f2fe", "#60a5fa", "#312e81"),
  },
  {
    id: "sunset",
    label: "Sunset",
    background: radial("30% 70%", "#fecaca", "#f43f5e", "#581c87"),
  },
  {
    id: "citrus",
    label: "Citrus",
    background: radial("65% 30%", "#fef08a", "#84cc16", "#14532d"),
  },
  {
    id: "nebula",
    label: "Nebula",
    background: radial("30% 35%", "#c4b5fd", "#6366f1", "#0f172a"),
  },
  {
    id: "coral",
    label: "Coral",
    background: radial("70% 30%", "#fed7aa", "#fb7185", "#4c0519"),
  },
  {
    id: "slate",
    label: "Slate",
    background: radial("30% 30%", "#e2e8f0", "#64748b", "#0f172a"),
  },
];

const GRADIENT_PREFIX = "gradient:";

export function gradientAvatarValue(id: string) {
  return `${GRADIENT_PREFIX}${id}`;
}

function findGradient(id: string) {
  return AVATAR_GRADIENTS.find((gradient) => gradient.id === id);
}

function hashToGradient(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;
}

export type AvatarUser = {
  id: string;
  image?: string | null;
  avatar?: string | null;
};

export type ResolvedAvatar =
  | { kind: "gradient"; gradient: AvatarGradient; explicit: boolean }
  | { kind: "image"; src: string; fallback: AvatarGradient };

export function resolveAvatar(user: AvatarUser): ResolvedAvatar {
  const fallback = hashToGradient(user.id);
  const choice = user.avatar;
  if (choice?.startsWith(GRADIENT_PREFIX)) {
    const gradient = findGradient(choice.slice(GRADIENT_PREFIX.length));
    // An unknown id (a gradient removed later) falls through to the default.
    if (gradient) return { kind: "gradient", gradient, explicit: true };
  }
  if (user.image) return { kind: "image", src: user.image, fallback };
  return { kind: "gradient", gradient: fallback, explicit: false };
}
