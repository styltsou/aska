import { getMarkRange, type Editor } from "@tiptap/core";
import { PenLineIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ActiveNoteLink = {
  anchor: HTMLAnchorElement;
  href: string;
};

export function LinkInteractionPopover({ editor }: { editor: Editor }) {
  const [hoveredLink, setHoveredLink] = useState<ActiveNoteLink | null>(null);
  const [editingLink, setEditingLink] = useState<ActiveNoteLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const closeTimerRef = useRef<
    ReturnType<typeof window.setTimeout> | undefined
  >(undefined);
  const copiedResetRef = useRef<
    ReturnType<typeof window.setTimeout> | undefined
  >(undefined);
  const hoverCardRef = useRef<HTMLDivElement>(null);

  function cancelClose() {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }

  function resetCopied() {
    if (copiedResetRef.current !== undefined) {
      window.clearTimeout(copiedResetRef.current);
      copiedResetRef.current = undefined;
    }
    setCopied(false);
  }

  function closeHoverCard() {
    cancelClose();
    resetCopied();
    setHoveredLink(null);
  }

  function closeEditor() {
    setEditingLink(null);
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = window.setTimeout(closeHoverCard, 120);
  }

  useEffect(() => {
    const editorElement = editor.view.dom;

    function anchorFromEventTarget(target: EventTarget | null) {
      const element = target instanceof Element ? target : null;
      const anchor = element?.closest("a[href]");
      return anchor instanceof HTMLAnchorElement ? anchor : null;
    }

    function isInsideLinkOrCard(target: EventTarget | null) {
      if (!(target instanceof Node)) return false;
      return Boolean(
        hoveredLink?.anchor.contains(target) ||
        hoverCardRef.current?.contains(target),
      );
    }

    function showLink(anchor: HTMLAnchorElement) {
      if (editingLink) return;
      const nextHref = anchor.getAttribute("href");
      if (!nextHref) return;
      cancelClose();
      if (hoveredLink?.anchor !== anchor || hoveredLink.href !== nextHref) {
        resetCopied();
      }
      setHoveredLink((current) => {
        if (current?.anchor === anchor && current.href === nextHref) {
          return current;
        }
        return { anchor, href: nextHref };
      });
    }

    function handlePointerOver(event: PointerEvent) {
      const anchor = anchorFromEventTarget(event.target);
      if (anchor) showLink(anchor);
    }

    function handlePointerOut(event: PointerEvent) {
      if (!anchorFromEventTarget(event.target)) return;
      if (!isInsideLinkOrCard(event.relatedTarget)) scheduleClose();
    }

    function handleFocusIn(event: FocusEvent) {
      const anchor = anchorFromEventTarget(event.target);
      if (anchor) showLink(anchor);
    }

    function handleFocusOut(event: FocusEvent) {
      if (!anchorFromEventTarget(event.target)) return;
      if (!isInsideLinkOrCard(event.relatedTarget)) scheduleClose();
    }

    editorElement.addEventListener("pointerover", handlePointerOver);
    editorElement.addEventListener("pointerout", handlePointerOut);
    editorElement.addEventListener("focusin", handleFocusIn);
    editorElement.addEventListener("focusout", handleFocusOut);
    return () => {
      cancelClose();
      resetCopied();
      editorElement.removeEventListener("pointerover", handlePointerOver);
      editorElement.removeEventListener("pointerout", handlePointerOut);
      editorElement.removeEventListener("focusin", handleFocusIn);
      editorElement.removeEventListener("focusout", handleFocusOut);
    };
  }, [editingLink, editor, hoveredLink]);

  function getLinkRange(link: ActiveNoteLink | null) {
    if (!link || !link.anchor.isConnected) return undefined;
    const linkType = editor.schema.marks.link;
    if (!linkType) return undefined;

    try {
      const position = editor.view.posAtDOM(link.anchor, 0);
      return getMarkRange(editor.state.doc.resolve(position), linkType, {
        href: link.href,
      });
    } catch {
      return undefined;
    }
  }

  function beginEditing() {
    const range = getLinkRange(hoveredLink);
    if (!range || !hoveredLink) {
      closeHoverCard();
      return;
    }

    setLabel(editor.state.doc.textBetween(range.from, range.to));
    setHref(hoveredLink.href);
    setEditingLink(hoveredLink);
    setHoveredLink(null);
  }

  function copyLink() {
    if (!hoveredLink) return;
    if (typeof navigator.clipboard?.writeText !== "function") {
      toast.error("Clipboard is not available.");
      return;
    }

    void navigator.clipboard
      .writeText(hoveredLink.href)
      .then(() => {
        setCopied(true);
        if (copiedResetRef.current !== undefined) {
          window.clearTimeout(copiedResetRef.current);
        }
        copiedResetRef.current = window.setTimeout(() => {
          copiedResetRef.current = undefined;
          setCopied(false);
        }, 1600);
        toast.success("Copied link.");
      })
      .catch(() => toast.error("Unable to copy link."));
  }

  function saveLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const range = getLinkRange(editingLink);
    const nextLabel = label.trim();
    const nextHref = href.trim();
    if (!range || !nextLabel || !nextHref) return;

    const sourceNode = editor.state.doc.resolve(range.from).nodeAfter;
    const preservedMarks =
      sourceNode?.marks
        .filter((mark) => mark.type.name !== "link")
        .map((mark) => ({ type: mark.type.name, attrs: mark.attrs })) ?? [];
    const selectionEnd = range.from + nextLabel.length;
    const saved = editor
      .chain()
      .focus()
      .insertContentAt(
        range,
        { type: "text", text: nextLabel, marks: preservedMarks },
        { updateSelection: false },
      )
      .setTextSelection({ from: range.from, to: selectionEnd })
      .setLink({ href: nextHref })
      .setTextSelection(selectionEnd)
      .run();

    if (!saved) {
      toast.error("Enter a valid link.");
      return;
    }
    closeEditor();
  }

  return (
    <>
      {hoveredLink ? (
        <Popover
          open
          onOpenChange={(open) => !open && closeHoverCard()}
          modal={false}
        >
          <PopoverContent
            anchor={hoveredLink.anchor}
            side="top"
            sideOffset={8}
            className="w-auto max-w-[calc(100vw-2rem)] rounded-xl border-border/60 bg-background/95 px-1.5 py-1 shadow-md ring-1 ring-foreground/10 backdrop-blur-xl"
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            <div ref={hoverCardRef} className="flex items-center gap-2">
              <span
                className="block max-w-56 min-w-0 flex-1 truncate px-1.5 py-1 text-xs leading-5 text-foreground"
                title={hoveredLink.href}
              >
                {hoveredLink.href}
              </span>
              <div className="flex items-center gap-0">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 rounded-md hover:bg-accent"
                        aria-label={copied ? "Copied link" : "Copy link"}
                        onClick={copyLink}
                      >
                        <CopyFeedbackIcon copied={copied} className="size-3" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {copied ? "Copied" : "Copy link"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 rounded-md hover:bg-accent"
                        aria-label="Edit link"
                        onClick={beginEditing}
                      >
                        <PenLineIcon className="size-3" />
                      </Button>
                    }
                  />
                  <TooltipContent>Edit link</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      {editingLink ? (
        <Popover
          open
          onOpenChange={(open) => !open && closeEditor()}
          modal={false}
        >
          <PopoverContent
            anchor={editingLink.anchor}
            side="top"
            sideOffset={8}
            className="w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-xl border-border/60 bg-background/95 p-1.5 shadow-md ring-1 ring-foreground/10 backdrop-blur-xl"
          >
            <form className="grid gap-2" onSubmit={saveLink}>
              <label className="grid gap-1 px-1 text-xs font-medium text-muted-foreground">
                Label
                <input
                  autoFocus
                  className="h-8 rounded-md border border-border/70 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="Link text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeEditor();
                    }
                  }}
                />
              </label>
              <label className="grid gap-1 px-1 text-xs font-medium text-muted-foreground">
                Destination URL
                <input
                  className="h-8 rounded-md border border-border/70 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="https://example.com"
                  value={href}
                  onChange={(event) => setHref(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeEditor();
                    }
                  }}
                />
              </label>
              <div className="flex justify-end gap-1 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={closeEditor}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!label.trim() || !href.trim()}
                >
                  Save
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
}
