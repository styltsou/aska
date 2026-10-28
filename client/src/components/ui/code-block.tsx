import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import { cn } from "@/lib/utils";
import { DownloadIcon, WrapTextIcon } from "lucide-react";

const codeBlockVariants = cva(
  "group/code-block relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border text-sm text-sidebar-foreground has-[>[data-slot=code-block-content]:focus-visible]:ring-3 has-[>[data-slot=code-block-content]:focus-visible]:ring-ring/50 data-[size=sm]:text-xs",
  {
    variants: {
      variant: {
        default: "border-sidebar-border bg-background",
        destructive: "border-destructive/30 bg-destructive/5 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function CodeBlock({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof codeBlockVariants> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="code-block"
      data-variant={variant}
      data-size={size}
      className={cn(codeBlockVariants({ variant }), className)}
      {...props}
    />
  );
}

function CodeBlockHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-header"
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 bg-background p-2 text-sidebar-foreground/65 group-data-[size=sm]/code-block:px-2.5 group-data-[size=sm]/code-block:py-1.5",
        className,
      )}
      {...props}
    />
  );
}

function CodeBlockTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-title"
      className={cn(
        "min-w-0 truncate font-sans text-xs font-medium text-sidebar-foreground/65 [&_svg]:pointer-events-none [&_svg]:inline-block [&_svg]:align-middle [&_svg:not([class*='size-'])]:size-3.5 *:[svg]:me-1.5",
        className,
      )}
      {...props}
    />
  );
}

function CodeBlockActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-actions"
      className={cn(
        "-my-1 ms-auto -me-1.5 flex shrink-0 items-center gap-1 [[data-slot=code-block]>&]:absolute [[data-slot=code-block]>&]:end-2 [[data-slot=code-block]>&]:top-2 [[data-slot=code-block]>&]:z-10 [[data-slot=code-block]>&]:m-0 [[data-slot=code-block]>&]:opacity-0 [[data-slot=code-block]>&]:transition-opacity [[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 [[data-slot=code-block]>&]:group-hover/code-block:opacity-100 [[data-slot=code-block]>&]:pointer-coarse:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function CodeBlockCopyButton({
  value,
  variant = "ghost",
  size = "icon-sm",
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { value: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        data-slot="code-block-copy-button"
        data-copied={copied || undefined}
        variant={variant}
        size={size}
        aria-label={copied ? "Copied" : "Copy code"}
        className={cn(
          "text-sidebar-foreground/60 hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          void navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        {...props}
      >
        <CopyFeedbackIcon copied={copied} size={14} />
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

function CodeBlockWrapButton({
  wrap,
  onWrapChange,
  variant = "ghost",
  size = "icon-sm",
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  wrap: boolean;
  onWrapChange: (wrap: boolean) => void;
}) {
  return (
    <Button
      data-slot="code-block-wrap-button"
      variant={variant}
      size={size}
      aria-label="Wrap lines"
      aria-pressed={wrap}
      className={cn(
        "text-sidebar-foreground/60 hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        onWrapChange(!wrap);
      }}
      {...props}
    >
      <WrapTextIcon size={16} />
    </Button>
  );
}

function CodeBlockDownloadButton({
  value,
  fileName = "code.txt",
  variant = "ghost",
  size = "icon-sm",
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string;
  fileName?: string;
}) {
  return (
    <Button
      data-slot="code-block-download-button"
      variant={variant}
      size={size}
      aria-label="Download code"
      className={cn(
        "text-sidebar-foreground/60 hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        const url = URL.createObjectURL(
          new Blob([value], { type: "text/plain;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }}
      {...props}
    >
      <DownloadIcon size={16} />
    </Button>
  );
}

function CodeBlockContent({
  className,
  children,
  style,
  wrap = false,
  lineNumbers = false,
  startLine = 1,
  tabIndex = -1,
  ...props
}: React.ComponentProps<"pre"> & {
  wrap?: boolean;
  lineNumbers?: boolean;
  startLine?: number;
}) {
  return (
    <pre
      data-slot="code-block-content"
      data-wrap={wrap || undefined}
      data-numbered={lineNumbers || undefined}
      dir="ltr"
      tabIndex={tabIndex}
      style={{ counterReset: `line ${startLine - 1}`, ...style }}
      className={cn(
        "m-0 min-h-0 min-w-0 overflow-auto border-x-0 border-b-0 border-sidebar-border bg-card p-3 text-start font-mono leading-5 outline-none data-wrap:wrap-break-word data-wrap:whitespace-pre-wrap",
        className,
      )}
      {...props}
    >
      <code
        data-slot="code-block-code"
        className="block min-h-lh min-w-max in-data-numbered:grid in-data-numbered:content-start in-data-numbered:grid-cols-[auto_1fr] in-data-wrap:min-w-0"
      >
        {lineNumbers && typeof children === "string"
          ? children
              .replace(/\n$/, "")
              .split("\n")
              .map((line, index) => (
                <CodeBlockLine key={index}>{line}</CodeBlockLine>
              ))
          : children}
      </code>
    </pre>
  );
}

const codeBlockLineVariants = cva(
  "relative -mx-3 block min-h-lh px-3 before:min-w-6 before:text-end before:text-sidebar-foreground/45 after:absolute after:start-1 after:top-0 after:text-sidebar-foreground/45 after:select-none in-data-numbered:col-span-2 in-data-numbered:grid in-data-numbered:grid-cols-subgrid in-data-numbered:gap-x-3 in-data-numbered:[counter-increment:line] in-data-numbered:before:content-[counter(line)] in-data-numbered:before:select-none",
  {
    variants: {
      variant: {
        default: "",
        added: "bg-emerald-500/10 after:text-emerald-600 after:content-['+']",
        removed: "bg-destructive/10 after:text-destructive after:content-['−']",
        highlighted: "bg-sidebar-foreground/8",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function CodeBlockLine({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof codeBlockLineVariants>) {
  const empty =
    children === undefined ||
    children === null ||
    children === "" ||
    (Array.isArray(children) && children.length === 0);

  return (
    <span
      data-slot="code-block-line"
      data-variant={variant}
      className={cn(codeBlockLineVariants({ variant }), className)}
      {...props}
    >
      <span data-slot="code-block-line-content" className="min-w-0">
        {empty ? "\n" : children}
      </span>
    </span>
  );
}

function CodeBlockFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="code-block-footer"
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 bg-background px-3 pb-3 text-sidebar-foreground/65",
        className,
      )}
      {...props}
    />
  );
}

export {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockWrapButton,
  CodeBlockDownloadButton,
  CodeBlockContent,
  CodeBlockLine,
  CodeBlockFooter,
};
