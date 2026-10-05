export const DEFAULT_MERMAID_SOURCE =
  "flowchart LR\n  Idea[Idea] --> Draft[Draft]\n  Draft --> Review{Ready?}\n  Review -- Yes --> Share[Share]\n  Review -- No --> Draft";

export function parseMermaidFence(text: string): string | undefined {
  const match =
    /^\s*(`{3,}|~{3,})mermaid[ \t]*\r?\n([\s\S]*?)\r?\n\1\s*$/i.exec(text);
  return match?.[2];
}

let sequence = 0;
let renderQueue: Promise<void> = Promise.resolve();
const cache = new Map<string, string>();

function getThemeVariables(dark: boolean) {
  const surface = dark ? "#262626" : "#fafafa";
  const ink = dark ? "#fafafa" : "#262626";
  const mutedInk = dark ? "#d4d4d4" : "#525252";
  const node = dark ? "#333333" : "#ffffff";
  const secondaryNode = dark ? "#404040" : "#f5f5f5";
  const tertiaryNode = dark ? "#2f2f2f" : "#ededed";
  const border = dark ? "#404040" : "#e5e5e5";
  const quietBorder = dark ? "#525252" : "#d4d4d4";
  const line = dark ? "#a3a3a3" : "#737373";

  return {
    background: surface,
    primaryColor: node,
    secondaryColor: secondaryNode,
    tertiaryColor: tertiaryNode,
    primaryTextColor: ink,
    secondaryTextColor: ink,
    tertiaryTextColor: ink,
    primaryBorderColor: border,
    secondaryBorderColor: border,
    tertiaryBorderColor: border,
    lineColor: line,
    arrowheadColor: line,
    textColor: ink,
    titleColor: ink,
    nodeBkg: node,
    nodeBorder: border,
    nodeTextColor: ink,
    mainBkg: node,
    clusterBkg: secondaryNode,
    clusterBorder: secondaryNode,
    edgeLabelBackground: surface,
    labelBackgroundColor: surface,
    labelTextColor: ink,
    actorBkg: node,
    actorBorder: border,
    actorTextColor: ink,
    actorLineColor: line,
    signalColor: line,
    signalTextColor: ink,
    noteBkgColor: secondaryNode,
    noteBorderColor: quietBorder,
    noteTextColor: ink,
    taskTextColor: ink,
    taskTextOutsideColor: mutedInk,
    stateBkg: node,
    stateLabelColor: ink,
    transitionColor: line,
    transitionLabelColor: ink,
    relationColor: line,
    relationLabelBackground: surface,
    relationLabelColor: ink,
    fontFamily: '"Inter Variable", Inter, ui-sans-serif, sans-serif',
    fontSize: "15px",
    fontWeight: "500",
    radius: 7,
    strokeWidth: 1,
    dropShadow: "none",
    useGradient: false,
  };
}

function getThemeCSS(dark: boolean) {
  const surface = dark ? "#262626" : "#fafafa";

  return `
    .edgePaths .path,
    .flowchart-link {
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .edgeLabel rect,
    .edgeLabel .background {
      fill: ${surface} !important;
      stroke: ${surface} !important;
      stroke-width: 6px !important;
      opacity: 1 !important;
    }

    .cluster rect {
      stroke-width: 0 !important;
    }

    [filter] {
      filter: none !important;
    }
  `;
}

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
      // SVG text survives our SVG-only sanitizer and exports reliably. Mermaid's
      // HTML labels are rendered in foreignObject nodes, whose HTML is removed.
      htmlLabels: false,
      theme: "base",
      // Mermaid's flowchart default is "neo", which dashes off the last few
      // pixels of each connector and leaves visible gaps before arrowheads.
      look: "classic",
      flowchart: { look: "classic" },
      themeVariables: getThemeVariables(dark),
      themeCSS: getThemeCSS(dark),
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
