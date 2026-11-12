import {
  CaseSensitiveIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
} from "lucide-react";

export function headingIconForLevel(level: number): typeof CaseSensitiveIcon {
  switch (level) {
    case 1:
      return Heading1Icon;
    case 2:
      return Heading2Icon;
    case 3:
      return Heading3Icon;
    default:
      return Heading4Icon;
  }
}
