import { LayoutGridIcon, PanelsTopLeftIcon } from "lucide-react";

import type { BoardView } from "@/store/slices/board-slice";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CollectionViewToggle({
  value,
  onChange,
}: {
  value: BoardView;
  onChange: (view: BoardView) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as BoardView)}
      size="sm"
    >
      <TabsList
        aria-label="Collection view"
        className="grid h-7 w-full grid-cols-2"
      >
        <TabsTrigger value="canvas" className="px-2">
          <PanelsTopLeftIcon />
          Canvas
        </TabsTrigger>
        <TabsTrigger value="grid" className="px-2">
          <LayoutGridIcon />
          Grid
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
