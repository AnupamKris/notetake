import { useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
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
  showEditor: boolean;
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
    showEditor,
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

  const nothingVisible = !showEditor && !showPreview;

  return (
    <main className="flex h-full min-h-0 flex-col">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center gap-2 border-b bg-background/70">
            <Loader2 className="size-5 animate-spin" />
            Loading note.
          </div>
        ) : null}
        {nothingVisible ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center text-sm text-muted-foreground space-y-3">
              <p className="text-base font-medium text-foreground">Nothing to show</p>
              <p>Use these shortcuts to get going:</p>
              <div className="grid gap-1">
                <p><span className="font-mono">Ctrl+E</span> — Toggle Editor</p>
                <p><span className="font-mono">Ctrl+\\</span> — Toggle Preview</p>
                <p><span className="font-mono">Ctrl+S</span> — Save Note</p>
                <p><span className="font-mono">Ctrl+N</span> — New Note</p>
                <p><span className="font-mono">Ctrl+K</span> — Command Palette</p>
              </div>
            </div>
          </div>
        ) : showEditor && showPreview ? (
          <ResizablePanelGroup
            dir="ltr"
            direction="horizontal"
            className={cn("border-border relative flex h-full min-h-0 border-t", isLoading ? "pointer-events-none opacity-60" : "")}
          >
            <ResizablePanel defaultSize={60} minSize={20} collapsible>
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

            <ResizableHandle withHandle className="bg-muted" />

            <ResizablePanel defaultSize={40} minSize={20} collapsible>
              <div className="flex h-full w-full min-h-0 flex-col">
                <div className="markdown-preview h-full min-h-0 overflow-auto px-4 py-4 text-sm leading-relaxed w-full">
                  {content.trim().length === 0 ? (
                    <p className="text-muted-foreground">Nothing to preview yet.</p>
                  ) : (
                    <ReactMarkdown
                      components={markdownComponents}
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                      className="w-full"
                    >
                      {content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : showEditor ? (
          <div className={cn("border-border relative flex h-full min-h-0 border-t", isLoading ? "pointer-events-none opacity-60" : "")}
          >
            <div className="flex h-full min-h-0 flex-col w-full">
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
          </div>
        ) : (
          <div className={cn("border-border relative flex h-full min-h-0 border-t", isLoading ? "pointer-events-none opacity-60" : "")}
          >
            <div className="flex h-full w-full min-h-0 flex-col">
              <div className="markdown-preview h-full min-h-0 overflow-auto px-4 py-4 text-sm leading-relaxed w-full">
                {content.trim().length === 0 ? (
                  <p className="text-muted-foreground">Nothing to preview yet.</p>
                ) : (
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                    className="w-full"
                  >
                    {content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        )}
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
