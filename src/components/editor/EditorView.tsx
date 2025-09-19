import { useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Textarea } from "@/components/ui/textarea";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import StatusBar from "@/components/StatusBar";
import ClientGlimpseLink from "@/components/ui/kibo-ui/glimpse/client";
import "@/markdown.css"

export type EditorViewProps = {
  content: string;
  isLoading: boolean;
  onContentChange: (value: string) => void;
  showPreview: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isNewNote: boolean;
  updatedAt: string;
};

export default function EditorView(props: EditorViewProps) {
  const {
    content,
    isLoading,
    onContentChange,
    showPreview,
    isDirty,
    isSaving,
    isNewNote,
    updatedAt,
  } = props;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [selLen, setSelLen] = useState(0);
  const markdownComponents = useMemo<Components>(() => {
    return {
      a({ node, ...anchorProps }) {
        const href = anchorProps.href ?? "";
        if (!href || !/^https?:/i.test(href)) {
          return <a {...anchorProps} />;
        }
        return <ClientGlimpseLink {...anchorProps} />;
      },
    };
  }, []);

  return (
    <main className="flex h-full min-h-0 flex-col">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center gap-2 border-b bg-background/70">
            <Loader2 className="size-5 animate-spin" />
            Loading note.
          </div>
        ) : null}
        <ResizablePanelGroup
          direction="horizontal"
          className={cn("border-border relative flex h-full min-h-0 border-t", isLoading ? "pointer-events-none opacity-60" : "")}
        >
          <ResizablePanel defaultSize={showPreview ? 60 : 100} minSize={20} collapsible>
            <div className="flex h-full min-h-0 flex-col">
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
                className="flex-1 min-h-0 resize-none rounded-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed"
              />
            </div>
          </ResizablePanel>

          {showPreview ? (
            <>
              <ResizableHandle withHandle className="bg-muted" />
              <ResizablePanel defaultSize={40} minSize={20} collapsible>
                <div className="flex h-full w-full min-h-0 flex-col">
                  <div className="markdown-preview h-full min-h-0 overflow-auto px-4 py-4 text-sm leading-relaxed w-full">
                    {content.trim().length === 0 ? (
                      <p className="text-muted-foreground">Nothing to preview yet.</p>
                    ) : (
                      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} className="w-full">
                        {content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
      <StatusBar
        content={content}
        caret={caret}
        selectionLength={selLen}
        isDirty={isDirty}
        isSaving={isSaving}
        isNewNote={isNewNote}
        updatedAt={updatedAt}
      />
    </main>
  );
}
