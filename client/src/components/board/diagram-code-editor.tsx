import CodeMirror from "@uiw/react-codemirror";
import {
  autocompletion,
  type CompletionContext,
} from "@codemirror/autocomplete";

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

const extensions = [autocompletion({ override: [complete] })];

export function DiagramCodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
      }}
      height="100%"
      className="h-full overflow-auto text-sm [&_.cm-editor]:min-h-full [&_.cm-editor]:outline-none"
      aria-label="Mermaid source"
    />
  );
}
