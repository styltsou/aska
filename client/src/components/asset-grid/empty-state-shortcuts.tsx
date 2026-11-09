import { KbdGroup } from "@/components/ui/kbd";
import { ShortcutKey } from "@/components/ui/shortcut-key";
import { formatPlatformShortcut } from "@/lib/platform";

const shortcuts = [
  { label: "Search commands", keys: ["⌘", "K"] },
  { label: "Scratchpad", keys: ["⇧", "P"] },
  { label: "Filter", keys: ["⇧", "F"] },
];

export function EmptyStateShortcuts() {
  return (
    <ul className="mx-auto flex w-fit flex-col gap-2 text-sm text-muted-foreground/70">
      {shortcuts.map(({ label, keys }) => (
        <li
          key={label}
          className="flex items-center justify-between gap-32 text-left"
        >
          <span>{label}</span>
          <KbdGroup className="shrink-0 gap-1">
            {keys.map((key) => (
              <ShortcutKey key={key}>{formatPlatformShortcut(key)}</ShortcutKey>
            ))}
          </KbdGroup>
        </li>
      ))}
    </ul>
  );
}
