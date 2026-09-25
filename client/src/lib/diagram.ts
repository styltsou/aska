export const DIAGRAM_TEMPLATES = [
  {
    name: "Flowchart",
    source:
      "flowchart LR\n  Idea[Idea] --> Draft[Draft]\n  Draft --> Review{Ready?}\n  Review -- Yes --> Share[Share]\n  Review -- No --> Draft",
  },
  {
    name: "Sequence",
    source:
      "sequenceDiagram\n  participant A as Alex\n  participant B as Blake\n  A->>B: Share an idea\n  B-->>A: Give feedback",
  },
  {
    name: "Class",
    source:
      "classDiagram\n  class Project {\n    +String name\n    +createBoard()\n  }\n  Project --> Board",
  },
  {
    name: "State",
    source:
      "stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Published --> [*]",
  },
  {
    name: "ER",
    source:
      "erDiagram\n  PROJECT ||--o{ BOARD : contains\n  BOARD ||--o{ ASSET : holds",
  },
  {
    name: "Mind map",
    source:
      "mindmap\n  root((Project))\n    Ideas\n      Notes\n      Diagrams\n    Deliverables",
  },
] as const;

const FENCE = /^\s*```mermaid\s*\r?\n([\s\S]*?)\r?\n```\s*$/i;
const DECLARATION =
  /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|mindmap|gantt|pie|journey|gitGraph|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|architecture-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i;

export function classifyDiagramPaste(
  text: string,
): { source: string; confidence: "fenced" | "plain" } | undefined {
  const fenced = FENCE.exec(text);
  if (fenced?.[1]?.trim())
    return { source: fenced[1].trim(), confidence: "fenced" };
  const source = text.trim();
  if (DECLARATION.test(source) && source.includes("\n"))
    return { source, confidence: "plain" };
  return undefined;
}

let sequence = 0;
let renderQueue: Promise<void> = Promise.resolve();
const cache = new Map<string, string>();

export async function renderDiagram(
  source: string,
  dark: boolean,
): Promise<string> {
  const key = `${dark ? "dark" : "light"}\0${source}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let release!: () => void;
  const previous = renderQueue;
  renderQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([
      import("mermaid"),
      import("dompurify"),
    ]);
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      maxTextSize: 50_000,
      maxEdges: 500,
      theme: "base",
      themeVariables: dark
        ? {
            background: "#242529",
            primaryColor: "#34363d",
            primaryTextColor: "#f2f2f3",
            primaryBorderColor: "#858b98",
            lineColor: "#b4bac5",
            secondaryColor: "#3b4050",
            tertiaryColor: "#303d3a",
            fontFamily: "Inter, sans-serif",
          }
        : {
            background: "#ffffff",
            primaryColor: "#f2f4f8",
            primaryTextColor: "#232630",
            primaryBorderColor: "#777f91",
            lineColor: "#636d7f",
            secondaryColor: "#e6ebf7",
            tertiaryColor: "#e8f1ed",
            fontFamily: "Inter, sans-serif",
          },
    });
    await mermaid.parse(source);
    const { svg } = await mermaid.render(`aska-diagram-${++sequence}`, source);
    const clean = DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    if (!clean.includes("<svg"))
      throw new Error("Unable to render this diagram.");
    if (cache.size >= 80) cache.delete(cache.keys().next().value!);
    cache.set(key, clean);
    return clean;
  } finally {
    release();
  }
}
