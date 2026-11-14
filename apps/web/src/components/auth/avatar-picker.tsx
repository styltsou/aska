import { UserAvatar } from "@/components/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AVATAR_GRADIENTS,
  AVATAR_GRADIENT_CLASS,
  avatarGradientStyle,
  gradientAvatarValue,
  resolveAvatar,
} from "@/lib/avatar";
import { authClient } from "@/lib/auth-client";
import { chooseAvatar, useOptimisticAvatar } from "@/lib/optimistic-avatar";
import { cn } from "@/lib/utils";

const TILE_CLASS =
  "relative size-9 shrink-0 overflow-hidden rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// Display a cool-to-warm sweep without changing the catalog order used for
// stable automatic avatar assignments.
const PICKER_GRADIENTS = [
  "nebula",
  "glacier",
  "aurora",
  "lagoon",
  "meadow",
  "citrus",
  "amber",
  "ember",
  "terracotta",
  "coral",
  "sunset",
  "orchid",
  "dusk",
  "slate",
].map((id) => AVATAR_GRADIENTS.find((gradient) => gradient.id === id)!);

/**
 * Lets the user pick their avatar. A choice is stored on `user.avatar` and
 * beats the Google picture; picking "Google photo" clears it so the avatar
 * follows the provider again. Uploads will join this grid as another tile.
 */
export function AvatarPicker() {
  const { data } = authClient.useSession();
  const user = data?.user;
  const choice = useOptimisticAvatar();

  if (!user) return null;

  const resolved = resolveAvatar(
    choice.userId === user.id && choice.avatar !== null
      ? { ...user, avatar: choice.avatar }
      : user,
  );
  const googleSelected = resolved.kind === "image";
  const selectedGradientId =
    resolved.kind === "gradient" ? resolved.gradient.id : null;

  return (
    <div>
      <div className="flex items-center gap-3 bg-card px-4 py-4 sm:px-5">
        <UserAvatar
          className="size-14"
          name={user.name || user.email}
          user={user}
        />
        <div>
          <h4 className="text-sm font-medium">Avatar</h4>
          <p className="text-sm text-muted-foreground">
            {user.image
              ? "Use your Google photo or pick a gradient."
              : "Pick a gradient."}
          </p>
        </div>
      </div>
      <div className="rounded-t-lg border-t border-border/70 bg-background px-4 py-4 sm:px-5">
        <div
          aria-label="Avatar"
          className="flex flex-wrap gap-3 p-0.5"
          role="radiogroup"
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            const radios = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]',
              ),
            );
            const index = radios.indexOf(event.target as HTMLButtonElement);
            if (index === -1) return;
            let next: number;
            switch (event.key) {
              case "ArrowRight":
              case "ArrowDown":
                next = (index + 1) % radios.length;
                break;
              case "ArrowLeft":
              case "ArrowUp":
                next = (index - 1 + radios.length) % radios.length;
                break;
              case "Home":
                next = 0;
                break;
              case "End":
                next = radios.length - 1;
                break;
              default:
                return;
            }
            event.preventDefault();
            radios[next].focus();
            radios[next].click();
          }}
        >
          {user.image ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-checked={googleSelected}
                    aria-label="Google photo"
                    tabIndex={googleSelected ? 0 : -1}
                    className={cn(
                      TILE_CLASS,
                      googleSelected &&
                        "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                    )}
                    onClick={() => chooseAvatar(user.id, "", user.avatar ?? "")}
                    role="radio"
                    type="button"
                  />
                }
              >
                <img
                  alt=""
                  className="size-full object-cover"
                  referrerPolicy="no-referrer"
                  src={user.image}
                />
              </TooltipTrigger>
              <TooltipContent>Google photo</TooltipContent>
            </Tooltip>
          ) : null}
          {PICKER_GRADIENTS.map((gradient) => {
            const selected = selectedGradientId === gradient.id;
            return (
              <Tooltip key={gradient.id}>
                <TooltipTrigger
                  render={
                    <button
                      aria-checked={selected}
                      aria-label={gradient.label}
                      tabIndex={selected ? 0 : -1}
                      className={cn(
                        TILE_CLASS,
                        AVATAR_GRADIENT_CLASS,
                        selected &&
                          "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                      )}
                      onClick={() =>
                        chooseAvatar(
                          user.id,
                          gradientAvatarValue(gradient.id),
                          user.avatar ?? "",
                        )
                      }
                      role="radio"
                      style={avatarGradientStyle(gradient)}
                      type="button"
                    />
                  }
                />
                <TooltipContent>{gradient.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {choice.userId === user.id && choice.error ? (
          <p className="text-sm text-destructive" role="alert">
            {choice.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
