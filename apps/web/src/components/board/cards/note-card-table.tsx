import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

// The standard note dialog is 1024px wide, with 192px of horizontal
// document padding and 20px reserved for the table's add-column control.
const TABLE_REFERENCE_WIDTH = 812;

export function NoteCardTable(props: ComponentProps<"table">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      if (container.clientWidth > 0) {
        setScale(Math.min(1, container.clientWidth / TABLE_REFERENCE_WIDTH));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="note-card-table-scroll"
      style={{ "--note-table-scale": scale } as CSSProperties}
    >
      <ScrollArea
        viewportClassName="h-auto"
        contentClassName="note-card-table-content"
        contentStyle={{ width: "max-content", minWidth: "100%" }}
        verticalScrollbarClassName="hidden"
        horizontalScrollbarClassName="note-card-table-scrollbar"
        horizontalScrollbarStyle={{ position: "relative", opacity: 1 }}
        horizontalThumbClassName="note-card-table-thumb"
      >
        <table
          {...props}
          style={{ ...props.style, width: TABLE_REFERENCE_WIDTH, zoom: scale }}
        />
      </ScrollArea>
    </div>
  );
}
