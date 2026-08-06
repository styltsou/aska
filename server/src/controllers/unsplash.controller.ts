import { container } from "@/container";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { UnsplashSearchQuerySchema } from "@/dto/upload.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";
import type { IUnsplashService } from "@/services/unsplash.service";

const collectionService: ICollectionService = container.collectionService;
const unsplashService: IUnsplashService = container.unsplashService;

export const searchUnsplash = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.query(UnsplashSearchQuerySchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const query = c.req.valid("query");
    await collectionService.getWorkspaceBySlug(workspaceSlug, c.get("userId"));
    return c.json(success(await unsplashService.search(query)));
  },
);
