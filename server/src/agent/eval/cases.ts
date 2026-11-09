import type { ScriptedStep } from "@/agent/eval/scripted-model";

/**
 * Fixed cases for evaluating the note agent. Each case describes what the client
 * would send (note with cursor marker, instruction, passage, referenced notes)
 * at full size; pipelines apply their own trimming. Checks are deliberately
 * simple so results can be compared across pipelines and prompt changes.
 */

export const CURSOR = "⟦cursor⟧";

export type EvalTask = "write" | "rewrite" | "mechanical";

export type EvalCase = {
  id: string;
  description: string;
  task: EvalTask;
  /** The note as Markdown, with the cursor marker where the result goes. */
  note: string;
  instruction: string;
  /** Rewrites: the passage with the selection marked. */
  passage?: string;
  /** Mentioned notes at full size. */
  /** Mentioned items as the server loads them; `kind` defaults to note. */
  references?: Array<{
    kind?: "note" | "link" | "color";
    title: string;
    markdown: string;
  }>;
  expect: {
    /** Case-insensitive substrings the output must contain. */
    includes?: string[];
    /** Case-insensitive substrings the output must not contain. */
    excludes?: string[];
    /** Output length divided by the selected text's length, at most. */
    maxLengthRatio?: number;
    /** Whether the case should be answered without, or only with, lookups. */
    tools: "none" | "required" | "any";
  };
  /** What the scripted model answers in --fake mode (should pass the checks). */
  fakeOutput: string;
  /** Lookups the scripted model makes before answering, for tool pipelines. */
  fakeLookups?: ScriptedStep[];
};

/** Deterministic filler: `count` weekly log sections of plain prose. */
function weeklyLog(count: number, topic: string) {
  const sections: string[] = [];
  for (let week = 1; week <= count; week += 1) {
    sections.push(
      `## Week ${week}\n\n` +
        `Worked through the ${topic} backlog for week ${week}. Reviewed open ` +
        `items, closed the ones that were done, and moved the rest forward. ` +
        `Notes from the sync: keep scope small, write things down, and check ` +
        `in again next week before planning anything new. Item ${week}-a was ` +
        `split into two smaller tasks; item ${week}-b is waiting on feedback.`,
    );
  }
  return sections.join("\n\n");
}

const LONG_NOTE =
  "# Launch journal\n\n" +
  "Decision from the kickoff: the public launch date is March 3, and the " +
  "beta closes two weeks before that.\n\n" +
  weeklyLog(160, "launch") +
  `\n\n## Today\n\n${CURSOR}`;

const LARGE_REFERENCE =
  "# Design review\n\n" +
  weeklyLog(70, "design") +
  "\n\n## Outcome\n\nDecision: we picked teal (#0f766e) as the accent color, " +
  "replacing the earlier purple.";

export const EVAL_CASES: EvalCase[] = [
  {
    id: "write-plain",
    description: "Plain writing that needs nothing beyond the short note.",
    task: "write",
    note:
      "# Scratchpad\n\nA place for loose thoughts before they get sorted.\n\n" +
      CURSOR,
    instruction: "Write a one-sentence tagline for this note.",
    expect: { excludes: ["⟦", "# Scratchpad"], tools: "none" },
    fakeOutput: "Catch every loose thought before it slips away.",
  },
  {
    id: "mechanical-grammar",
    description:
      "Fix grammar only; the result must stay close to the original.",
    task: "mechanical",
    note: `Intro.\n\n${CURSOR}\n\nOutro.`,
    passage: "This are a sentence with a error in it.",
    instruction:
      "Fix spelling, grammar, and punctuation only; change nothing else.",
    expect: {
      includes: ["This is a sentence with an error"],
      maxLengthRatio: 1.3,
      tools: "none",
    },
    fakeOutput: "This is a sentence with an error in it.",
  },
  {
    id: "rewrite-inline",
    description: "Rewrite part of a sentence; return only the replacement.",
    task: "rewrite",
    note: `Intro.\n\n${CURSOR}\n\nOutro.`,
    passage:
      "this is a quick note. ⟦selection⟧it will go straight to inbox⟦/selection⟧ " +
      "although i am not sure it makes sense.",
    instruction: "Make this part more formal.",
    expect: {
      excludes: ["⟦", "this is a quick note", "although"],
      maxLengthRatio: 3,
      tools: "none",
    },
    fakeOutput: "it will be routed directly to the inbox",
  },
  {
    id: "far-in-note",
    description:
      "A fact near the top of a long note, outside the window around the cursor.",
    task: "write",
    note: LONG_NOTE,
    instruction:
      "Remind me of the public launch date we decided on, in one sentence.",
    expect: { includes: ["March 3"], tools: "required" },
    fakeOutput: "The public launch is on March 3.",
    fakeLookups: [{ tool: "search_note", args: { pattern: "launch date" } }],
  },
  {
    id: "deep-in-reference",
    description: "A detail at the end of a large mentioned note, past the cap.",
    task: "write",
    note: `# Brand notes\n\n${CURSOR}`,
    instruction:
      "Which accent color did the design review settle on? One sentence.",
    references: [{ title: "Design review", markdown: LARGE_REFERENCE }],
    expect: { includes: ["teal"], tools: "required" },
    fakeOutput: "The design review settled on teal (#0f766e).",
    fakeLookups: [
      {
        tool: "search_reference",
        args: { reference: "R1", pattern: "accent color" },
      },
    ],
  },
  {
    id: "two-references",
    description: "An answer that needs facts from two mentioned notes.",
    task: "write",
    note: `# Planning\n\n${CURSOR}`,
    instruction: "Who owns the Q2 project? One sentence.",
    references: [
      {
        title: "Roadmap",
        markdown:
          "# Roadmap\n\n- Q1: ship AI editing\n- Q2: launch the mobile app",
      },
      {
        title: "Team",
        markdown: "# Team\n\n- Alex owns AI editing\n- Sam owns the mobile app",
      },
    ],
    expect: { includes: ["Sam"], tools: "any" },
    fakeOutput: "Sam owns the Q2 project, the mobile app launch.",
  },
  {
    id: "link-mention",
    description:
      "A mentioned link: use its details, and don't invent page content.",
    task: "write",
    note: `# Reading list\n\n${CURSOR}`,
    instruction: "Add a one-line entry for the mentioned link.",
    references: [
      {
        kind: "link",
        title: "Launch plan",
        markdown: [
          "Title: Launch plan",
          "URL: https://example.test/launch",
          "Site: Example",
          "Description: How the public launch rolls out, week by week.",
        ].join("\n"),
      },
    ],
    expect: { includes: ["Launch plan"], tools: "none" },
    fakeOutput:
      "- [Launch plan](https://example.test/launch): how the public launch rolls out, week by week.",
  },
  {
    id: "color-mention",
    description: "A mentioned color: use its exact value.",
    task: "write",
    note: `# Brand\n\n${CURSOR}`,
    instruction: "Write a sentence saying which accent color we use.",
    references: [
      {
        kind: "color",
        title: "Deep teal",
        markdown: "Name: Deep teal\nValue: #0f766e",
      },
    ],
    expect: { includes: ["#0f766e"], tools: "none" },
    fakeOutput: "Our accent color is Deep teal (#0f766e).",
  },
];
