import { container } from "@/container";
import { WorkspaceParamSchema } from "@/dto/collection.dto";
import {
  MentionResolveSchema,
  MentionSearchQuerySchema,
} from "@/dto/note-mention.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import type { ICollectionService } from "@/services/collection.service";
import type { INoteMentionService } from "@/services/note-mention.service";

const collectionService: ICollectionService = container.collectionService;
const noteMentionService: INoteMentionService = container.noteMentionService;

export const searchNoteMentions = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.query(MentionSearchQuerySchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success(
        await noteMentionService.search(workspace.id, c.req.valid("query")),
      ),
    );
  },
);

export const resolveNoteMentions = factory.createHandlers(
  authMiddleware,
  validate.param(WorkspaceParamSchema),
  validate.body(MentionResolveSchema),
  async (c) => {
    const { workspaceSlug } = c.req.valid("param");
    const workspace = await collectionService.getWorkspaceBySlug(
      workspaceSlug,
      c.get("userId"),
    );
    return c.json(
      success(
        await noteMentionService.resolve(workspace.id, c.req.valid("json")),
      ),
    );
  },
);
