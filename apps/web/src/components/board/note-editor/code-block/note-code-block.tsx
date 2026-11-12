import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CodeBlockDownloadButton,
  CodeBlockWrapButton,
} from "@/components/ui/code-block";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CODE_BLOCK_LANGUAGES = [
  { value: "", label: "Plain text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
];

const CODE_BLOCK_FILE_EXTENSIONS: Record<string, string> = {
  bash: "sh",
  csharp: "cs",
  cpp: "cpp",
  javascript: "js",
  typescript: "ts",
  yaml: "yml",
};

function codeBlockFileName(language: string) {
  const extension = CODE_BLOCK_FILE_EXTENSIONS[language] ?? language;
  return `code.${extension || "txt"}`;
}

export function NoteCodeBlock({
  editor,
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const [wrap, setWrap] = useState(false);
  const language =
    typeof node.attrs.language === "string" ? node.attrs.language : "";
  const languageLabel =
    CODE_BLOCK_LANGUAGES.find((option) => option.value === language)?.label ??
    "Plain text";
  const filteredLanguages = CODE_BLOCK_LANGUAGES.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(languageQuery),
  );

  const handleLanguageMenuKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      window.requestAnimationFrame(() => editor.commands.focus());
      return;
    }

    if (event.key === "Backspace" && languageQuery) {
      event.preventDefault();
      event.stopPropagation();
      setLanguageQuery((query) => query.slice(0, -1));
      return;
    }

    if (
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      setLanguageQuery((query) => `${query}${event.key.toLowerCase()}`);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <NodeViewWrapper className="note-code-block" data-wrap={wrap || undefined}>
      <div className="note-code-block-header" contentEditable={false}>
        <DropdownMenu
          open={languageMenuOpen}
          onOpenChange={(open) => {
            setLanguageMenuOpen(open);
            if (!open) setLanguageQuery("");
          }}
        >
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="note-code-block-language"
                aria-label="Code block language"
                onMouseDown={(event) => event.preventDefault()}
              >
                <span>{languageLabel}</span>
                <ChevronDownIcon className="size-3" />
              </button>
            }
          />
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="note-code-language-menu max-h-56 w-40"
            onKeyDown={handleLanguageMenuKeyDown}
          >
            {filteredLanguages.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                  updateAttributes({ language: option.value || null });
                  setLanguageMenuOpen(false);
                  window.requestAnimationFrame(() => editor.commands.focus());
                }}
              >
                <span>{option.label}</span>
                {option.value === language ? (
                  <CheckIcon className="ml-auto size-3.5" />
                ) : null}
              </DropdownMenuItem>
            ))}
            {filteredLanguages.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground/50">
                No languages found
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <CodeBlockWrapButton
                  wrap={wrap}
                  onWrapChange={setWrap}
                  size="icon-sm"
                  className="size-[1.625rem]"
                  onMouseDown={(event) => event.preventDefault()}
                />
              }
            />
            <TooltipContent>
              {wrap ? "Unwrap lines" : "Wrap lines"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <CodeBlockDownloadButton
                  value={node.textContent}
                  fileName={codeBlockFileName(language)}
                  size="icon-sm"
                  className="size-[1.625rem]"
                  onMouseDown={(event) => event.preventDefault()}
                />
              }
            />
            <TooltipContent>Download code</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="note-code-block-copy size-[1.625rem] !text-sidebar-foreground/60 hover:!bg-sidebar-foreground/8 hover:!text-sidebar-foreground"
                  aria-label="Copy code"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (typeof navigator.clipboard?.writeText !== "function") {
                      return;
                    }
                    void navigator.clipboard
                      .writeText(node.textContent)
                      .then(() => setCopied(true));
                  }}
                >
                  <CopyFeedbackIcon copied={copied} size={16} />
                  <span className="sr-only">
                    {copied ? "Copied" : "Copy code"}
                  </span>
                </Button>
              }
            />
            <TooltipContent>{copied ? "Copied" : "Copy code"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
