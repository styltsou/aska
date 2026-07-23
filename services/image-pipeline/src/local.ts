import "dotenv/config";
import type { Context, SQSEvent } from "aws-lambda";
import { readFile } from "node:fs/promises";

import { handler } from "./lambda";

const eventPath = process.env.SQS_EVENT_FILE;
if (!eventPath) {
	throw new Error(
		"Set SQS_EVENT_FILE to an SQS event fixture before running the local pipeline.",
	);
}

const event = JSON.parse(await readFile(eventPath, "utf8")) as SQSEvent;
await handler(event, {} as Context, () => undefined);
