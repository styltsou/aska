import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";

/** One model turn: either text (streamed word by word) or a tool call. */
export type ScriptedStep =
  | { text: string }
  | { tool: string; args: Record<string, unknown>; preamble?: string };

/**
 * A chat model that plays back a fixed script, one step per call, including
 * tool calls. Used by tests and the eval's fake mode to exercise the agent
 * loop without a real model. It also records the messages it was sent.
 */
export class ScriptedChatModel extends BaseChatModel {
  readonly calls: BaseMessage[][] = [];
  private readonly steps: ScriptedStep[];
  private turn = 0;

  constructor(steps: ScriptedStep[], params: BaseChatModelParams = {}) {
    super(params);
    this.steps = steps;
  }

  _llmType() {
    return "scripted";
  }

  // Tools are described in the prompt by the agent; the script decides calls.
  override bindTools() {
    return this;
  }

  private next(messages: BaseMessage[]) {
    this.calls.push(messages);
    const step = this.steps[this.turn] ?? { text: "" };
    this.turn += 1;
    return step;
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const step = this.next(messages);
    const message =
      "tool" in step
        ? new AIMessage({
            content: step.preamble ?? "",
            tool_calls: [
              { name: step.tool, args: step.args, id: `call_${this.turn}` },
            ],
          })
        : new AIMessage(step.text);
    return { generations: [{ text: messageString(message), message }] };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const step = this.next(messages);
    const text = "tool" in step ? (step.preamble ?? "") : step.text;
    for (const word of text.match(/\S+\s*|\s+/g) ?? []) {
      const chunk = new ChatGenerationChunk({
        text: word,
        message: new AIMessageChunk({ content: word }),
      });
      yield chunk;
      await runManager?.handleLLMNewToken(word);
    }
    if ("tool" in step) {
      yield new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              name: step.tool,
              args: JSON.stringify(step.args),
              id: `call_${this.turn}`,
              index: 0,
              type: "tool_call_chunk",
            },
          ],
        }),
      });
    }
  }
}

function messageString(message: AIMessage) {
  return typeof message.content === "string" ? message.content : "";
}
