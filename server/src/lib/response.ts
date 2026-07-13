import type { ErrorCode } from "./errors";

export type ApiResponse<T> = {
  data: T;
};

export type ApiError<Code extends ErrorCode = ErrorCode> = {
  error: {
    code: Code;
    message: string;
  };
};

export const success = <T>(data: T): ApiResponse<T> => ({ data });

export const errorResponse = <Code extends ErrorCode>(
  code: Code,
  message: string,
): ApiError<Code> => ({
  error: { code, message },
});
