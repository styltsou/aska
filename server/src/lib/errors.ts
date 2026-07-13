import { HTTPException } from "hono/http-exception";

export const ErrorCode = {
  VALIDATION_ERROR: "validation_error",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  CONFLICT: "conflict",
  INTERNAL_ERROR: "internal_error",
  NOT_FOUND: "not_found",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

type StatusCode = 400 | 401 | 403 | 404 | 409 | 500;

const statusMap: Record<ErrorCode, StatusCode> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_FOUND]: 404,
};

export class AppError extends HTTPException {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    status?: StatusCode,
  ) {
    super(status ?? statusMap[code], { message });
  }
}

export const getStatusCode = (code: ErrorCode): StatusCode => statusMap[code];
