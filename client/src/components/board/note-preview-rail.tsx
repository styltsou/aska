import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { motion, useReducedMotion } from "motion/react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NoteSection = {
  id: string;
  label: string;
  level: number;
  position: number;
};

type NoteSectionBoundary = Pick<NoteSection, "id"> & {
  top: number;
};

const SECTION_SCROLL_OFFSET = 72;
const ACTIVE_SECTION_LINE = 0.28;
const MIN_SCROLLBAR_WIDTH = 2;
const PREVIEW_RAIL_GAP = 2;
const MIN_PREVIEW_RAIL_SECTIONS = 1;
const MIN_PREVIEW_RAIL_OVERFLOW_RATIO = 0.25;

export function shouldShowNotePreviewRail(
  sectionCount: number,
  scrollHeight: number,
  clientHeight: number,
) {
  return (
    sectionCount >= MIN_PREVIEW_RAIL_SECTIONS &&
    clientHeight > 0 &&
    scrollHeight - clientHeight >=
      clientHeight * MIN_PREVIEW_RAIL_OVERFLOW_RATIO
  );
}

function getLayoutLeft(element: HTMLElement) {
  let left = element.offsetLeft;
  let parent = element.offsetParent;

  while (parent instanceof HTMLElement) {
    left += parent.offsetLeft;
    parent = parent.offsetParent;
  }

  return left;
}

function readSections(editor: Editor): NoteSection[] {
  const sections: NoteSection[] = [];
  editor.state.doc.forEach((node, position) => {
    if (node.type.name !== "heading") return;

    sections.push({
      id: `section-${position}`,
      label: node.textContent.trim() || "Untitled section",
      level: Number(node.attrs.level) || 1,
      position,
    });
  });

  return sections;
}

function sectionsAreEqual(previous: NoteSection[], next: NoteSection[] | null) {
  return (
    next !== null &&
    previous.length === next.length &&
    previous.every(
      (section, index) =>
        section.id === next[index]?.id &&
        section.label === next[index]?.label &&
        section.level === next[index]?.level,
    )
  );
}

export function getVisibleNoteSectionIds(
  sections: readonly NoteSectionBoundary[],
  viewportTop: number,
  viewportBottom: number,
) {
  return sections.flatMap((section, index) => {
    const nextSectionTop = sections[index + 1]?.top ?? Number.POSITIVE_INFINITY;
    return section.top < viewportBottom && nextSectionTop > viewportTop
      ? [section.id]
      : [];
  });
}

export function isNotePreviewRailSectionHighlighted(
  index: number,
  hoveredIndex: number | null,
  isVisible: boolean,
) {
  return hoveredIndex === null ? isVisible : index === hoveredIndex;
}

export function NotePreviewRail({
  editor,
  scrollContainerRef,
}: {
  editor: Editor;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [sections, setSections] = useState(() => readSections(editor));
  const [isRailVisible, setIsRailVisible] = useState(false);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [visibleSectionIds, setVisibleSectionIds] = useState<string[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [workspaceContent, setWorkspaceContent] = useState<HTMLElement | null>(
    null,
  );
  const [leftOffset, setLeftOffset] = useState(
    MIN_SCROLLBAR_WIDTH + PREVIEW_RAIL_GAP,
  );
  const activeIdRef = useRef(activeId);
  const visibleSectionIdsRef = useRef(visibleSectionIds);

  activeIdRef.current = activeId;
  visibleSectionIdsRef.current = visibleSectionIds;

  const visibleSectionIdSet = useMemo(
    () => new Set(visibleSectionIds),
    [visibleSectionIds],
  );

  useEffect(() => {
    const refreshSections = () => {
      const nextSections = readSections(editor);
      setSections((current) =>
        sectionsAreEqual(current, nextSections) ? current : nextSections,
      );
    };

    refreshSections();
    editor.on("update", refreshSections);
    return () => {
      editor.off("update", refreshSections);
    };
  }, [editor]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setWorkspaceContent(
      container.closest<HTMLElement>("[data-slot='note-workspace-content']"),
    );

    return () => setWorkspaceContent(null);
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let frame = 0;
    const updateVisibility = () => {
      frame = 0;
      const nextIsVisible = shouldShowNotePreviewRail(
        sections.length,
        container.scrollHeight,
        container.clientHeight,
      );
      setIsRailVisible((current) =>
        current === nextIsVisible ? current : nextIsVisible,
      );
      if (!nextIsVisible) {
        setIsOutlineOpen(false);
        setHoveredIndex(null);
      }
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    editor.on("update", scheduleUpdate);
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    resizeObserver.observe(editor.view.dom);

    return () => {
      editor.off("update", scheduleUpdate);
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [editor, scrollContainerRef, sections.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isRailVisible) return;

    let frame = 0;
    const updateRailPosition = () => {
      const scrollbarWidth = Math.max(
        MIN_SCROLLBAR_WIDTH,
        container.offsetWidth - container.clientWidth,
      );
      const containerLeft = container.getBoundingClientRect().left;
      const nextOffset = Math.max(
        scrollbarWidth + PREVIEW_RAIL_GAP,
        Math.round(
          workspaceContent
            ? containerLeft -
                workspaceContent.getBoundingClientRect().left +
                scrollbarWidth +
                PREVIEW_RAIL_GAP
            : getLayoutLeft(container) + scrollbarWidth + PREVIEW_RAIL_GAP,
        ),
      );
      setLeftOffset((current) =>
        current === nextOffset ? current : nextOffset,
      );
    };
    const updateActiveSection = () => {
      frame = 0;
      const containerRect = container.getBoundingClientRect();
      const activeLine =
        containerRect.top + container.clientHeight * ACTIVE_SECTION_LINE;
      let nextActiveId = sections[0]?.id ?? "";
      const sectionBoundaries: NoteSectionBoundary[] = [];

      for (const section of sections) {
        const node = editor.view.nodeDOM(section.position);
        if (!(node instanceof HTMLElement)) continue;
        const top = node.getBoundingClientRect().top;
        sectionBoundaries.push({ id: section.id, top });
        if (top <= activeLine) {
          nextActiveId = section.id;
        }
      }
      const nextVisibleSectionIds = getVisibleNoteSectionIds(
        sectionBoundaries,
        containerRect.top,
        containerRect.bottom,
      );

      if (nextActiveId !== activeIdRef.current) {
        activeIdRef.current = nextActiveId;
        setActiveId(nextActiveId);
      }
      if (
        nextVisibleSectionIds.length !== visibleSectionIdsRef.current.length ||
        nextVisibleSectionIds.some(
          (id, index) => id !== visibleSectionIdsRef.current[index],
        )
      ) {
        visibleSectionIdsRef.current = nextVisibleSectionIds;
        setVisibleSectionIds(nextVisibleSectionIds);
      }
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateRailPosition();
    updateActiveSection();
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", updateRailPosition);
    const resizeObserver = new ResizeObserver(() => {
      updateRailPosition();
      scheduleUpdate();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", updateRailPosition);
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [editor, isRailVisible, scrollContainerRef, sections, workspaceContent]);

  if (!isRailVisible) return null;

  function goToSection(section: NoteSection) {
    const container = scrollContainerRef.current;
    const node = editor.view.nodeDOM(section.position);
    if (!container || !(node instanceof HTMLElement)) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    container.scrollTo({
      top:
        container.scrollTop +
        nodeRect.top -
        containerRect.top -
        SECTION_SCROLL_OFFSET,
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
    setActiveId(section.id);
  }

  // Interaction adapted to Aska's note outline from beUI Preview Rail (MIT).
  const rail = (
    <div
      className={cn(
        "top-1/2 z-[60] hidden -translate-y-1/2 items-center lg:flex",
        workspaceContent ? "absolute" : "fixed",
      )}
      style={{ left: leftOffset }}
      onPointerEnter={() => setIsOutlineOpen(true)}
      onPointerLeave={() => {
        setIsOutlineOpen(false);
        setHoveredIndex(null);
      }}
      onFocusCapture={() => setIsOutlineOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOutlineOpen(false);
          setHoveredIndex(null);
        }
      }}
    >
      <nav
        aria-label="Note sections"
        className="flex max-h-[72dvh] w-9 [scrollbar-width:none] flex-col items-start overflow-y-auto py-1 [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section, index) => {
          const distance =
            hoveredIndex === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(index - hoveredIndex);
          const hoverScale =
            distance === 0
              ? 1
              : distance === 1
                ? 0.72
                : distance === 2
                  ? 0.48
                  : 0.3;
          const isActive = section.id === activeId;
          const isVisible = visibleSectionIdSet.has(section.id);
          const isHighlighted = isNotePreviewRailSectionHighlighted(
            index,
            hoveredIndex,
            isVisible,
          );

          return (
            <button
              key={section.id}
              type="button"
              aria-label={`Go to ${section.label}`}
              aria-current={isActive ? "location" : undefined}
              className="group flex h-3 w-7 shrink-0 items-center justify-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              onPointerEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              onClick={() => goToSection(section)}
            >
              <motion.span
                aria-hidden="true"
                animate={{
                  scaleX:
                    hoveredIndex === null ? (isActive ? 1 : 0.42) : hoverScale,
                }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.15,
                        ease: "easeOut",
                      }
                }
                className={cn(
                  "block h-0.5 w-4.5 origin-left bg-current",
                  isHighlighted
                    ? "text-sidebar-foreground"
                    : "text-sidebar-foreground/35",
                  section.level === 2 && "w-3.5",
                  section.level === 3 && "w-2.5",
                )}
              />
            </button>
          );
        })}
      </nav>
      {isOutlineOpen ? (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.15, ease: "easeOut" }
          }
          className="absolute top-1/2 left-9 max-h-[40dvh] w-72 -translate-y-1/2 rounded-lg border border-border bg-popover/95 p-1.5 text-popover-foreground shadow-lg backdrop-blur-xl"
        >
          <ScrollArea
            viewportClassName="h-auto max-h-[calc(40dvh-0.75rem)]"
            contentClassName="w-full"
            className="min-h-0 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:right-[-0.25rem] [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-2 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-0.5 [&_[data-slot=scroll-area-thumb]]:w-1 [&_[data-slot=scroll-area-thumb]]:bg-foreground/35"
          >
            <nav aria-label="Note outline" className="py-0.5">
              {sections.map((section, index) => {
                const isActive = section.id === activeId;

                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "flex w-full rounded-md py-2 pr-2 text-left text-sm leading-5 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      section.level === 1 && "pl-2",
                      section.level === 2 && "pl-5",
                      section.level >= 3 && "pl-8",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    onPointerEnter={() => setHoveredIndex(index)}
                    onFocus={() => setHoveredIndex(index)}
                    onClick={() => goToSection(section)}
                  >
                    <span className="min-w-0 break-words">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </motion.div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return rail;

  return createPortal(rail, workspaceContent ?? document.body);
}
