import { apiUrl } from "@/lib/api";

export type NoteAgentRequest = {
  prompt: string;
  note: string;
  /** The draft a follow-up revises. */
  draft?: string;
  /** Instructions that produced `draft`, oldest first. */
  earlierPrompts?: string[];
  /** For a rewrite: the passage being rewritten, selection marked. */
  passage?: string;
  /** Notes @-mentioned in the prompt, as context. */
  referencedNotes?: Array<{ title: string; markdown: string }>;
  /** A mechanical edit (fix grammar, shorter, longer): never looks anything up. */
  task?: "mechanical";
};

const streamApiUrl =
  import.meta.env.VITE_AI_STREAM_URL?.replace(
    /^(https?:\/\/[^/]+)\/ai\/stream$/,
    "$1/api/ai/stream",
  ) ?? apiUrl("/api/ai/stream");

type StreamEvent = { event: string; data: unknown };

/** Splits server-sent events out of a growing text buffer. */
export function takeServerSentEvents(buffer: string): {
  events: StreamEvent[];
  rest: string;
} {
  const events: StreamEvent[] = [];
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) continue;
    try {
      events.push({ event, data: JSON.parse(data.join("\n")) });
    } catch {
      // Ignore malformed events rather than failing the whole response.
    }
  }
  return { events, rest };
}

/**
 * Streams note agent output, calling `onDelta` for each text chunk. Resolves when
 * the server reports completion and rejects on HTTP or stream errors.
 */
export async function streamNoteAgent(
  request: NoteAgentRequest,
  {
    signal,
    onDelta,
    onStatus,
  }: {
    signal: AbortSignal;
    onDelta: (text: string) => void;
    /** What the agent is doing before it writes, e.g. "Searching this note…". */
    onStatus?: (text: string) => void;
  },
) {
  const response = await fetch(streamApiUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: request }),
    signal,
  });
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "AI is unavailable right now.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = takeServerSentEvents(buffer + value);
    buffer = rest;
    for (const { event, data } of events) {
      const payload = data as {
        type?: string;
        text?: unknown;
        message?: string;
      };
      if (event === "error") {
        throw new Error(payload.message ?? "AI generation failed.");
      }
      if (payload.type === "delta" && typeof payload.text === "string") {
        onDelta(payload.text);
      } else if (
        payload.type === "status" &&
        typeof payload.text === "string"
      ) {
        onStatus?.(payload.text);
      } else if (payload.type === "done") {
        await reader.cancel();
        return;
      }
    }
  }
}
