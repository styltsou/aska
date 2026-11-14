import { useEffect, useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";

type AvatarChoice = {
  userId: string | null;
  avatar: string | null;
  error: string | null;
  saving: boolean;
};

let choice: AvatarChoice = {
  userId: null,
  avatar: null,
  error: null,
  saving: false,
};
let queued: string | null = null;
let inFlight: string | null = null;
let confirmedAvatar = "";
const listeners = new Set<() => void>();

function setChoice(next: AvatarChoice) {
  choice = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOptimisticAvatar() {
  return choice;
}

export function useOptimisticAvatar() {
  const { data, isPending } = authClient.useSession();
  const current = useSyncExternalStore(
    subscribe,
    getOptimisticAvatar,
    getOptimisticAvatar,
  );
  useEffect(() => {
    if (data?.user) {
      reconcileAvatar(data.user.id, data.user.avatar ?? "");
    } else if (!isPending && choice.userId !== null && !choice.saving) {
      setChoice({ userId: null, avatar: null, error: null, saving: false });
    }
  }, [data, isPending, current]);
  return current;
}

// Keep the override through intermediate refreshes, then release it once the
// session acknowledges the saved choice. Future session changes can flow through.
export function reconcileAvatar(userId: string, persistedAvatar: string) {
  if (
    !choice.saving &&
    inFlight === null &&
    queued === null &&
    choice.userId === userId &&
    choice.avatar !== null &&
    choice.avatar === persistedAvatar
  ) {
    setChoice({ ...choice, avatar: null });
  }
}

export function chooseAvatar(
  userId: string,
  avatar: string,
  persistedAvatar: string,
) {
  if (choice.userId === userId && choice.avatar === avatar) return;
  if (choice.userId !== userId || choice.avatar === null)
    confirmedAvatar = persistedAvatar;
  setChoice({ userId, avatar, error: null, saving: true });
  queued = inFlight === avatar ? null : avatar;
  if (inFlight === null) void saveLatest(userId);
}

async function saveLatest(userId: string) {
  while (queued !== null && choice.userId === userId) {
    const avatar = queued;
    queued = null;
    inFlight = avatar;
    try {
      const { error } = await authClient.updateUser({ avatar });
      if (error && queued === null && choice.userId === userId) {
        setChoice({
          userId,
          avatar: confirmedAvatar,
          error: error.message ?? "Unable to update your avatar.",
          saving: true,
        });
      } else if (!error && choice.userId === userId) {
        confirmedAvatar = avatar;
      }
    } catch {
      if (queued === null && choice.userId === userId) {
        setChoice({
          userId,
          avatar: confirmedAvatar,
          error: "Unable to update your avatar.",
          saving: true,
        });
      }
    }
    inFlight = null;
  }
  if (queued !== null && choice.userId !== userId && choice.userId !== null) {
    void saveLatest(choice.userId);
  } else if (choice.userId === userId) {
    setChoice({ ...choice, saving: false });
  }
}
