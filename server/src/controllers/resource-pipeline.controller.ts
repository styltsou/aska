import { container } from "@/container";
import {
  ResolutionClaimSchema,
  ResolutionResultSchema,
  ResourceMediaClaimSchema,
  ResourceMediaResultSchema,
} from "@/dto/url-unfurl.dto";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import { readSignedPipelineJson } from "@/services/pipeline-callback-auth";

export const claimUrlResolution = factory.createHandlers(async (c) => {
  const parsed = ResolutionClaimSchema.safeParse(
    await readSignedPipelineJson(c),
  );
  if (!parsed.success)
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid resolution claim");
  return c.json(
    success(
      await container.urlUnfurlService.claimResolution(
        parsed.data.id,
        parsed.data.generation,
      ),
    ),
  );
});

export const reportUrlResolution = factory.createHandlers(async (c) => {
  const parsed = ResolutionResultSchema.safeParse(
    await readSignedPipelineJson(c),
  );
  if (!parsed.success)
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid resolution result");
  return c.json(
    success(
      await container.urlUnfurlService.handleResolutionResult(parsed.data),
    ),
  );
});

export const claimResourceMedia = factory.createHandlers(async (c) => {
  const parsed = ResourceMediaClaimSchema.safeParse(
    await readSignedPipelineJson(c),
  );
  if (!parsed.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid resource media claim",
    );
  return c.json(
    success(
      await container.urlUnfurlService.claimResourceMedia(
        parsed.data.id,
        parsed.data.generation,
      ),
    ),
  );
});

export const reportResourceMedia = factory.createHandlers(async (c) => {
  const parsed = ResourceMediaResultSchema.safeParse(
    await readSignedPipelineJson(c),
  );
  if (!parsed.success)
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid resource media result",
    );
  return c.json(
    success(
      await container.urlUnfurlService.handleResourceMediaResult(parsed.data),
    ),
  );
});
