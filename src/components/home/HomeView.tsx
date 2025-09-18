import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmptyState from "@/components/home/EmptyState";
import { Loader2, Plus } from "lucide-react";
import { NoteSummary } from "@/lib/notes";
import { formatDistanceToNow, parseISO } from "date-fns";

function formatUpdated(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

type HomeViewProps = {
  notes: NoteSummary[];
  isLoading: boolean;
  onCreateNote: () => void;
  onOpenNote: (id: string) => void;
};

export default function HomeView({ notes, isLoading, onCreateNote, onOpenNote }: HomeViewProps) {
  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Your Markdown Notes</h1>
          <p className="text-muted-foreground">
            Create a new note or jump back into something you already started.
          </p>
        </div>
        <Button onClick={onCreateNote} size="lg">
          <Plus className="mr-2 size-4" />
          New note
        </Button>
      </header>
      <section className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading your notes.
          </div>
        ) : notes.length === 0 ? (
          <EmptyState onCreateNote={onCreateNote} />
        ) : (
          <ScrollArea className="h-full">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onOpenNote(note.id)}
                  className="text-left"
                >
                  <Card className="h-full transition hover:border-primary/60 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="line-clamp-1 text-lg">
                        {note.title}
                      </CardTitle>
                      <p className="text-muted-foreground text-xs">
                        Updated {formatUpdated(note.updatedAt)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-5">
                        {note.preview || "No preview available."}
                      </p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </section>
    </main>
  );
}

