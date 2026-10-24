import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchPeekableAsset } from "@/api/collection/fetchers";

type NamingFailure =
  | "missing_api_key"
  | "usage_limit"
  | "provider_unavailable"
  | "internal_error";

export function showGradientNamingFailure(error?: NamingFailure) {
  const message =
    error === "missing_api_key"
      ? "Automatic naming needs a valid API key."
      : error === "usage_limit"
        ? "Automatic naming has reached its usage limit."
        : error === "provider_unavailable"
          ? "Automatic naming is unavailable right now."
          : error === "internal_error"
            ? "Unable to generate a gradient title."
            : "Automatic naming is unavailable right now.";
  toast.error(message);
}

type NamingState = {
  pending: Record<string, boolean>;
  setPending: (id: string, pending: boolean) => void;
};

export const useGradientNaming = create<NamingState>((set) => ({
  pending: {},
  setPending: (id, pending) =>
    set((state) => {
      const next = { ...state.pending };
      if (pending) next[id] = true;
      else delete next[id];
      return { pending: next };
    }),
}));

const activePolls = new Map<string, number>();

export function watchGradientName(
  queryClient: QueryClient,
  workspaceSlug: string,
  assetId: string,
  previousTitle: string | null,
  fingerprint?: string,
) {
  const generation = (activePolls.get(assetId) ?? 0) + 1;
  activePolls.set(assetId, generation);
  useGradientNaming.getState().setPending(assetId, true);
  void (async () => {
    try {
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        if (activePolls.get(assetId) !== generation) return;
        try {
          const { asset } = await fetchPeekableAsset(workspaceSlug, assetId);
          if (asset.type === "color" && asset.title !== previousTitle) {
            await Promise.all([
              queryClient.invalidateQueries({
                predicate: ({ queryKey }) =>
                  (queryKey[0] === "collectionContents" ||
                    queryKey[0] === "inboxContents") &&
                  queryKey[1] === workspaceSlug,
              }),
              queryClient.invalidateQueries({
                queryKey: ["workspace-asset", workspaceSlug, assetId],
              }),
              queryClient.invalidateQueries({
                queryKey: ["note-mentions", workspaceSlug],
              }),
              queryClient.invalidateQueries({
                queryKey: ["workspace", workspaceSlug],
              }),
            ]);
            return;
          }
          if (
            asset.type === "color" &&
            asset.naming?.state === "failed" &&
            (!fingerprint || asset.naming.fingerprint === fingerprint)
          ) {
            showGradientNamingFailure(asset.naming.error);
            return;
          }
          if (
            asset.type === "color" &&
            asset.naming?.state === "succeeded" &&
            (!fingerprint || asset.naming.fingerprint === fingerprint)
          )
            return;
        } catch {
          // A temporary fetch error is covered by the bounded wait.
        }
      }
    } finally {
      if (activePolls.get(assetId) === generation) {
        activePolls.delete(assetId);
        useGradientNaming.getState().setPending(assetId, false);
      }
    }
  })();
}
