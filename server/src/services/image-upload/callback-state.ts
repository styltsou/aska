import type { ImagePipelineCallbackInput } from "@/dto/upload.dto";

export type PipelineCallbackUploadState = {
  status: "pending" | "uploaded" | "processing" | "completed" | "failed";
  processingEtag: string | null;
};

export type PipelineCallbackAction =
  | { type: "ignore"; ignored: boolean }
  | { type: "mark-processing" }
  | { type: "mark-failed" }
  | { type: "finalize" };

/** Determines the side effect permitted for a callback without touching storage. */
export function resolvePipelineCallbackAction(
  upload: PipelineCallbackUploadState | undefined,
  input: ImagePipelineCallbackInput,
): PipelineCallbackAction {
  if (!upload || !input.originalObjectKey.startsWith("ingest/")) {
    return { type: "ignore", ignored: true };
  }

  if (upload.processingEtag && upload.processingEtag !== input.originalEtag) {
    return { type: "ignore", ignored: true };
  }

  if (upload.status === "completed") {
    return { type: "ignore", ignored: false };
  }

  if (upload.status === "failed") {
    return { type: "ignore", ignored: true };
  }

  if (input.status === "processing") return { type: "mark-processing" };
  if (input.status === "failed") return { type: "mark-failed" };
  return { type: "finalize" };
}
