import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2, Save, Trash2, ArrowLeft } from "lucide-react";
import StatusBar from "@/components/StatusBar";
import { formatDistanceToNow, parseISO } from "date-fns";

function formatUpdated(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

export type EditorViewProps = {
  title: string;
  content: string;
  updatedAt: string;
  isNewNote: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onBack: () => void;
  showPreview: boolean;
  onTogglePreview: () => void;
};

export default function EditorView(props: EditorViewProps) {
  const {
    title,
    content,
    updatedAt,
    isNewNote,
    isDirty,
    isSaving,
    isLoading,
    onTitleChange,
    onContentChange,
    onSave,
    onDelete,
    onBack,
    showPreview,
    onTogglePreview,
  } = props;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [selLen, setSelLen] = useState(0);

  return (
    <main className="flex h-full flex-col">
      <div className="relative flex-1">
        {isLoading ? (
          <div className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center gap-2 border-b bg-background/70">
            <Loader2 className="size-5 animate-spin" />
            Loading note.
          </div>
        ) : null}
        <ResizablePanelGroup
          direction="horizontal"
          className={cn("border-border relative flex h-full border-t", isLoading ? "pointer-events-none opacity-60" : "")}
        >
          <ResizablePanel defaultSize={showPreview ? 60 : 100} minSize={20} collapsible>
            <div className="flex h-full flex-col">
              <div className="border-b px-3 py-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
                    <ArrowLeft className="mr-1 size-3.5" /> All
                  </Button>
                  <Input
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder="Untitled"
                    className="h-8 flex-1"
                  />
                  <span className="hidden text-[11px] text-muted-foreground md:inline">
                    {isNewNote ? "New note" : `Updated ${formatUpdated(updatedAt)}`}
                    {isDirty ? " • Unsaved" : ""}
                  </span>
                  <Button variant="ghost" size="icon" className="size-8" onClick={onTogglePreview}>
                    {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={onDelete}>
                    <Trash2 className="mr-1 size-4" /> Delete
                  </Button>
                  <Button size="sm" className="h-8" onClick={onSave} disabled={isSaving || !isDirty}>
                    {isSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                    Save
                  </Button>
                </div>
              </div>
              <Textarea
                value={content}
                ref={textareaRef}
                onChange={(event) => {
                  onContentChange(event.target.value);
                  setCaret(event.currentTarget.selectionStart || 0);
                  setSelLen((event.currentTarget.selectionEnd || 0) - (event.currentTarget.selectionStart || 0));
                }}
                onSelect={(event) => {
                  setCaret(event.currentTarget.selectionStart || 0);
                  setSelLen((event.currentTarget.selectionEnd || 0) - (event.currentTarget.selectionStart || 0));
                }}
                className="flex-1 resize-none rounded-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed"
              />
            </div>
          </ResizablePanel>

          {showPreview ? (
            <>
              <ResizableHandle withHandle className="bg-muted" />
              <ResizablePanel defaultSize={40} minSize={20} collapsible>
                <div className="flex h-full flex-col">
                  <div className="markdown-preview h-full overflow-auto px-4 py-4 text-sm leading-relaxed">
                    {content.trim().length === 0 ? (
                      <p className="text-muted-foreground">Nothing to preview yet.</p>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
      <StatusBar content={content} caret={caret} selectionLength={selLen} />
    </main>
  );
}


