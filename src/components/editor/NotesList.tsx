import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { NoteSummary } from "@/lib/notes";
import { Plus } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

function formatUpdated(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

type NotesListProps = {
  notes: NoteSummary[];
  activeId?: string;
  onOpenNote: (id: string) => void;
  onCreateNote: () => void;
};

export default function NotesList({ notes, activeId, onOpenNote, onCreateNote }: NotesListProps) {
  return (
    <div className="flex h-full flex-col border-r">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onCreateNote}>
          <Plus className="mr-1 size-3.5" /> New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => onOpenNote(n.id)}
              className={cn(
                "w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted",
                n.id === activeId ? "bg-muted" : "",
              )}
            >
              <div className="line-clamp-1 font-medium">{n.title}</div>
              <div className="text-muted-foreground line-clamp-1 text-[11px]">
                Updated {formatUpdated(n.updatedAt)}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

