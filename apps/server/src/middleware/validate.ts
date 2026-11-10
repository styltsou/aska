import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

import { AppError, ErrorCode } from "@/lib/errors";

const INVALID_REQUEST_MESSAGE = "The request contains invalid data.";

export const validate = {
  body: <T extends z.ZodType>(schema: T) =>
    zValidator("json", schema, (result) => {
      if (!result.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, INVALID_REQUEST_MESSAGE);
      }
    }),
  query: <T extends z.ZodType>(schema: T) =>
    zValidator("query", schema, (result) => {
      if (!result.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, INVALID_REQUEST_MESSAGE);
      }
    }),
  param: <T extends z.ZodType>(schema: T) =>
    zValidator("param", schema, (result) => {
      if (!result.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, INVALID_REQUEST_MESSAGE);
      }
    }),
};
