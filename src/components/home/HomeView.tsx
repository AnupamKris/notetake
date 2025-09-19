import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmptyState from "@/components/home/EmptyState";
import { Loader2, Plus } from "lucide-react";
import { NoteSummary } from "@/lib/notes";
import { formatDistanceToNow, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@/home-card.css"

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
    <main className="mx-auto flex h-full w-full flex-col gap-8 px-6 py-10">
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onOpenNote(note.id)}
                  className="group h-full text-left"
                >
                  <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card text-card-foreground shadow-sm transition group-hover:border-primary/60 group-hover:shadow-lg">
                    <div className="bg-muted/30 group-hover:bg-muted/40 max-h-48 h-full">
                      <div className="home-card-preview">
                        {note.preview ? (
                          <ReactMarkdown className="home-card-preview__content pointer-events-none" remarkPlugins={[remarkGfm]}>
                            {note.preview}
                          </ReactMarkdown>
                        ) : (
                          <p className="home-card-preview__empty pointer-events-none">No preview available.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-border/80 px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Name
                        </p>
                        <p className="line-clamp-1 text-base font-medium">
                          {note.title || "Untitled note"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Last change
                        </p>
                        <p className="text-xs">
                          {formatUpdated(note.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </section>
    </main>
  );
}
