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
const OUTLINE_CLOSE_DELAY = 250;
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
  const [isPointerInteraction, setIsPointerInteraction] = useState(false);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);
  const activeIdRef = useRef(activeId);
  const visibleSectionIdsRef = useRef(visibleSectionIds);
  const railRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  activeIdRef.current = activeId;
  visibleSectionIdsRef.current = visibleSectionIds;

  const visibleSectionIdSet = useMemo(
    () => new Set(visibleSectionIds),
    [visibleSectionIds],
  );

  function cancelOutlineClose() {
    if (closeTimerRef.current === undefined) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  }

  function closeOutline() {
    cancelOutlineClose();
    setIsOutlineOpen(false);
    setHoveredIndex(null);
  }

  function scheduleOutlineClose() {
    cancelOutlineClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = undefined;
      if (railRef.current?.contains(document.activeElement)) return;
      setIsOutlineOpen(false);
      setHoveredIndex(null);
    }, OUTLINE_CLOSE_DELAY);
  }

  useEffect(
    () => () => {
      if (closeTimerRef.current !== undefined)
        window.clearTimeout(closeTimerRef.current);
    },
    [],
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

    setRailHost(container.closest<HTMLElement>("[data-slot='scroll-area']"));

    return () => setRailHost(null);
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

    updateActiveSection();
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    resizeObserver.observe(editor.view.dom);

    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [editor, isRailVisible, scrollContainerRef, sections]);

  if (!isRailVisible || !railHost) return null;

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

  // Interaction adapted to Mnemee's note outline from beUI Preview Rail (MIT).
  const rail = (
    <div
      ref={railRef}
      className="note-preview-rail absolute top-1/2 left-[6px] z-[60] flex -translate-y-1/2 items-center"
      onPointerEnter={cancelOutlineClose}
      onPointerLeave={scheduleOutlineClose}
      onFocusCapture={(event) => {
        cancelOutlineClose();
        if (event.target.matches(":focus-visible"))
          setIsPointerInteraction(false);
        setIsOutlineOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeOutline();
        }
      }}
    >
      <nav
        aria-label="Note sections"
        className="note-preview-rail-sections flex max-h-[72dvh] w-6 [scrollbar-width:none] flex-col items-start overflow-y-auto py-1 [&::-webkit-scrollbar]:hidden"
        onPointerEnter={(event) => {
          cancelOutlineClose();
          setIsPointerInteraction(event.pointerType === "mouse");
          setIsOutlineOpen(true);
        }}
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
              className="note-preview-rail-section group flex h-3 w-6 shrink-0 items-center justify-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              onPointerEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              onClick={() => goToSection(section)}
            >
              <motion.span
                aria-hidden="true"
                data-level={Math.min(section.level, 3)}
                initial={false}
                animate={{
                  transform: `scaleX(${hoveredIndex === null ? 0.5 : hoverScale})`,
                }}
                transition={
                  shouldReduceMotion || !isPointerInteraction
                    ? { duration: 0 }
                    : {
                        duration: 0.1,
                        ease: [0.23, 1, 0.32, 1],
                      }
                }
                className={cn(
                  "note-preview-rail-mark block h-0.5 origin-left",
                  section.level === 1
                    ? "w-5"
                    : section.level === 2
                      ? "w-4"
                      : "w-3.5",
                  isHighlighted ? "bg-primary" : "bg-muted-foreground/70",
                )}
              />
            </button>
          );
        })}
      </nav>
      {isOutlineOpen ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-full w-2"
          />
          <motion.div
            initial={
              shouldReduceMotion || !isPointerInteraction
                ? false
                : { opacity: 0, transform: "scale(0.98)" }
            }
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={
              shouldReduceMotion || !isPointerInteraction
                ? { duration: 0 }
                : { duration: 0.12, ease: [0.23, 1, 0.32, 1] }
            }
            className="absolute top-1/2 left-[calc(100%+0.5rem)] max-h-[40dvh] w-[min(18rem,calc(100cqw-3.5rem))] origin-left -translate-y-1/2 rounded-lg border-border/60 bg-background/95 p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-xl"
          >
            <ScrollArea
              viewportClassName="h-auto max-h-[calc(40dvh-0.75rem)]"
              contentClassName="w-full pr-3"
              className="-mr-1 min-h-0 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-2 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-0.5 [&_[data-slot=scroll-area-thumb]]:w-1"
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
                      <span className="min-w-0 break-words">
                        {section.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </motion.div>
        </>
      ) : null}
    </div>
  );

  return createPortal(rail, railHost);
}
