import { container } from "@/container";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { PexelsSearchQuerySchema } from "@/dto/upload.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";
import type { IPexelsService } from "@/services/pexels.service";

const collectionService: ICollectionService = container.collectionService;
const pexelsService: IPexelsService = container.pexelsService;

export const searchPexels = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.query(PexelsSearchQuerySchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const query = c.req.valid("query");
    await collectionService.getWorkspaceBySlug(workspaceSlug, c.get("userId"));
    return c.json(success(await pexelsService.search(query)));
  },
);
