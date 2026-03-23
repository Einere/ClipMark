#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

#[cfg(target_os = "macos")]
use objc2_app_kit::NSWindow;
#[cfg(target_os = "macos")]
use objc2_foundation::NSString;

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_markdown_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn debug_log_path() -> PathBuf {
    std::env::temp_dir().join("clipmark-debug.log")
}

#[tauri::command]
fn clear_debug_log() -> Result<(), String> {
    fs::write(debug_log_path(), "").map_err(|error| error.to_string())
}

#[tauri::command]
fn append_debug_log(line: String) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(debug_log_path())
        .map_err(|error| error.to_string())?;

    writeln!(file, "{line}").map_err(|error| error.to_string())
}

#[tauri::command]
fn sync_window_document_state(
    window: tauri::Window,
    path: Option<String>,
    edited: bool,
    title: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let window_for_main_thread = window.clone();
        window
            .run_on_main_thread(move || {
                let ns_window: &NSWindow =
                    unsafe { &*(window_for_main_thread.ns_window().expect("missing ns_window") as *mut NSWindow) };

                let title = NSString::from_str(&title);
                ns_window.setTitle(&title);
                ns_window.setDocumentEdited(edited);

                let represented_filename = NSString::from_str(path.as_deref().unwrap_or(""));
                ns_window.setRepresentedFilename(&represented_filename);
            })
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, path, edited, title);
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            append_debug_log,
            clear_debug_log,
            read_markdown_file,
            write_markdown_file,
            sync_window_document_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipMark");
}
