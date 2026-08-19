import { createHmac } from "node:crypto";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export async function callPipeline<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = createHmac(
    "sha256",
    required("RESOURCE_PIPELINE_CALLBACK_SECRET"),
  )
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const response = await fetch(
    new URL(path, required("PIPELINE_API_BASE_URL")),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aska-timestamp": timestamp,
        "x-aska-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`Pipeline API returned ${response.status}`);
  const envelope = (await response.json()) as { data: T };
  return envelope.data;
}
