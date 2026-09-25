import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BoardInsertionPlacement } from "@/api/collection";
import type { DiagramAsset } from "@/types/asset";
import {
  createDiagram,
  createInboxDiagram,
  updateDiagram,
} from "@/api/collection/fetchers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DIAGRAM_TEMPLATES, renderDiagram } from "@/lib/diagram";

const CodeEditor = lazy(() =>
  import("./diagram-code-editor").then((m) => ({
    default: m.DiagramCodeEditor,
  })),
);
const DEFAULT_SOURCE = DIAGRAM_TEMPLATES[0].source;

type Props = {
  workspaceSlug: string;
  collectionPath?: string;
  target?: "collection" | "inbox";
  placement?: BoardInsertionPlacement;
  diagram?: DiagramAsset;
  initialSource?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function draftKey(workspaceSlug: string, id: string) {
  return `aska.diagram-draft:${workspaceSlug}:${id}`;
}

function newDraftKey(
  workspaceSlug: string,
  target: string,
  collectionPath?: string,
) {
  return draftKey(workspaceSlug, `new:${target}:${collectionPath ?? ""}`);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function safeName(title?: string | null) {
  return (title?.trim() || "diagram")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .slice(0, 80);
}

export function DiagramEditorDialog(props: Props) {
  if (!props.open) return null;
  return <DiagramEditorSession {...props} />;
}

function DiagramEditorSession({
  workspaceSlug,
  collectionPath,
  target = "collection",
  placement,
  diagram,
  initialSource,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [source, setSource] = useState(() => {
    if (diagram)
      return (
        sessionStorage.getItem(draftKey(workspaceSlug, diagram.id)) ??
        diagram.source
      );
    return (
      initialSource ??
      sessionStorage.getItem(
        newDraftKey(workspaceSlug, target, collectionPath),
      ) ??
      DEFAULT_SOURCE
    );
  });
  const [title, setTitle] = useState(diagram?.title ?? "");
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const [valid, setValid] = useState(false);
  const [validatedSource, setValidatedSource] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<"code" | "preview">("preview");
  const [createdId, setCreatedId] = useState<string>();
  const savedRef = useRef({
    source: diagram?.source ?? "",
    title: diagram?.title ?? "",
  });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const currentSourceRef = useRef(source);
  currentSourceRef.current = source;
  const id = diagram?.id ?? createdId;
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      renderDiagram(source, dark).then(
        (next) => {
          if (active) {
            setSvg(next);
            setError(undefined);
            setValid(true);
            setValidatedSource(source);
          }
        },
        (reason: unknown) => {
          if (active) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to render diagram.",
            );
            setValid(false);
            setValidatedSource(source);
          }
        },
      );
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source, dark]);

  useEffect(() => {
    const key = id
      ? draftKey(workspaceSlug, id)
      : newDraftKey(workspaceSlug, target, collectionPath);
    if (source !== (id ? savedRef.current.source : DEFAULT_SOURCE))
      sessionStorage.setItem(key, source);
    else sessionStorage.removeItem(key);
  }, [id, source, workspaceSlug, target, collectionPath]);

  useEffect(() => {
    if (
      !id ||
      !valid ||
      validatedSource !== source ||
      (source === savedRef.current.source && title === savedRef.current.title)
    )
      return;
    const snapshot = { source, title };
    const timer = setTimeout(() => {
      queueRef.current = queueRef.current.then(async () => {
        if (
          snapshot.source === savedRef.current.source &&
          snapshot.title === savedRef.current.title
        )
          return;
        setSaving(true);
        try {
          await updateDiagram(workspaceSlug, id, {
            source: snapshot.source,
            title: snapshot.title.trim() || null,
          });
          savedRef.current = snapshot;
          if (currentSourceRef.current === snapshot.source)
            sessionStorage.removeItem(draftKey(workspaceSlug, id));
          await queryClient.invalidateQueries({
            predicate: ({ queryKey }) => queryKey[1] === workspaceSlug,
          });
        } catch (reason) {
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Unable to save diagram.",
          );
        } finally {
          setSaving(false);
        }
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [id, source, title, valid, validatedSource, workspaceSlug, queryClient]);

  async function create() {
    if (!valid || validatedSource !== source || !source.trim()) return;
    setSaving(true);
    try {
      const data = {
        source,
        title: title.trim() || null,
        frameWidth: 480,
        frameHeight: 320,
      };
      const result =
        target === "inbox"
          ? await createInboxDiagram(workspaceSlug, data)
          : await createDiagram(
              workspaceSlug,
              collectionPath?.split("/")[0] ?? "",
              {
                ...data,
                parentFolderPath:
                  collectionPath?.split("/").slice(1).join("/") || undefined,
                position: placement?.position,
              },
            );
      savedRef.current = { source, title };
      sessionStorage.removeItem(
        newDraftKey(workspaceSlug, target, collectionPath),
      );
      setCreatedId(result.diagram.id);
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[1] === workspaceSlug,
      });
      toast.success("Diagram created");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Unable to create diagram.",
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadSvg() {
    if (!svg) return;
    saveBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${safeName(title)}.svg`,
    );
  }

  async function downloadPng() {
    if (!svg) return;
    try {
      const image = new Image();
      const url = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml" }),
      );
      try {
        image.src = url;
        await image.decode();
        const viewBox = new DOMParser()
          .parseFromString(svg, "image/svg+xml")
          .documentElement.getAttribute("viewBox")
          ?.split(/[\s,]+/)
          .map(Number);
        const width = Math.max(1, viewBox?.[2] || image.naturalWidth || 480);
        const height = Math.max(1, viewBox?.[3] || image.naturalHeight || 320);
        const scale = Math.min(2, 4096 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to export PNG.");
        context.fillStyle = dark ? "#242529" : "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const png = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(new Error("Unable to export PNG.")),
            "image/png",
          ),
        );
        saveBlob(png, `${safeName(title)}.png`);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Unable to export PNG.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-2 flex h-[calc(100dvh-1rem)] w-[calc(100dvw-1rem)] max-w-none flex-col bg-background p-0 sm:top-6 sm:h-[calc(100dvh-3rem)] sm:w-[calc(100dvw-3rem)]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {diagram ? "Edit diagram" : "New diagram"}
        </DialogTitle>
        <header className="flex min-h-14 items-center gap-3 border-b px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close diagram editor"
            onClick={() => onOpenChange(false)}
          >
            <XIcon />
          </Button>
          <Input
            aria-label="Diagram title"
            placeholder="Untitled diagram"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-8 max-w-60 border-0 bg-transparent shadow-none"
            maxLength={255}
          />
          <span
            className="ml-auto hidden text-xs text-muted-foreground sm:inline"
            aria-live="polite"
          >
            {saving
              ? "Saving…"
              : error
                ? "Fix syntax to save"
                : id
                  ? "Saved"
                  : "Ready to create"}
          </span>
          {!id ? (
            <Button
              size="sm"
              disabled={!valid || validatedSource !== source || saving}
              onClick={() => void create()}
            >
              <PlusIcon /> Create diagram
            </Button>
          ) : null}
        </header>
        <div className="flex gap-1 border-b px-4 py-2 sm:hidden">
          <Button
            size="sm"
            variant={mobileTab === "preview" ? "secondary" : "ghost"}
            onClick={() => setMobileTab("preview")}
          >
            Preview
          </Button>
          <Button
            size="sm"
            variant={mobileTab === "code" ? "secondary" : "ghost"}
            onClick={() => setMobileTab("code")}
          >
            Code
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[42%_58%]">
          <section
            className={`${mobileTab === "code" ? "flex" : "hidden"} min-h-0 flex-col border-r sm:flex`}
          >
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <label className="text-xs font-medium">Mermaid source</label>
              <select
                aria-label="Insert template"
                className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
                value=""
                onChange={(event) => {
                  const template = DIAGRAM_TEMPLATES.find(
                    (item) => item.name === event.target.value,
                  );
                  if (template) setSource(template.source);
                }}
              >
                <option value="">Templates…</option>
                {DIAGRAM_TEMPLATES.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-background">
              <Suspense
                fallback={
                  <textarea
                    className="size-full resize-none p-4 font-mono text-sm"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    aria-label="Mermaid source"
                  />
                }
              >
                <CodeEditor value={source} onChange={setSource} />
              </Suspense>
            </div>
            {error ? (
              <p
                role="alert"
                className="max-h-24 overflow-auto border-t bg-destructive/8 px-4 py-2 font-mono text-xs text-destructive"
              >
                {error}
              </p>
            ) : null}
          </section>
          <section
            className={`${mobileTab === "preview" ? "flex" : "hidden"} min-h-0 flex-col sm:flex`}
          >
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <span className="text-xs font-medium">Preview</span>
              {error ? (
                <span className="text-xs text-destructive">
                  Showing last valid diagram
                </span>
              ) : null}
              <div className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(source)
                      .then(() => toast.success("Copied Mermaid source"))
                      .catch(() =>
                        toast.error("Unable to copy Mermaid source."),
                      )
                  }
                >
                  <CopyIcon /> Copy code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!svg}
                  onClick={downloadSvg}
                >
                  <DownloadIcon /> SVG
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!svg}
                  onClick={() => void downloadPng()}
                >
                  <DownloadIcon /> PNG
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/35 p-8">
              {svg ? (
                <div
                  className="flex max-h-full max-w-full items-center justify-center [&_svg]:max-h-[calc(100dvh-13rem)] [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Rendering preview…
                </span>
              )}
            </div>
            <footer className="flex min-h-10 items-center gap-2 border-t px-4 text-xs text-muted-foreground">
              {valid ? <CheckIcon className="size-3.5" /> : null}
              <span>
                {valid
                  ? "Diagram renders correctly"
                  : error
                    ? "Check the source for a syntax error"
                    : "Rendering…"}
              </span>
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
