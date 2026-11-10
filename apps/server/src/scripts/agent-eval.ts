/**
 * Runs the note agent eval cases through a pipeline and prints a comparison.
 *
 *   bun run agent:eval -- --fake                 # scripted model, no key, no cost
 *   GOOGLE_GENERATIVE_AI_API_KEY=… bun run agent:eval
 *   bun run agent:eval -- --case far-in-note --verbose
 *   bun run agent:eval -- --pipeline baseline   # today's single-call pipeline
 *   bun run agent:eval -- --delay 5000          # pause between cases (rate limits)
 *
 * See docs/proposals/ai-agentic-context.md for what the cases measure.
 */
import { EVAL_CASES, type EvalCase } from "@/agent/eval/cases";
import { PIPELINES, TOOL_PIPELINES } from "@/agent/eval/pipeline";
import { ScriptedChatModel } from "@/agent/eval/scripted-model";
import { scoreOutput } from "@/agent/eval/score";
import { createNoteModel } from "@/agent/note-model";

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const fake = process.argv.includes("--fake");
const verbose = process.argv.includes("--verbose");
const pipelineName = option("pipeline") ?? "agent";
const delayMs = Number(option("delay") ?? 0);
const onlyCase = option("case");

const pipeline = PIPELINES[pipelineName];
if (!pipeline) {
  console.error(
    `Unknown pipeline "${pipelineName}". Known: ${Object.keys(PIPELINES).join(", ")}`,
  );
  process.exit(1);
}

const cases = EVAL_CASES.filter(
  (testCase) => !onlyCase || testCase.id === onlyCase,
);
if (!cases.length) {
  console.error(
    `No case "${onlyCase}". Known: ${EVAL_CASES.map((c) => c.id).join(", ")}`,
  );
  process.exit(1);
}

function modelFor(testCase: EvalCase) {
  if (fake) {
    const lookups = TOOL_PIPELINES.has(pipelineName)
      ? (testCase.fakeLookups ?? [])
      : [];
    return new ScriptedChatModel([...lookups, { text: testCase.fakeOutput }]);
  }
  const model = createNoteModel(process.env);
  if (!model) {
    console.error(
      "Set GOOGLE_GENERATIVE_AI_API_KEY to run against the real model, or pass --fake.",
    );
    process.exit(1);
  }
  return model;
}

type Result = {
  id: string;
  failures: string[];
  firstTextMs: number | null;
  totalMs: number;
  chars: number;
  toolCalls: number;
  output: string;
};

const results: Result[] = [];
for (const [index, testCase] of cases.entries()) {
  if (index > 0 && delayMs > 0 && !fake) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const started = performance.now();
  let firstTextMs: number | null = null;
  let output = "";
  let toolCalls = 0;
  try {
    for await (const event of pipeline(testCase, modelFor(testCase))) {
      if (event.type === "tool") {
        toolCalls += 1;
        continue;
      }
      firstTextMs ??= performance.now() - started;
      output += event.text;
    }
  } catch (error) {
    output = "";
    console.error(`[${testCase.id}]`, error);
  }
  results.push({
    id: testCase.id,
    failures: scoreOutput(testCase, output, toolCalls),
    firstTextMs,
    totalMs: performance.now() - started,
    chars: output.length,
    toolCalls,
    output,
  });
}

const ms = (value: number | null) =>
  value === null ? "-" : `${Math.round(value)}`;
console.log(`\nPipeline: ${pipelineName}${fake ? " (fake model)" : ""}\n`);
console.table(
  results.map((result) => ({
    case: result.id,
    pass: result.failures.length ? "FAIL" : "ok",
    "first text ms": ms(result.firstTextMs),
    "total ms": ms(result.totalMs),
    chars: result.chars,
    lookups: result.toolCalls,
    failures: result.failures.join("; "),
  })),
);
const passed = results.filter((result) => !result.failures.length).length;
console.log(`${passed}/${results.length} passed`);

if (verbose) {
  for (const result of results) {
    console.log(`\n--- ${result.id} ---\n${result.output}`);
  }
}
