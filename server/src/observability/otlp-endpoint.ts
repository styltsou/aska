export type OtlpSignal = "traces" | "metrics" | "logs";

/** Builds an OTLP/HTTP signal endpoint from the configured collector base URL. */
export function getOtlpSignalEndpoint(
  baseEndpoint: string | undefined,
  signal: OtlpSignal,
): string | undefined {
  if (!baseEndpoint) return undefined;

  const endpoint = new URL(baseEndpoint);
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/v1/${signal}`;
  return endpoint.toString();
}
