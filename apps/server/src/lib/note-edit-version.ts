import type { UpdateNoteInput } from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";

export function assertNoteEditVersion(
  edit: UpdateNoteInput,
  current: { content: string; title: string | null },
) {
  if (edit.expectedContent === undefined || edit.expectedTitle === undefined) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Note edit is missing its original version",
    );
  }
  if (
    current.content !== edit.expectedContent ||
    current.title !== edit.expectedTitle
  ) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "This note changed elsewhere. Your draft was kept locally.",
    );
  }
}
