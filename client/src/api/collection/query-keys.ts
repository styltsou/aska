export const collectionQueryKeys = {
  collections: (workspaceSlug: string) =>
    ["collections", workspaceSlug] as const,
  contentScope: (workspaceSlug: string, collectionSlug: string) =>
    ["collectionContents", workspaceSlug, collectionSlug] as const,
  contents: (
    workspaceSlug: string,
    collectionSlug: string,
    folderPath?: string,
    typeSignature?: string,
  ) =>
    typeSignature
      ? ([
          "collectionContents",
          workspaceSlug,
          collectionSlug,
          folderPath,
          typeSignature,
        ] as const)
      : ([
          "collectionContents",
          workspaceSlug,
          collectionSlug,
          folderPath,
        ] as const),
  inbox: (workspaceSlug: string, typeSignature?: string) =>
    typeSignature
      ? (["inboxContents", workspaceSlug, typeSignature] as const)
      : (["inboxContents", workspaceSlug] as const),
};
