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
  isUnsplashPhotoUrl,
  resolveUnsplashPhoto,
} from "@/services/unsplash-photo";
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
        const url = c.req.valid("json").url;
        if (isUnsplashPhotoUrl(url)) {
          const photo = await resolveUnsplashPhoto(url);
          if (!photo)
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              "Unsplash photo could not be identified",
            );
          const { contentType } = await safeInspectContentType(photo.url);
          if (classifyMediaContentType(contentType) !== "image")
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              "Unsplash photo did not return a supported image",
            );
          return c.json(
            success({ kind: "image" as const, contentType, ...photo }),
          );
        }
        const { contentType } = await safeInspectContentType(url);
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
