import { APP_VERSION } from "@/constants";

export const HealthStatus = {
  Ok: "ok",
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

export type HealthResponse = {
  status: HealthStatus;
  timestamp: string;
  version: string;
};

export interface IHealthService {
  checkHealth(): HealthResponse;
}

export class HealthService implements IHealthService {
  checkHealth(): HealthResponse {
    return {
      status: HealthStatus.Ok,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
  }
}
