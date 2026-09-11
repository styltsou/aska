import { MorphIcon, type MorphIconProps } from "morphicons/react";

type MorphStateIconProps = Omit<
  MorphIconProps,
  "icon" | "reducedMotion" | "spring"
> & {
  icon: NonNullable<MorphIconProps["icon"]>;
};

/** Shared fast icon-state transition used for reversible controls. */
export function MorphStateIcon({ icon, ...props }: MorphStateIconProps) {
  return (
    <MorphIcon icon={icon} reducedMotion="user" spring="snappy" {...props} />
  );
}
