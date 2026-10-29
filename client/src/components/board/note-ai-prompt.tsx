import { useMemo, useState } from "react";
import {
  FetchStreamTransport,
  useStream,
} from "@langchain/langgraph-sdk/react";

import { Button } from "@/components/ui/button";

type AiEvent = { type: "delta"; text: string } | { type: "done" };

export function NoteAiPrompt({
  note,
  onAccept,
  onClose,
}: {
  note: string;
  onAccept: (markdown: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const transport = useMemo(
    () =>
      new FetchStreamTransport({
        apiUrl:
          import.meta.env.VITE_AI_STREAM_URL ??
          "http://localhost:3000/api/ai/stream",
        onRequest: (_url, init) => ({ ...init, credentials: "include" }),
      }),
    [],
  );
  const stream = useStream({
    transport,
    onCustomEvent: (event) => {
      const update = event as AiEvent;
      if (update.type === "delta" && typeof update.text === "string") {
        setOutput((value) => value + update.text);
      } else if (update.type === "done") {
        setComplete(true);
      }
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "AI generation failed"),
  });

  const submit = () => {
    if (!prompt.trim() || stream.isLoading) return;
    setOutput("");
    setComplete(false);
    setError("");
    void stream.submit({ prompt: prompt.trim(), note });
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-background p-3 shadow-xl">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Ask AI to write or edit
      </div>
      <textarea
        autoFocus
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="What should I write?"
        rows={2}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {output ? (
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-sans text-sm whitespace-pre-wrap">
          {output}
        </pre>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Discard
        </Button>
        {stream.isLoading ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stream.stop}
          >
            Stop
          </Button>
        ) : null}
        {complete && output ? (
          <Button type="button" size="sm" onClick={() => onAccept(output)}>
            Insert
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!prompt.trim() || stream.isLoading}
            onClick={submit}
          >
            Generate
          </Button>
        )}
      </div>
    </div>
  );
}
