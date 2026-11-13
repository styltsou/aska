import type { CSSProperties, ReactNode } from "react";

/**
 * How a slot behaves when the auth view changes underneath it:
 * - `field`: interactive control. Glides to its new position; crossfades.
 * - `text`: copy that differs per view. Position glides; text swaps with a
 *   short blurred, directional crossfade.
 * - `static`: chrome that never changes (logo, canvas panel, footer). Stays
 *   put; only fades when it exists on one side of the change.
 */
type AuthSlotKind = "field" | "text" | "static";

const SLOT_CLASS: Record<AuthSlotKind, string> = {
  field: "auth-field",
  text: "auth-text",
  static: "auth-static",
};

/**
 * Names a region for the View Transitions API. The same `name` on two
 * consecutive views pairs those regions, so they morph instead of being
 * replaced with the rest of the page. A name must be unique within a view.
 */
export function authSlotStyle(
  name: string,
  kind: AuthSlotKind = "field",
): CSSProperties {
  return {
    viewTransitionName: `auth-${name}`,
    // `view-transition-class` is not in React's CSSProperties yet.
    ...({ viewTransitionClass: SLOT_CLASS[kind] } as CSSProperties),
  };
}

export function AuthSlot({
  name,
  kind = "field",
  as: Tag = "div",
  className,
  children,
}: {
  name: string;
  kind?: AuthSlotKind;
  as?: "div" | "p";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className} style={authSlotStyle(name, kind)}>
      {children}
    </Tag>
  );
}
