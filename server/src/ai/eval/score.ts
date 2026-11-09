import type { EvalCase } from "@/ai/eval/cases";

/** The text a rewrite's length is compared against. */
function selectedText(passage: string) {
  const marked = /⟦selection⟧([\s\S]*?)⟦\/selection⟧/.exec(passage);
  return marked ? marked[1]! : passage;
}

/** Returns the reasons a case's output failed its checks (empty = pass). */
export function scoreOutput(
  testCase: EvalCase,
  output: string,
  toolCalls: number,
): string[] {
  const failures: string[] = [];
  const text = output.toLowerCase();
  for (const expected of testCase.expect.includes ?? []) {
    if (!text.includes(expected.toLowerCase())) {
      failures.push(`missing "${expected}"`);
    }
  }
  for (const unwanted of testCase.expect.excludes ?? []) {
    if (text.includes(unwanted.toLowerCase())) {
      failures.push(`contains "${unwanted}"`);
    }
  }
  const { maxLengthRatio } = testCase.expect;
  if (maxLengthRatio && testCase.passage) {
    const ratio = output.trim().length / selectedText(testCase.passage).length;
    if (ratio > maxLengthRatio) {
      failures.push(`length ${ratio.toFixed(1)}x > ${maxLengthRatio}x`);
    }
  }
  if (testCase.expect.tools === "none" && toolCalls > 0) {
    failures.push(`unneeded lookups (${toolCalls})`);
  }
  if (testCase.expect.tools === "required" && toolCalls === 0) {
    failures.push("no lookup");
  }
  if (!output.trim()) failures.push("empty output");
  return failures;
}
