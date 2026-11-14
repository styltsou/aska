import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AVATAR_GRADIENT_CLASS,
  avatarGradientStyle,
  resolveAvatar,
  type AvatarUser,
} from "@/lib/avatar";
import { useOptimisticAvatar } from "@/lib/optimistic-avatar";

/** The user's avatar: their choice, else the Google picture, else a gradient. */
export function UserAvatar({
  user,
  name,
  className,
  ...props
}: {
  user: AvatarUser;
  name: string;
} & Omit<ComponentProps<typeof Avatar>, "children">) {
  const choice = useOptimisticAvatar();
  const avatar = resolveAvatar(
    choice.userId === user.id && choice.avatar !== null
      ? { ...user, avatar: choice.avatar }
      : user,
  );
  const gradient =
    avatar.kind === "gradient" ? avatar.gradient : avatar.fallback;

  return (
    <Avatar className={className} {...props}>
      {avatar.kind === "image" ? (
        <AvatarImage src={avatar.src} alt={name} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback
        aria-hidden="true"
        className={AVATAR_GRADIENT_CLASS}
        style={avatarGradientStyle(gradient)}
      />
    </Avatar>
  );
}
