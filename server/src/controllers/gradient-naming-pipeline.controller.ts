import { z } from "zod";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import { readSignedPipelineJson } from "@/services/pipeline-callback-auth";
import {
  claimGradientName,
  completeGradientName,
} from "@/services/gradient-naming.service";
import { parseGradientNamingJob } from "../../../services/gradient-naming/src/job";

function readJob(value: unknown) {
  try {
    return parseGradientNamingJob(value);
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid gradient naming job",
    );
  }
}

export const claimGradientNaming = factory.createHandlers(async (c) => {
  return c.json(
    success(await claimGradientName(readJob(await readSignedPipelineJson(c)))),
  );
});

export const completeGradientNaming = factory.createHandlers(async (c) => {
  const body = z
    .object({ job: z.unknown(), title: z.string().max(100) })
    .safeParse(await readSignedPipelineJson(c));
  if (!body.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid gradient name result",
    );
  return c.json(
    success(
      await completeGradientName(readJob(body.data.job), body.data.title),
    ),
  );
});
