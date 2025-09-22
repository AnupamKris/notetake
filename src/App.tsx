import "./index.css";
import "./utils.css"
import { useEffect, useMemo, useState } from "react";
import {
  NoteDocument,
  NoteSummary,
  deleteNote,
  listNotes,
  loadNote,
  saveNote,
} from "@/lib/notes";
import { toast, Toaster } from "sonner";
import TitleBar from "@/components/TitleBar";
import { invoke } from "@tauri-apps/api/core";
import useHotkeys from "@/hooks/use-hotkeys";
import HomeView from "@/components/home/HomeView";
import EditorView from "@/components/editor/EditorView";
import CommandPalette from "@/components/CommandPalette";

const INITIAL_MARKDOWN = `# Untitled note\n\nStart capturing your thoughts with Markdown.\n\n- Use **bold** or _italic_ text\n- Create bullet lists\n- Add links, code blocks, and more!`;

function sortByUpdated(notes: NoteSummary[]) {
  return [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// formatting helpers moved into components

export default function App() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeNote, setActiveNote] = useState<NoteDocument | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isNewNote, setIsNewNote] = useState(false);
  const [isNotesLoading, setIsNotesLoading] = useState(true);
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    refreshNotes();
  }, []);

  async function refreshNotes() {
    setIsNotesLoading(true);
    try {
      const storedNotes = await listNotes();
      setNotes(sortByUpdated(storedNotes));
    } catch (error) {
      console.error(error);
      toast.error("Could not load notes");
    } finally {
      setIsNotesLoading(false);
    }
  }

  const isDirty = useMemo(() => {
    if (!activeNote) {
      return false;
    }
    return activeNote.title !== title || activeNote.content !== content;
  }, [activeNote, title, content]);

  function shouldBlockNavigation() {
    if (!isDirty) {
      return false;
    }
    const confirmation = window.confirm(
      "You have unsaved changes. Are you sure you want to leave this note?"
    );
    return !confirmation;
  }

  function startNewNote() {
    if (shouldBlockNavigation()) {
      return;
    }

    const now = new Date().toISOString();
    const newNote: NoteDocument = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      content: INITIAL_MARKDOWN,
      updatedAt: now,
    };

    setActiveNote(newNote);
    setTitle(newNote.title);
    setContent(newNote.content);
    setIsNewNote(true);
    // For a new note, default to showing the editor
    setShowEditor(true);
    setShowPreview(true);
  }

  async function openExistingNote(noteId: string) {
    if (shouldBlockNavigation()) {
      return;
    }

    setIsNoteLoading(true);
    try {
      const note = await loadNote(noteId);
      setActiveNote(note);
      setTitle(note.title);
      setContent(note.content);
      setIsNewNote(false);
      // When opening from home, start in view-only mode
      setShowEditor(false);
      setShowPreview(true);
    } catch (error) {
      console.error(error);
      toast.error("Could not open that note");
    } finally {
      setIsNoteLoading(false);
    }
  }

  async function handleSave() {
    if (!activeNote) {
      return;
    }

    setIsSaving(true);
    try {
      const trimmedTitle = title.trim() || "Untitled note";
      const now = new Date().toISOString();
      const noteToSave: NoteDocument = {
        ...activeNote,
        title: trimmedTitle,
        content,
        updatedAt: now,
      };

      const summary = await saveNote(noteToSave);
      setActiveNote(noteToSave);
      setTitle(noteToSave.title);
      setContent(noteToSave.content);
      setNotes((current) => sortByUpdated(updateSummaries(current, summary)));
      setIsNewNote(false);
      toast.success("Note saved");
    } catch (error) {
      console.error(error);
      toast.error("Could not save note");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeNote) {
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete the note. Continue?"
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteNote(activeNote.id);
      toast.success("Note deleted");
      setActiveNote(null);
      setTitle("");
      setContent("");
      setIsNewNote(false);
      await refreshNotes();
    } catch (error) {
      console.error(error);
      toast.error("Could not delete note");
    }
  }

  async function handleBack() {
    if (shouldBlockNavigation()) {
      return;
    }
    setActiveNote(null);
    setTitle("");
    setContent("");
    setIsNewNote(false);
    await refreshNotes();
  }

  async function handleSendAllNotes() {
    try {
      const res = await invoke<string>("send_all_notes", { waitSecs: 10 });
      toast.success(res || "Notes sent");
    } catch (e) {
      console.error(e);
      toast.error("No receiver found on network");
    }
  }

  async function handleReceiveNotes() {
    toast.info("Waiting for sender… make sure both are on same Wi‑Fi");
    try {
      const res = await invoke<string>("receive_notes", { timeoutSecs: 120 });
      await refreshNotes();
      toast.success(res || "Received notes");
    } catch (e) {
      console.error(e);
      toast.error("Receive timed out or failed");
    }
  }

  const sortedNotes = useMemo(() => sortByUpdated(notes), [notes]);
  // Keyboard shortcuts: mod = Ctrl on Windows/Linux, Cmd on macOS
  useHotkeys([
    {
      combo: "mod+s",
      enabled: () => !!activeNote && isDirty && !isSaving,
      handler: () => {
        handleSave();
      },
    },
    {
      combo: "mod+n",
      handler: () => startNewNote(),
    },
    {
      combo: "mod+e",
      enabled: () => !!activeNote,
      handler: () => setShowEditor((v) => !v),
    },
    {
      combo: "mod+\\",
      enabled: () => !!activeNote,
      handler: () => setShowPreview((v) => !v),
    },
    {
      combo: "mod+|",
      enabled: () => !!activeNote,
      handler: () => setShowPreview((v) => !v),
    },
    { combo: "mod+k", handler: () => setCmdOpen(true) },
    { combo: "mod+shift+p", handler: () => setCmdOpen(true) },
  ]);

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col">
      <TitleBar
        appName="QuickMark"
        hasActiveNote={!!activeNote}
        canSave={!!activeNote && isDirty && !isSaving}
        isSaving={isSaving}
        isDirty={isDirty}
        noteTitle={title}
        showPreview={showPreview}
        onNew={startNewNote}
        onSave={handleSave}
        onDelete={handleDelete}
        onTogglePreview={() => setShowPreview((v) => !v)}
        onOpenPalette={() => setCmdOpen(true)}
        onBack={handleBack}
        onTitleChange={setTitle}
        onSendNotes={handleSendAllNotes}
        onReceiveNotes={handleReceiveNotes}
      />
      <Toaster closeButton position="top-right" />
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        primary={[
          {
            id: "new",
            label: "New Note",
            shortcut: "Ctrl+N",
            run: startNewNote,
          },
          {
            id: "save",
            label: "Save Note",
            shortcut: "Ctrl+S",
            disabled: !activeNote || !isDirty || isSaving,
            run: handleSave,
          },
          {
            id: "toggle",
            label: showPreview ? "Hide Preview" : "Show Preview",
            shortcut: "Ctrl+\\",
            disabled: !activeNote,
            run: () => setShowPreview((v) => !v),
          },
          {
            id: "delete",
            label: "Delete Note",
            disabled: !activeNote,
            run: handleDelete,
          },
        ]}
        secondary={[
          {
            id: "home",
            label: "Back to All Notes",
            disabled: !activeNote,
            run: handleBack,
          },
        ]}
        recentNotes={sortedNotes.slice(0, 10)}
        onOpenNote={openExistingNote}
      />
      {!activeNote ? (
        <HomeView
          notes={sortedNotes}
          isLoading={isNotesLoading}
          onCreateNote={startNewNote}
          onOpenNote={openExistingNote}
        />
      ) : (
        <EditorView
          content={content}
          isLoading={isNoteLoading}
          onContentChange={setContent}
          showPreview={showPreview}
          showEditor={showEditor}
          isDirty={isDirty}
          isSaving={isSaving}
          isNewNote={isNewNote}
          updatedAt={activeNote?.updatedAt ?? ""}
        />
      )}
    </div>
  );
}

function updateSummaries(notes: NoteSummary[], summary: NoteSummary) {
  const updated = notes.filter((note) => note.id !== summary.id);
  updated.push(summary);
  return updated;
}
