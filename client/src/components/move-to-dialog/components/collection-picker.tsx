import { useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  PlusIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function CollectionPicker({
  collections,
  value,
  onChange,
  disabled,
  loading,
  placeholder,
  canCreateCollection,
  onCreateCollection,
}: {
  collections: readonly { name: string; slug: string }[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
  canCreateCollection?: boolean;
  onCreateCollection?: (name: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const selected = collections.find((collection) => collection.slug === value);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setMode("list");
      setName("");
      setError(undefined);
    }
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || !onCreateCollection || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const slug = await onCreateCollection(trimmed);
      onChange(slug);
      setOpen(false);
      setMode("list");
      setName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create collection.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label="Destination collection"
            className="flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input px-2.5 text-sm transition-colors duration-100 outline-none select-none hover:bg-foreground/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:bg-foreground/5"
            disabled={disabled || loading}
          >
            <span
              className={
                selected ? "truncate" : "truncate text-muted-foreground"
              }
            >
              {selected?.name ?? placeholder}
            </span>
            {loading ? (
              <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        )}
      />
      <DropdownMenuContent className="min-w-36" align="start" sideOffset={4}>
        {mode === "list" ? (
          <>
            {loading ? (
              <div className="flex flex-col gap-1 p-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-2 py-1.5"
                  >
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : collections.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No collections
              </p>
            ) : (
              collections.map((collection) => (
                <DropdownMenuItem
                  key={collection.slug}
                  className="cursor-pointer"
                  onClick={() => {
                    onChange(collection.slug);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {collection.name}
                  </span>
                  {collection.slug === value && (
                    <CheckIcon className="size-4" />
                  )}
                </DropdownMenuItem>
              ))
            )}
            {canCreateCollection && !loading && !pending ? (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors duration-100 outline-none select-none hover:bg-foreground/10 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setMode("create");
                    setName("");
                    setError(undefined);
                  }}
                >
                  <PlusIcon className="size-4 shrink-0" />
                  <span className="font-medium">New collection</span>
                </button>
              </>
            ) : null}
          </>
        ) : (
          <form
            className="flex flex-col gap-1 p-1"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Back to collection list"
                tabIndex={-1}
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-foreground/10 hover:text-foreground"
                onClick={() => {
                  setMode("list");
                  setName("");
                  setError(undefined);
                }}
              >
                {pending ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <ArrowLeftIcon className="size-4" />
                )}
              </button>
              <div className="relative flex-1">
                <Input
                  autoFocus
                  aria-label="New collection name"
                  autoComplete="off"
                  disabled={pending}
                  placeholder="Collection name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      setMode("list");
                      setName("");
                      setError(undefined);
                    }
                  }}
                  className="h-8 w-full pr-16"
                />
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <kbd className="rounded border border-border/70 bg-muted px-1 font-sans text-[10px] leading-4 text-muted-foreground">
                    Enter
                  </kbd>
                  to create
                </span>
              </div>
            </div>
            {error ? (
              <p className="px-1.5 text-xs text-destructive">{error}</p>
            ) : null}
          </form>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
