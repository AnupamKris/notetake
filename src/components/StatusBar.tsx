import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";

type StatusBarProps = {
  content: string;
  caret: number; // selectionStart index
  selectionLength?: number;
  className?: string;
  isDirty?: boolean;
  isSaving?: boolean;
  isNewNote?: boolean;
  updatedAt?: string;
  networkStatus?: string;
};

function computeLineCol(text: string, index: number) {
  const upto = text.slice(0, index);
  const lines = upto.split(/\r?\n/);
  const line = lines.length; // 1-based
  const col = lines[lines.length - 1]?.length ?? 0;
  return { line, col };
}

function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function formatUpdated(iso?: string) {
  if (!iso) {
    return "";
  }
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function StatusBar({
  content,
  caret,
  selectionLength = 0,
  className,
  isDirty,
  isSaving,
  isNewNote,
  updatedAt,
  networkStatus,
}: StatusBarProps) {
  const totalLines = content.length ? content.split(/\r?\n/).length : 1;
  const chars = content.length;
  const words = countWords(content);
  const { line, col } = computeLineCol(content, caret);
  const statusParts: string[] = [];

  if (networkStatus) {
    statusParts.push(networkStatus);
  }
  if (isSaving) {
    statusParts.push("Saving...");
  } else if (isNewNote) {
    statusParts.push("New note");
  } else {
    const relative = formatUpdated(updatedAt);
    if (relative) {
      statusParts.push(`Updated ${relative}`);
    }
  }

  if (isDirty && !isSaving) {
    statusParts.push("Unsaved changes");
  }

  return (
    <div
      className={cn(
        "bg-card/60 text-muted-foreground border-border flex h-7 gap-3 items-center gap-4 whitespace-nowrap border-t px-3 text-[12px]",
        className,
      )}
      role="status"
      aria-label="Editor status bar"
    >
      <span>Ln {line}</span>
      <span>Col {col + 1}</span>
      <span>Lines {totalLines}</span>
      <span>Words {words}</span>
      <span>Chars {chars}</span>
      {selectionLength > 0 ? <span>Selected {selectionLength}</span> : null}
      {statusParts.length > 0 ? <span className="ml-auto">{statusParts.join(" • ")}</span> : null}
    </div>
  );
}

export default StatusBar;
