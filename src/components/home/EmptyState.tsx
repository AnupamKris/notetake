import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type EmptyStateProps = {
  onCreateNote: () => void;
};

export default function EmptyState({ onCreateNote }: EmptyStateProps) {
  return (
    <div className="border-border bg-card text-card-foreground flex h-full flex-col items-center justify-center gap-3 rounded-xl border text-center">
      <h2 className="text-2xl font-semibold">No notes yet</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Start a fresh markdown note to keep your ideas safe and ready whenever
        the app launches.
      </p>
      <Button onClick={onCreateNote} size="lg">
        <Plus className="mr-2 size-4" />
        Create your first note
      </Button>
    </div>
  );
}

