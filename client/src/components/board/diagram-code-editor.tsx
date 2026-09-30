import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";
import {
  autocompletion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";

const KEYWORDS = [
  "flowchart LR",
  "flowchart TD",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "mindmap",
  "gantt",
  "pie",
  "journey",
  "gitGraph",
  "timeline",
  "subgraph",
  "end",
  "participant",
  "actor",
  "alt",
  "else",
  "loop",
  "Note over",
  "class",
  "state",
  "direction LR",
  "direction TB",
];

function complete(context: CompletionContext) {
  const word = context.matchBefore(/[\w-]*/);
  if (!word || (!context.explicit && !word.text)) return null;
  return {
    from: word.from,
    options: KEYWORDS.map((label) => ({ label, type: "keyword" })),
  };
}

const mermaidLanguage = StreamLanguage.define({
  name: "mermaid",
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^%%.*/)) return "comment";
    if (
      stream.match(/^"(?:\\.|[^"\\])*"/) ||
      stream.match(/^'(?:\\.|[^'\\])*'/)
    ) {
      return "string";
    }
    if (
      stream.match(
        /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|mindmap|gantt|pie|journey|gitGraph|timeline)\b/,
      )
    ) {
      return "keyword";
    }
    if (
      stream.match(
        /^(?:subgraph|end|participant|actor|activate|deactivate|alt|else|opt|loop|par|and|critical|break|rect|Note\s+over|classDef|class|style|linkStyle|click|state|direction|title|section|dateFormat|axisFormat)\b/,
      )
    ) {
      return "keyword";
    }
    if (
      stream.match(
        /^(?:-->>|->>|-->|-.->|==>|<-->|<--|--|---|o--o|x--x|o--|--o|x--|--x)/,
      )
    ) {
      return "operator";
    }
    if (
      stream.match(/^#[\da-fA-F]{3,8}\b/) ||
      stream.match(/^\d+(?:\.\d+)?\b/)
    ) {
      return "number";
    }
    if (stream.match(/^[A-Za-z_][\w-]*/)) return "variableName";
    stream.next();
    return null;
  },
});

const extensions = [mermaidLanguage, autocompletion({ override: [complete] })];

export function DiagramCodeEditor({
  value,
  onChange,
  readOnly = false,
  lineNumbers = true,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  lineNumbers?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      autoFocus
      readOnly={readOnly}
      editable={!readOnly}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      extensions={extensions}
      basicSetup={{
        lineNumbers,
        foldGutter: false,
        highlightActiveLine: true,
      }}
      height="100%"
      className="min-h-0 flex-1 overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-editor]:outline-none"
      aria-label="Mermaid source"
    />
  );
}
