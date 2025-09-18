import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NoteSummary } from "@/lib/notes";
import { formatDistanceToNow, parseISO } from "date-fns";

export type CommandAction = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primary: CommandAction[];
  secondary?: CommandAction[];
  recentNotes?: NoteSummary[];
  onOpenNote?: (id: string) => void;
};

export default function CommandPalette({ open, onOpenChange, primary, secondary = [], recentNotes = [], onOpenNote }: CommandPaletteProps) {
  // close on run
  function wrapRun(run: () => void) {
    return () => {
      onOpenChange(false);
      setTimeout(run, 0);
    };
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          {primary.map((a) => (
            <CommandItem key={a.id} disabled={a.disabled} onSelect={wrapRun(a.run)}>
              <span className="flex-1">{a.label}</span>
              {a.shortcut ? (
                <kbd className="text-muted-foreground text-xs">{a.shortcut}</kbd>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        {recentNotes.length && onOpenNote ? (
          <CommandGroup heading="Recent Notes">
            {recentNotes.map((n) => (
              <CommandItem key={n.id} onSelect={wrapRun(() => onOpenNote(n.id))}>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate">{n.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDistanceToNow(parseISO(n.updatedAt), { addSuffix: true })}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {secondary.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Other">
              {secondary.map((a) => (
                <CommandItem key={a.id} disabled={a.disabled} onSelect={wrapRun(a.run)}>
                  <span className="flex-1">{a.label}</span>
                  {a.shortcut ? (
                    <kbd className="text-muted-foreground text-xs">{a.shortcut}</kbd>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
