import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar, type AvatarUser } from "@/lib/avatar";

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
  const avatar = resolveAvatar(user);
  const initial = name.trim().charAt(0).toUpperCase();

  if (avatar.kind === "gradient") {
    return (
      <Avatar className={className} {...props}>
        <AvatarFallback
          className="text-white"
          style={{ background: avatar.gradient.background }}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={className} {...props}>
      <AvatarImage src={avatar.src} alt={name} referrerPolicy="no-referrer" />
      <AvatarFallback
        className="text-white"
        style={{ background: avatar.fallback.background }}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
