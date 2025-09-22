use std::{
    fs,
    path::PathBuf,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
mod share;

const NOTES_DIR: &str = "notes";
const INDEX_FILE: &str = "index.json";
const PREVIEW_MAX_CHARS: usize = 200;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredNoteMetadata {
    id: String,
    title: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NoteSummary {
    id: String,
    title: String,
    updated_at: String,
    preview: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct NoteDocument {
    id: String,
    title: String,
    content: String,
    updated_at: String,
}

pub(crate) fn notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join(NOTES_DIR);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(notes_dir(app)?.join(INDEX_FILE))
}

fn note_path(app: &AppHandle, note_id: &str) -> Result<PathBuf, String> {
    Ok(notes_dir(app)?.join(format!("{note_id}.md")))
}

fn load_index(app: &AppHandle) -> Result<Vec<StoredNoteMetadata>, String> {
    let path = index_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let notes: Vec<StoredNoteMetadata> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(notes)
}

fn save_index(app: &AppHandle, notes: &[StoredNoteMetadata]) -> Result<(), String> {
    let path = index_path(app)?;
    let data = serde_json::to_string_pretty(notes).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

fn preview_from_content(content: &str) -> String {
    // Preserve line breaks so markdown blocks (headings, lists, quotes)
    // still render correctly in the home card preview.
    let mut preview = String::new();
    for line in content.lines() {
        let trimmed = line.trim_end();
        // Skip leading empty lines but keep subsequent empties to delimit blocks
        if preview.is_empty() && trimmed.trim().is_empty() {
            continue;
        }

        if !preview.is_empty() {
            preview.push('\n');
        }

        preview.push_str(trimmed);

        if preview.len() > PREVIEW_MAX_CHARS {
            break;
        }
    }

    if preview.len() > PREVIEW_MAX_CHARS {
        let truncate_at = PREVIEW_MAX_CHARS.saturating_sub(3);
        preview.truncate(truncate_at);
        preview.push_str("...");
    }

    preview
}

fn build_summary(app: &AppHandle, meta: StoredNoteMetadata) -> NoteSummary {
    let preview = note_path(app, &meta.id)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|content| preview_from_content(&content))
        .unwrap_or_default();

    NoteSummary {
        preview,
        id: meta.id,
        title: meta.title,
        updated_at: meta.updated_at,
    }
}

#[tauri::command]
fn list_notes(app: AppHandle) -> Result<Vec<NoteSummary>, String> {
    let index = load_index(&app)?;
    let summaries = index.into_iter().map(|meta| build_summary(&app, meta)).collect();
    Ok(summaries)
}

#[tauri::command]
fn load_note(app: AppHandle, id: String) -> Result<NoteDocument, String> {
    let path = note_path(&app, &id)?;
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut index = load_index(&app)?.into_iter();
    let meta = index
        .find(|meta| meta.id == id)
        .ok_or_else(|| "Note metadata missing".to_string())?;

    Ok(NoteDocument {
        id,
        title: meta.title,
        content,
        updated_at: meta.updated_at,
    })
}

#[tauri::command]
fn save_note(app: AppHandle, note: NoteDocument) -> Result<NoteSummary, String> {
    let path = note_path(&app, &note.id)?;
    fs::write(path, &note.content).map_err(|e| e.to_string())?;

    let mut index = load_index(&app)?;
    if let Some(existing) = index.iter_mut().find(|meta| meta.id == note.id) {
        existing.title = note.title.clone();
        existing.updated_at = note.updated_at.clone();
    } else {
        index.push(StoredNoteMetadata {
            id: note.id.clone(),
            title: note.title.clone(),
            updated_at: note.updated_at.clone(),
        });
    }
    save_index(&app, &index)?;

    let preview = preview_from_content(&note.content);

    Ok(NoteSummary {
        id: note.id,
        title: note.title,
        updated_at: note.updated_at,
        preview,
    })
}

#[tauri::command]
fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    if let Ok(path) = note_path(&app, &id) {
        if path.exists() {
            if let Err(err) = fs::remove_file(path) {
                return Err(err.to_string());
            }
        }
    }

    let mut index = load_index(&app)?;
    let len_before = index.len();
    index.retain(|meta| meta.id != id);
    if index.len() != len_before {
        save_index(&app, &index)?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_notes,
            load_note,
            save_note,
            delete_note,
            share::receive_notes,
            share::send_all_notes,
            share::discover_receivers,
            share::send_all_notes_to,
            share::send_note_to,
            share::start_send_all_notes_to,
            share::start_send_note_to
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
