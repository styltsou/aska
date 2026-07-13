export interface ILoggerService {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export class LoggerService implements ILoggerService {
  info(message: string, meta?: Record<string, unknown>): void {
    console.info(message, meta ?? "");
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(message, meta ?? "");
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(message, meta ?? "");
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(message, meta ?? "");
  }
}
