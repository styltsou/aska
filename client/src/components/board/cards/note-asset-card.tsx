import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CopyIcon } from "lucide-react";
import { motion } from "motion/react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { common, createLowlight } from "lowlight";
import type { RootContent } from "hast";

import { parseFrontMatter } from "@/lib/front-matter";
import { cn } from "@/lib/utils";
import { hasSelectionModifier } from "@/lib/selection";
import { remarkHighlight } from "@/lib/remark-highlight";
import { useUpdateNote } from "@/api/collection/hooks";
import type { NoteAsset } from "@/types/asset";

const BARE_URL_RE = /(^|[^[(])(https?:\/\/[^\s<"'>)\]]+)/gi;
const CARD_MAX_HEIGHT = 320;
const EXPANSION_CONTROL_SPACE = 32;
const EXPANDED_BOTTOM_GUTTER = 8;
const lowlight = createLowlight(common);

function getMeasuredContentHeight(content: HTMLDivElement): number {
  let lastElement = content.lastElementChild;
  let trailingMargin = 0;

  while (lastElement) {
    const marginBottom = Number.parseFloat(
      getComputedStyle(lastElement).marginBottom,
    );
    if (Number.isFinite(marginBottom)) {
      trailingMargin = Math.max(trailingMargin, marginBottom);
    }
    lastElement = lastElement.lastElementChild;
  }

  return content.scrollHeight + trailingMargin;
}

function linkifyBareUrls(text: string): string {
  return text.replace(
    BARE_URL_RE,
    (_, before, url) => `${before}[${url}](${url})`,
  );
}

function renderHighlightedCode(
  nodes: RootContent[],
  keyPrefix = "code",
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;

    const className = Array.isArray(node.properties.className)
      ? node.properties.className.join(" ")
      : undefined;
    return createElement(
      node.tagName,
      { key, className },
      renderHighlightedCode(node.children, key),
    );
  });
}

function getCodeBlockLanguage(children: ReactNode): string {
  const code = Children.toArray(children).find(
    (child): child is ReactElement<{ className?: unknown }> =>
      isValidElement(child),
  );
  if (!code) return "Plain text";

  const className = code.props.className;
  const match =
    typeof className === "string" ? /language-(\w+)/.exec(className) : null;

  return match?.[1]
    ? match[1].replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Plain text";
}

const MD_COMPONENTS: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "text-sidebar-foreground mb-3 text-xl leading-tight font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "text-sidebar-foreground mt-4 mb-2 text-lg leading-snug font-semibold first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "text-sidebar-foreground mt-4 mb-1.5 text-base leading-snug font-semibold first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "text-sidebar-foreground mt-3 mb-1.5 text-base leading-snug font-semibold first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        "text-sidebar-foreground mt-3 mb-1 text-sm leading-snug font-semibold first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn(
        "text-sidebar-foreground mt-3 mb-1 text-sm leading-snug font-medium first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "text-sidebar-foreground/80 my-2.5 leading-6 first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "text-sidebar-foreground/80 marker:text-sidebar-foreground/35 my-3 ml-4 list-disc space-y-1.5",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "text-sidebar-foreground/80 marker:text-sidebar-foreground/35 my-3 ml-4 list-decimal space-y-1.5",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("pl-1 leading-6 [&>p]:my-0", className)} {...props} />
  ),
  input: ({ className, ...props }) => (
    <input
      className={cn("mr-2 size-3.5 accent-primary", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-primary hover:text-primary/75 font-medium break-words underline underline-offset-4 transition-colors duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]",
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("text-sidebar-foreground/65 my-3 pl-3 italic", className)}
      {...props}
    />
  ),
  mark: ({ className, ...props }) => (
    <mark
      className={cn(
        "rounded-[0.18em] bg-amber-200/75 px-[0.08em] text-inherit box-decoration-clone dark:bg-amber-400/30",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("border-sidebar-border my-4 border-t", className)}
      {...props}
    />
  ),
  pre: ({ children, ...props }) => (
    <div className="note-code-block note-code-block--preview">
      <div className="note-code-block-header" aria-hidden="true">
        <span className="note-code-block-language">
          {getCodeBlockLanguage(children)}
        </span>
        <span className="note-code-block-copy flex size-7 items-center justify-center">
          <CopyIcon className="size-3.5" />
        </span>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  ),
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const inline = !match;

    if (inline) {
      return (
        <code
          className={cn(
            "bg-muted text-sidebar-foreground rounded px-1 py-0.5 font-mono text-[0.8125rem] font-medium",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    const source = String(children).replace(/\n$/, "");
    const language = match[1];
    const highlighted = lowlight.listLanguages().includes(language)
      ? lowlight.highlight(language, source)
      : undefined;

    return (
      <code className={className} {...props}>
        {highlighted ? renderHighlightedCode(highlighted.children) : children}
      </code>
    );
  },
};

export function NoteMarkdown({
  content,
  className,
  previewScale,
}: {
  content: string;
  className?: string;
  previewScale?: number;
}) {
  const body = useMemo(() => parseFrontMatter(content).body, [content]);

  return (
    <div
      className={cn(
        "note-rich-text-content note-card-preview-content",
        previewScale === undefined
          ? "note-card-preview-content--card"
          : "note-card-preview-content--scaled",
        className,
      )}
      style={
        previewScale === undefined
          ? undefined
          : {
              width: `${100 / previewScale}%`,
              transform: `scale(${previewScale})`,
            }
      }
    >
      <ReactMarkdown
        components={MD_COMPONENTS}
        remarkPlugins={[remarkGfm, remarkHighlight]}
      >
        {linkifyBareUrls(body)}
      </ReactMarkdown>
    </div>
  );
}

export function NoteAssetCard({
  asset,
  workspaceSlug,
  onOpen,
  isContextMenuOpen = false,
}: {
  asset: NoteAsset;
  workspaceSlug?: string;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isPillDismissed, setIsPillDismissed] = useState(false);
  const [cardHeights, setCardHeights] = useState<{
    collapsed: number;
    expanded: number;
  }>();
  const isExpanded = asset.isExpanded ?? false;
  const effectiveOnOpen = onOpen;

  const updateNote = useUpdateNote(workspaceSlug ?? "");

  const toggleExpanded = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const next = !isExpanded;
    setIsPillDismissed(!next);
    if (workspaceSlug) {
      updateNote.mutate({ assetId: asset.id, isExpanded: next });
    }
  };

  const updateOverflow = useCallback(() => {
    const card = cardRef.current;
    const content = contentRef.current;

    if (!card || !content) {
      return;
    }

    const cardStyles = getComputedStyle(card);
    const verticalPadding =
      Number.parseFloat(cardStyles.paddingTop) +
      Number.parseFloat(cardStyles.paddingBottom);
    const borderHeight =
      Number.parseFloat(cardStyles.borderTopWidth) +
      Number.parseFloat(cardStyles.borderBottomWidth);
    const controlSpace =
      hasOverflow && !isExpanded ? EXPANSION_CONTROL_SPACE : 0;
    const expandedHeight =
      getMeasuredContentHeight(content) -
      controlSpace +
      verticalPadding +
      borderHeight +
      (hasOverflow ? EXPANDED_BOTTOM_GUTTER : 0);
    const collapsedHeight = Math.min(expandedHeight, CARD_MAX_HEIGHT);

    setHasOverflow((current) => {
      const next = expandedHeight > CARD_MAX_HEIGHT + 1;
      return current === next ? current : next;
    });
    setCardHeights((current) =>
      current?.collapsed === collapsedHeight &&
      current.expanded === expandedHeight
        ? current
        : { collapsed: collapsedHeight, expanded: expandedHeight },
    );
  }, [hasOverflow, isExpanded]);

  useLayoutEffect(() => {
    updateOverflow();

    const resizeObserver = new ResizeObserver(updateOverflow);

    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [asset.content, updateOverflow]);

  return (
    <motion.div
      ref={cardRef}
      animate={
        cardHeights
          ? {
              height: isExpanded ? cardHeights.expanded : cardHeights.collapsed,
            }
          : undefined
      }
      transition={{
        height: {
          duration: 0.15,
          ease: [0.4, 0, 0.2, 1],
        },
      }}
      className={cn(
        "group bg-sidebar hover:border-sidebar-foreground/20 relative min-w-0 overflow-hidden rounded-lg border px-4 py-2.5 text-sm transition-[border-color,background-color,filter,opacity] duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]",
        !cardHeights && !isExpanded && "max-h-80",
        isExpanded && "z-20",
        effectiveOnOpen && "cursor-pointer",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
      role={effectiveOnOpen ? "button" : undefined}
      tabIndex={effectiveOnOpen ? 0 : undefined}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("a[href]")
        ) {
          return;
        }
        if (!hasSelectionModifier(event)) effectiveOnOpen?.();
      }}
      onKeyDown={(event) => {
        if (!effectiveOnOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        effectiveOnOpen();
      }}
      onMouseEnter={() => setIsPillDismissed(false)}
    >
      <div
        ref={contentRef}
        className={cn(
          "note-rich-text-content min-w-0 break-words",
          hasOverflow && !isExpanded && "pb-8",
        )}
      >
        <NoteMarkdown content={asset.content} className="min-w-0" />
      </div>
      {hasOverflow && !isExpanded ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-sidebar/0 via-sidebar/85 to-sidebar transition-opacity duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-60" />
      ) : null}
      {hasOverflow ? (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5 transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isPillDismissed
              ? "pointer-events-none translate-y-full"
              : "pointer-events-none translate-y-full group-hover:pointer-events-auto group-hover:translate-y-0",
          )}
        >
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-sidebar-foreground/10 bg-sidebar/60 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20 hover:bg-sidebar hover:ring-1 hover:ring-sidebar-foreground/25 focus-visible:border-sidebar-foreground/20 focus-visible:bg-sidebar focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-expanded={isExpanded}
            onClick={toggleExpanded}
          >
            <span>{isExpanded ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
