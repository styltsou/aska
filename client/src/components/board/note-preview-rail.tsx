import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type NoteSection = {
  id: string;
  label: string;
  description?: string;
  level: number;
  position: number;
};

const SECTION_SCROLL_OFFSET = 72;
const ACTIVE_SECTION_LINE = 0.28;
const MIN_SCROLLBAR_WIDTH = 4;
const PREVIEW_RAIL_GAP = 2;
const MIN_PREVIEW_RAIL_SECTIONS = 2;
const MIN_PREVIEW_RAIL_VIEWPORTS = 2;
const PREVIEW_RAIL_VISIBLE_ATTRIBUTE = "data-note-preview-rail-visible";

export function shouldShowNotePreviewRail(
  sectionCount: number,
  scrollHeight: number,
  clientHeight: number,
) {
  return (
    sectionCount >= MIN_PREVIEW_RAIL_SECTIONS &&
    clientHeight > 0 &&
    scrollHeight >= clientHeight * MIN_PREVIEW_RAIL_VIEWPORTS
  );
}

function getLayoutRight(element: HTMLElement) {
  let right = element.offsetLeft + element.offsetWidth;
  let parent = element.offsetParent;

  while (parent instanceof HTMLElement) {
    right += parent.offsetLeft;
    parent = parent.offsetParent;
  }

  return right;
}

function readSections(editor: Editor): NoteSection[] {
  const sections: NoteSection[] = [];
  const document = editor.state.doc;
  const blocks: Array<{ node: typeof document; position: number }> = [];

  document.forEach((node, position) => {
    blocks.push({ node, position });
  });

  blocks.forEach(({ node, position }, index) => {
    if (node.type.name !== "heading") return;

    let description = "";
    for (let nextIndex = index + 1; nextIndex < blocks.length; nextIndex += 1) {
      const nextNode = blocks[nextIndex]?.node;
      if (!nextNode || nextNode.type.name === "heading") break;
      if (!description && nextNode.isTextblock) {
        description = nextNode.textContent.trim();
      }
      if (description) break;
    }

    sections.push({
      id: `section-${position}`,
      label: node.textContent.trim() || "Untitled section",
      description:
        description.length > 120
          ? `${description.slice(0, 117).trimEnd()}...`
          : description || undefined,
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
        section.description === next[index]?.description &&
        section.level === next[index]?.level,
    )
  );
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [rightOffset, setRightOffset] = useState(
    MIN_SCROLLBAR_WIDTH + PREVIEW_RAIL_GAP,
  );
  const activeIdRef = useRef(activeId);

  activeIdRef.current = activeId;

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
      if (nextIsVisible) {
        container.setAttribute(PREVIEW_RAIL_VISIBLE_ATTRIBUTE, "true");
      } else {
        container.removeAttribute(PREVIEW_RAIL_VISIBLE_ATTRIBUTE);
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
      container.removeAttribute(PREVIEW_RAIL_VISIBLE_ATTRIBUTE);
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
      const nextOffset = Math.max(
        scrollbarWidth + PREVIEW_RAIL_GAP,
        Math.round(
          window.innerWidth -
            getLayoutRight(container) +
            scrollbarWidth +
            PREVIEW_RAIL_GAP,
        ),
      );
      setRightOffset((current) =>
        current === nextOffset ? current : nextOffset,
      );
    };
    const updateActiveSection = () => {
      frame = 0;
      const containerRect = container.getBoundingClientRect();
      const activeLine =
        containerRect.top + container.clientHeight * ACTIVE_SECTION_LINE;
      let nextActiveId = sections[0]?.id ?? "";

      for (const section of sections) {
        const node = editor.view.nodeDOM(section.position);
        if (!(node instanceof HTMLElement)) continue;
        if (node.getBoundingClientRect().top <= activeLine) {
          nextActiveId = section.id;
        } else {
          break;
        }
      }

      if (nextActiveId !== activeIdRef.current) {
        activeIdRef.current = nextActiveId;
        setActiveId(nextActiveId);
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
  }, [editor, isRailVisible, scrollContainerRef, sections]);

  if (!isRailVisible) return null;

  const previewSection =
    hoveredIndex === null ? undefined : sections[hoveredIndex];

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
      className="fixed top-1/2 z-[60] hidden -translate-y-1/2 items-center lg:flex"
      style={{ right: rightOffset }}
    >
      {previewSection ? (
        <motion.div
          key={previewSection.id}
          aria-hidden="true"
          initial={shouldReduceMotion ? false : { opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-none absolute right-12 w-64 rounded-lg border border-border bg-popover/95 px-3.5 py-3 text-popover-foreground shadow-lg backdrop-blur-xl"
        >
          <p className="truncate text-sm font-medium">{previewSection.label}</p>
          {previewSection.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {previewSection.description}
            </p>
          ) : null}
        </motion.div>
      ) : null}

      <nav
        aria-label="Note sections"
        className="flex max-h-[72dvh] w-9 [scrollbar-width:none] flex-col items-end overflow-y-auto py-1 [&::-webkit-scrollbar]:hidden"
        onPointerLeave={() => setHoveredIndex(null)}
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

          return (
            <button
              key={section.id}
              type="button"
              aria-label={`Go to ${section.label}`}
              aria-current={isActive ? "location" : undefined}
              className="group flex h-5 w-9 shrink-0 items-center justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
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
                        type: "spring",
                        stiffness: 360,
                        damping: 32,
                        mass: 0.6,
                      }
                }
                className={cn(
                  "block h-px w-7 origin-right bg-current",
                  isActive
                    ? "text-sidebar-foreground"
                    : "text-sidebar-foreground/35 group-hover:text-sidebar-foreground/65",
                  section.level === 2 && "w-6",
                  section.level === 3 && "w-5",
                )}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );

  return typeof document === "undefined"
    ? rail
    : createPortal(rail, document.body);
}
