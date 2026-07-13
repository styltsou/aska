import type { PipelineCallback, PipelineEnv } from "./types";

/**
 * Authenticated callback transport to the API that owns persistence.
 *
 * The worker never writes database state directly. It reports lifecycle events
 * to the Hono API, which verifies the signature and applies idempotent updates.
 */

/** Sends one signed pipeline lifecycle event to the API. */
export async function sendPipelineCallback(
	env: PipelineEnv,
	payload: PipelineCallback,
): Promise<void> {
	const body = JSON.stringify(payload);
	const timestamp = Date.now().toString();
	const signature = await createSignature(
		env.PIPELINE_CALLBACK_SECRET,
		`${timestamp}.${body}`,
	);

	const response = await fetch(
		new URL(
			"/api/v1/internal/image-pipeline/callback",
			env.PIPELINE_API_BASE_URL,
		),
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-aska-timestamp": timestamp,
				"x-aska-signature": signature,
			},
			body,
		},
	);

	if (!response.ok) {
		throw new Error(`Pipeline callback failed with status ${response.status}`);
	}
}

/** Creates the hexadecimal HMAC-SHA-256 signature for a timestamped callback body. */
async function createSignature(secret: string, input: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)),
	);

	return Array.from(signature, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}
