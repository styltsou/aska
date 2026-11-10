import { getColorName } from "@/lib/color-names";
import {
  getColorGradientTitle,
  gradientFingerprint,
  isMajorGradientChange,
  type StoredColorGradient,
} from "@/lib/color-gradient";

type CurrentTitle = {
  title: string | null;
  gradient: StoredColorGradient | null;
  nameBasis: StoredColorGradient | null;
  nameEditedByUser: boolean;
};

type NextColor = {
  gradient: StoredColorGradient | null;
  hex: string | null;
  title?: string | null | undefined;
  colorChanged: boolean;
  namingEnabled: boolean;
};

export function deriveColorNaming(current: CurrentTitle, next: NextColor) {
  const explicitTitle = next.title !== undefined;
  const manualTitle = explicitTitle
    ? Boolean(next.title?.trim())
    : current.nameEditedByUser;
  const title = explicitTitle
    ? next.title?.trim() ||
      (next.gradient
        ? getColorGradientTitle(next.gradient)
        : getColorName(next.hex!))
    : manualTitle || !next.colorChanged
      ? current.title
      : next.gradient
        ? current.gradient &&
          current.title !== getColorGradientTitle(current.gradient)
          ? current.title
          : getColorGradientTitle(next.gradient)
        : getColorName(next.hex!);
  const majorChange = Boolean(
    next.colorChanged &&
    next.gradient &&
    isMajorGradientChange(current.nameBasis, next.gradient),
  );
  const shouldQueue = Boolean(
    next.namingEnabled &&
    next.gradient &&
    ((explicitTitle && !manualTitle) ||
      (!explicitTitle && !manualTitle && majorChange)),
  );
  const shouldPrompt = Boolean(
    next.namingEnabled && !explicitTitle && manualTitle && majorChange,
  );
  const nameBasis = explicitTitle
    ? manualTitle
      ? next.gradient
      : null
    : next.gradient
      ? current.nameBasis
      : null;
  return { title, manualTitle, nameBasis, shouldQueue, shouldPrompt };
}

export function matchesGradientNamingJob(
  current: CurrentTitle,
  job: {
    fingerprint: string;
    expectedTitle: string;
    expectedManual: boolean;
  },
) {
  return Boolean(
    current.gradient &&
    gradientFingerprint(current.gradient) === job.fingerprint &&
    current.title === job.expectedTitle &&
    current.nameEditedByUser === job.expectedManual &&
    // A duplicate callback must not replace a name already chosen for this gradient.
    (!current.nameBasis ||
      gradientFingerprint(current.nameBasis) !== job.fingerprint ||
      job.expectedManual),
  );
}
