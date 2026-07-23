import { useCallback, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import { hasSelectionModifier } from "@/lib/selection";
import type { NoteAsset } from "@/types/asset";

const BARE_URL_RE = /(^|[^(\[])(https?:\/\/[^\s<"'>)\]]+)/gi;

function linkifyBareUrls(text: string): string {
  return text.replace(
    BARE_URL_RE,
    (_, before, url) => `${before}[${url}](${url})`,
  );
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
  hr: ({ className, ...props }) => (
    <hr
      className={cn("border-sidebar-border my-4 border-t", className)}
      {...props}
    />
  ),
  pre: ({ children }) => <>{children}</>,
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

    return (
      <CodeBlock
        code={String(children).replace(/\n$/, "")}
        language={match[1] as Parameters<typeof CodeBlock>[0]["language"]}
        className="my-3"
      />
    );
  },
};

export function NoteMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown components={MD_COMPONENTS}>
        {linkifyBareUrls(content)}
      </ReactMarkdown>
    </div>
  );
}

export function NoteAssetCard({
  asset,
  onOpen,
}: {
  asset: NoteAsset;
  onOpen?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const effectiveOnOpen = hasOverflow ? onOpen : undefined;

  const updateOverflow = useCallback(() => {
    const card = cardRef.current;
    const content = contentRef.current;

    if (!card || !content) {
      return;
    }

    const cardStyles = getComputedStyle(card);
    const availableHeight =
      card.clientHeight -
      Number.parseFloat(cardStyles.paddingTop) -
      Number.parseFloat(cardStyles.paddingBottom);
    const contentStyles = getComputedStyle(content);
    const contentHeight =
      content.scrollHeight -
      Number.parseFloat(contentStyles.paddingTop) -
      Number.parseFloat(contentStyles.paddingBottom);

    setHasOverflow((current) => {
      const next = contentHeight > availableHeight + 1;
      return current === next ? current : next;
    });
  }, []);

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
    <div
      ref={cardRef}
      className={cn(
        "group bg-sidebar hover:border-sidebar-foreground/20 relative max-h-80 min-w-0 overflow-hidden rounded-lg border p-4 text-sm transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)]",
        effectiveOnOpen && "cursor-pointer",
      )}
      role={effectiveOnOpen ? "button" : undefined}
      tabIndex={effectiveOnOpen ? 0 : undefined}
      onClick={(event) => {
        if (!hasSelectionModifier(event)) effectiveOnOpen?.();
      }}
      onKeyDown={(event) => {
        if (!effectiveOnOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        effectiveOnOpen();
      }}
    >
      <div
        ref={contentRef}
        className={cn("min-w-0 break-words", hasOverflow && "pb-8")}
      >
        <NoteMarkdown content={asset.content} className="min-w-0" />
      </div>
      {hasOverflow ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-sidebar/0 via-sidebar/85 to-sidebar transition-opacity duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-60" />
      ) : null}
      {hasOverflow ? (
        <div className="invisible absolute inset-x-0 bottom-0 flex translate-y-2 justify-center px-2.5 pb-2.5 transition-transform duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:visible group-hover:translate-y-0">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-sidebar/70 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm">
            <span>Expand</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
