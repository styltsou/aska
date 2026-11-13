import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  AVATAR_GRADIENTS,
  gradientAvatarValue,
  resolveAvatar,
} from "@/lib/avatar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const TILE_CLASS =
  "relative size-11 shrink-0 overflow-hidden rounded-full border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

/**
 * Lets the user pick their avatar. A choice is stored on `user.avatar` and
 * beats the Google picture; picking "Google photo" clears it so the avatar
 * follows the provider again. Uploads will join this grid as another tile.
 */
export function AvatarPicker({ googleLinked }: { googleLinked: boolean }) {
  const { data } = authClient.useSession();
  const user = data?.user;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const resolved = resolveAvatar(user);
  const googleSelected = resolved.kind === "image";
  const selectedGradientId =
    resolved.kind === "gradient" && resolved.explicit
      ? resolved.gradient.id
      : null;

  async function choose(avatar: string) {
    setPending(true);
    setError(null);
    const { error } = await authClient.updateUser({ avatar });
    if (error) setError(error.message ?? "Unable to update your avatar.");
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar
          className="size-14"
          name={user.name || user.email}
          user={user}
        />
        <div>
          <h3 className="text-sm font-medium">Avatar</h3>
          <p className="text-sm text-muted-foreground">
            {googleLinked
              ? "Use your Google photo or pick a gradient."
              : "Pick a gradient."}
          </p>
        </div>
      </div>
      <div
        aria-label="Avatar"
        className="flex flex-wrap gap-2.5"
        role="radiogroup"
      >
        {googleLinked && user.image ? (
          <button
            aria-checked={googleSelected}
            aria-label="Google photo"
            className={cn(
              TILE_CLASS,
              googleSelected &&
                "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
            disabled={pending}
            onClick={() => void choose("")}
            role="radio"
            type="button"
          >
            <img
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              src={user.image}
            />
          </button>
        ) : null}
        {AVATAR_GRADIENTS.map((gradient) => {
          const selected = selectedGradientId === gradient.id;
          return (
            <button
              aria-checked={selected}
              aria-label={gradient.label}
              className={cn(
                TILE_CLASS,
                selected &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              disabled={pending}
              key={gradient.id}
              onClick={() => void choose(gradientAvatarValue(gradient.id))}
              role="radio"
              style={{ background: gradient.background }}
              type="button"
            >
              {selected ? (
                <CheckIcon
                  aria-hidden="true"
                  className="absolute inset-0 m-auto size-4 text-white drop-shadow"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
