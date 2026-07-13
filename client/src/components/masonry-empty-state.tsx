import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

interface MasonryEmptyStateProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function MasonryEmptyState({
  title,
  description,
  children,
}: MasonryEmptyStateProps) {
  return (
    <div className="flex min-h-96 items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <ImageIcon className="mb-4 size-8 text-muted-foreground/55" />
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {children ? <div className="mt-6 flex gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
