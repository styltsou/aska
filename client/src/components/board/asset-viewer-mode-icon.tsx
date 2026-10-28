import { Maximize2, Minimize2 } from "lucide-react";

import { StateIcon } from "@/components/ui/state-icon";

export function AssetViewerModeIcon({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  return (
    <span className="relative inline-flex size-4 items-center justify-center">
      <StateIcon
        icon={expanded ? Minimize2 : Maximize2}
        className="size-3.5"
      />
    </span>
  );
}
