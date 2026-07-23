import { container } from "@/container";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { ColorSearchRequestSchema } from "@/dto/color-search.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";
import type { IColorSearchService } from "@/services/color-search.service";

const collectionService: ICollectionService = container.collectionService;
const colorSearchService: IColorSearchService = container.colorSearchService;

export const searchImagesByColor = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(ColorSearchRequestSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const input = c.req.valid("json");
    const userId = c.get("userId");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      userId,
    );
    const search = await colorSearchService.search(workspace.id, input);

    return c.json(success(search));
  },
);
