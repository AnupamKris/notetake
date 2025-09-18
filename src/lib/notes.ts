import { invoke } from "@tauri-apps/api/core";

export type NoteSummary = {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
};

export type NoteDocument = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export async function listNotes(): Promise<NoteSummary[]> {
  return invoke<NoteSummary[]>("list_notes");
}

export async function loadNote(id: string): Promise<NoteDocument> {
  return invoke<NoteDocument>("load_note", { id });
}

export async function saveNote(note: NoteDocument): Promise<NoteSummary> {
  return invoke<NoteSummary>("save_note", { note });
}

export async function deleteNote(id: string): Promise<void> {
  return invoke<void>("delete_note", { id });
}
