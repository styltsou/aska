import { container } from "@/container";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import { WorkspaceSearchQuerySchema } from "@/dto/workspace-search.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";
import type { IWorkspaceSearchService } from "@/services/workspace-search.service";

const collectionService: ICollectionService = container.collectionService;
const workspaceSearchService: IWorkspaceSearchService =
  container.workspaceSearchService;

export const searchWorkspace = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.query(WorkspaceSearchQuerySchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success(
        await workspaceSearchService.search(workspace.id, c.req.valid("query")),
      ),
    );
  },
);
