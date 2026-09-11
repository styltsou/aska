import { Check, Copy } from "lucide";
import type { MorphIconProps } from "morphicons/react";

import { MorphStateIcon } from "./morph-state-icon";

type CopyFeedbackIconProps = Omit<
  MorphIconProps,
  "icon" | "reducedMotion" | "spring"
> & {
  copied: boolean;
};

/** A shared Copy → Check acknowledgement that respects reduced-motion preferences. */
export function CopyFeedbackIcon({ copied, ...props }: CopyFeedbackIconProps) {
  return <MorphStateIcon icon={copied ? Check : Copy} {...props} />;
}
