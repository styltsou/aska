import { z } from "zod";

import { container } from "@/container";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { factory } from "@/factory";
import { AppError, ErrorCode } from "@/lib/errors";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import { classifyMediaContentType } from "@/services/media-content-type";
import {
  SafeFetchError,
  safeInspectContentType,
} from "../../../services/url-unfurl-shared/src/safe-fetch";

const ResolveMediaUrlSchema = z.object({ url: z.url() });

export default factory
  .createApp()
  .post(
    "/workspace/:workspaceSlug/media/resolve",
    authMiddleware,
    validate.param(WorkspaceParamSchema),
    validate.body(ResolveMediaUrlSchema),
    async (c) => {
      const { workspaceSlug } = c.req.valid("param");
      await container.collectionService.getWorkspaceBySlug(
        workspaceSlug,
        c.get("userId"),
      );
      try {
        const { contentType } = await safeInspectContentType(
          c.req.valid("json").url,
        );
        const kind = classifyMediaContentType(contentType);
        if (!kind)
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "URL is not a supported image or video",
          );
        return c.json(success({ kind, contentType }));
      } catch (error) {
        if (error instanceof SafeFetchError)
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "Media URL could not be retrieved safely",
          );
        throw error;
      }
    },
  );
