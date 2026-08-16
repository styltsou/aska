import { CircleAlertIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResourceLoadErrorProps = {
  className?: string;
  isRetrying?: boolean;
  onRetry: () => void;
  resourceName: string;
};

export function ResourceLoadError({
  className,
  isRetrying = false,
  onRetry,
  resourceName,
}: ResourceLoadErrorProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-80 w-full items-center justify-center px-6 text-center",
        className,
      )}
      role="alert"
    >
      <div className="max-w-sm space-y-3">
        <CircleAlertIcon
          aria-hidden="true"
          className="mx-auto size-10 text-muted-foreground"
          strokeWidth={1.25}
        />
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold">
            Couldn’t load {resourceName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
        </div>
        <Button disabled={isRetrying} size="lg" onClick={onRetry}>
          {isRetrying ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <RotateCwIcon />
          )}
          Try again
        </Button>
      </div>
    </div>
  );
}
