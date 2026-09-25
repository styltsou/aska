import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  Maximize2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDiagramPreview } from "./note-mermaid-preview";

const DiagramCodeEditor = lazy(() =>
  import("./diagram-code-editor").then((module) => ({
    default: module.DiagramCodeEditor,
  })),
);

async function downloadPng(svg: string) {
  const image = new Image();
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    image.src = url;
    await image.decode();
    const box = new DOMParser().parseFromString(
      svg,
      "image/svg+xml",
    ).documentElement;
    const viewBox = box
      .getAttribute("viewBox")
      ?.split(/[\s,]+/)
      .map(Number);
    const width = Math.min(
      4096,
      Math.max(
        1,
        viewBox?.[2] ||
          Number.parseFloat(box.getAttribute("width") ?? "") ||
          960,
      ),
    );
    const height = Math.min(
      4096,
      Math.max(
        1,
        viewBox?.[3] ||
          Number.parseFloat(box.getAttribute("height") ?? "") ||
          600,
      ),
    );
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.scale(2, 2);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("Unable to export PNG.")),
        "image/png",
      ),
    );
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "diagram.png";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function MermaidBlockView({
  node,
  updateAttributes,
  deleteNode,
  editor,
}: ReactNodeViewProps) {
  const source = typeof node.attrs.source === "string" ? node.attrs.source : "";
  const [showInlineCode, setShowInlineCode] = useState(false);
  const [fullView, setFullView] = useState(false);
  const [showCodePane, setShowCodePane] = useState(true);
  const [copied, setCopied] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement>();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const fullViewRef = useRef<HTMLDivElement>(null);
  const { svg, error } = useDiagramPreview(source);

  useEffect(() => {
    const wrapper = editor.view.dom;
    setPortalTarget(
      wrapper.closest<HTMLElement>(
        "[data-slot='note-workspace-content'], [data-slot='dialog-content']",
      ) ?? document.body,
    );
  }, [editor]);

  useEffect(() => {
    if (!fullView) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setFullView(false);
      window.requestAnimationFrame(() => openButtonRef.current?.focus());
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [fullView]);

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy Mermaid source.");
    }
  }

  function exportPng() {
    if (!svg) return;
    void downloadPng(svg).catch(() => toast.error("Unable to export diagram."));
  }

  return (
    <NodeViewWrapper
      className="note-mermaid-block"
      data-type="mermaid-block"
      contentEditable={false}
    >
      <div className="note-mermaid-toolbar">
        <span className="note-mermaid-label">Mermaid diagram</span>
        <div className="note-mermaid-actions">
          {showInlineCode ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copied ? "Copied source" : "Copy Mermaid source"}
              onClick={() => void copySource()}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Download PNG"
              disabled={!svg}
              onClick={exportPng}
            >
              <DownloadIcon />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={showInlineCode ? "Show diagram" : "Edit Mermaid code"}
            onClick={() => setShowInlineCode(!showInlineCode)}
          >
            {showInlineCode ? <EyeIcon /> : <CodeIcon />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open diagram full view"
            ref={openButtonRef}
            onClick={() => {
              setShowCodePane(true);
              setFullView(true);
            }}
          >
            <Maximize2Icon />
          </Button>
          {editor.isEditable ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete diagram"
              onClick={deleteNode}
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
      </div>
      {showInlineCode ? (
        <textarea
          className="note-mermaid-inline-source"
          aria-label="Mermaid source"
          spellCheck={false}
          value={source}
          onChange={(event) => updateAttributes({ source: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
          readOnly={!editor.isEditable}
        />
      ) : (
        <div
          className="note-mermaid-preview"
          onDoubleClick={() => setFullView(true)}
        >
          {svg ? (
            <div
              className="note-mermaid-svg"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <span className="note-mermaid-message">
              {error ??
                (source.trim() ? "Rendering diagram…" : "Empty diagram")}
            </span>
          )}
        </div>
      )}
      {error ? (
        <div className="note-mermaid-error" role="status">
          {error}
        </div>
      ) : null}
      {fullView && portalTarget
        ? createPortal(
            <div
              ref={fullViewRef}
              className="note-mermaid-full"
              role="dialog"
              aria-modal="true"
              aria-label="Mermaid diagram editor"
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key !== "Tab") return;
                const focusable =
                  fullViewRef.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), [contenteditable="true"], [tabindex="0"]',
                  );
                if (!focusable?.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }}
            >
              <div className="note-mermaid-full-header">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close diagram view"
                  onClick={() => {
                    setFullView(false);
                    window.requestAnimationFrame(() =>
                      openButtonRef.current?.focus(),
                    );
                  }}
                >
                  <XIcon />
                </Button>
                <span className="note-mermaid-label">Mermaid diagram</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCodePane(!showCodePane)}
                >
                  {showCodePane ? (
                    <PanelLeftCloseIcon />
                  ) : (
                    <PanelLeftOpenIcon />
                  )}
                  {showCodePane ? "Hide code" : "Show code"}
                </Button>
                <div className="note-mermaid-full-header-spacer" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copied ? "Copied source" : "Copy Mermaid source"}
                  onClick={() => void copySource()}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Download PNG"
                  disabled={!svg}
                  onClick={exportPng}
                >
                  <DownloadIcon />
                </Button>
              </div>
              <div className="note-mermaid-full-body">
                {showCodePane ? (
                  <div className="note-mermaid-source-pane">
                    <div className="note-mermaid-pane-label">Source</div>
                    <Suspense
                      fallback={
                        <div className="note-mermaid-message">
                          Loading editor…
                        </div>
                      }
                    >
                      <DiagramCodeEditor
                        value={source}
                        readOnly={!editor.isEditable}
                        onChange={(value) => {
                          if (editor.isEditable)
                            updateAttributes({ source: value });
                        }}
                      />
                    </Suspense>
                    {error ? (
                      <div className="note-mermaid-error" role="status">
                        {error}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="note-mermaid-canvas-pane">
                  <TransformWrapper
                    initialScale={1}
                    minScale={0.1}
                    maxScale={10}
                    centerOnInit
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        <TransformComponent
                          wrapperStyle={{ width: "100%", height: "100%" }}
                          contentStyle={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {svg ? (
                            <div
                              className="note-mermaid-full-svg note-mermaid-svg"
                              dangerouslySetInnerHTML={{ __html: svg }}
                            />
                          ) : (
                            <span className="note-mermaid-message">
                              {error ??
                                (source.trim()
                                  ? "Rendering diagram…"
                                  : "Empty diagram")}
                            </span>
                          )}
                        </TransformComponent>
                        <div className="note-mermaid-zoom-controls">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Zoom in"
                            onClick={() => zoomIn()}
                          >
                            <ZoomInIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Zoom out"
                            onClick={() => zoomOut()}
                          >
                            <ZoomOutIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Reset zoom"
                            onClick={() => resetTransform()}
                          >
                            <RotateCcwIcon />
                          </Button>
                        </div>
                      </>
                    )}
                  </TransformWrapper>
                </div>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </NodeViewWrapper>
  );
}

export const NoteMermaidBlock = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,
  draggable: true,
  priority: 1000,
  addAttributes() {
    return {
      source: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-source") ?? "",
        renderHTML: (attributes: { source?: string }) => ({
          "data-source": attributes.source ?? "",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "mermaid-block", ...HTMLAttributes }];
  },
  markdownTokenName: "code",
  parseMarkdown: (token, helpers) => {
    if (
      token.lang?.trim().toLowerCase() !== "mermaid" ||
      !(token.raw?.startsWith("```") || token.raw?.startsWith("~~~"))
    )
      return [];
    return helpers.createNode("mermaidBlock", { source: token.text ?? "" });
  },
  renderMarkdown: (node) => {
    const source = String(node.attrs?.source ?? "");
    const longestFence = Math.max(
      3,
      ...Array.from(source.matchAll(/`+/g), (match) => match[0].length + 1),
    );
    const fence = "`".repeat(longestFence);
    return `${fence}mermaid\n${source.replace(/\n$/, "")}\n${fence}`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  },
});
