import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

import { AppError, ErrorCode } from "@/lib/errors";

export const validate = {
  body: <T extends z.ZodType>(schema: T) =>
    zValidator("json", schema, (result) => {
      if (!result.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, result.error.message);
      }
    }),
  query: <T extends z.ZodType>(schema: T) =>
    zValidator("query", schema, (result) => {
      if (!result.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, result.error.message);
      }
    }),
  param: <T extends z.ZodType>(schema: T) =>
    zValidator("param", schema, (result) => {
      if (!result.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, result.error.message);
      }
    }),
};
