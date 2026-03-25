#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::sync::mpsc;

#[cfg(target_os = "macos")]
use block2::StackBlock;
#[cfg(target_os = "macos")]
use objc2::MainThreadMarker;
#[cfg(target_os = "macos")]
use objc2::runtime::AnyObject;
#[cfg(target_os = "macos")]
use objc2_app_kit::{
    NSAlert, NSAlertFirstButtonReturn, NSAlertSecondButtonReturn, NSAlertStyle,
    NSAlertThirdButtonReturn, NSApplication, NSWindow,
};
#[cfg(target_os = "macos")]
use objc2_foundation::NSString;
#[cfg(target_os = "macos")]
use objc2_foundation::NSArray;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use url::Url;

const OPEN_DOCUMENT_EVENT: &str = "clipmark://open-document";

fn default_true() -> bool {
    true
}

fn default_theme_mode() -> ThemeMode {
    ThemeMode::System
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum ThemeMode {
    System,
    Light,
    Dark,
}

impl Default for ThemeMode {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppPreferences {
    #[serde(default = "default_true")]
    auto_load_external_media: bool,
    #[serde(default = "default_true")]
    is_preview_visible: bool,
    #[serde(default = "default_true")]
    is_toc_visible: bool,
    #[serde(default = "default_theme_mode")]
    theme_mode: ThemeMode,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            auto_load_external_media: true,
            is_preview_visible: true,
            is_toc_visible: true,
            theme_mode: ThemeMode::System,
        }
    }
}

struct PreferencesState {
    file_path: PathBuf,
    preferences: Mutex<AppPreferences>,
}

fn load_preferences_from_disk(path: &Path) -> AppPreferences {
    let Ok(contents) = fs::read_to_string(path) else {
        return AppPreferences::default();
    };

    serde_json::from_str(&contents).unwrap_or_default()
}

fn save_preferences_to_disk(path: &Path, preferences: &AppPreferences) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let contents = serde_json::to_string_pretty(preferences).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn preferences_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;

    Ok(config_dir.join("preferences.json"))
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_markdown_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_app_preferences(preferences_state: State<'_, PreferencesState>) -> Result<AppPreferences, String> {
    let preferences = preferences_state
        .preferences
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(preferences.clone())
}

#[tauri::command]
fn save_app_preferences(
    preferences: AppPreferences,
    preferences_state: State<'_, PreferencesState>,
) -> Result<(), String> {
    save_preferences_to_disk(&preferences_state.file_path, &preferences)?;

    let mut current_preferences = preferences_state
        .preferences
        .lock()
        .map_err(|error| error.to_string())?;
    *current_preferences = preferences;

    Ok(())
}

fn validate_external_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url).map_err(|error| error.to_string())?;
    match parsed.scheme() {
        "file" | "http" | "https" | "mailto" | "tel" => Ok(parsed),
        scheme => Err(format!("unsupported external URL scheme: {scheme}")),
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = validate_external_url(&url)?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(parsed.as_str());
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(parsed.as_str());
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", parsed.as_str()]);
        command
    };

    command.spawn().map_err(|error| error.to_string())?;
    Ok(())
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

#[tauri::command]
fn hide_window(window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let window_for_main_thread = window.clone();
        window
            .run_on_main_thread(move || {
                let ns_window: &NSWindow = unsafe {
                    &*(window_for_main_thread
                        .ns_window()
                        .expect("missing ns_window")
                        as *mut NSWindow)
                };

                ns_window.orderOut(None::<&AnyObject>);
            })
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn show_window(window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let window_for_main_thread = window.clone();
        window
            .run_on_main_thread(move || {
                let mtm = MainThreadMarker::new().expect("failed to access the main thread");
                let ns_window: &NSWindow = unsafe {
                    &*(window_for_main_thread
                        .ns_window()
                        .expect("missing ns_window")
                        as *mut NSWindow)
                };

                NSApplication::sharedApplication(mtm).activate();
                ns_window.makeKeyAndOrderFront(None::<&AnyObject>);
            })
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn show_unsaved_changes_sheet(window: tauri::Window, filename: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let window_for_main_thread = window.clone();
        let (tx, rx) = mpsc::channel();

        window
            .run_on_main_thread(move || {
                let result = (|| -> Result<String, String> {
                    let mtm = MainThreadMarker::new()
                        .ok_or_else(|| "failed to access the main thread".to_string())?;
                    let ns_window: &NSWindow = unsafe {
                        &*(window_for_main_thread
                            .ns_window()
                            .expect("missing ns_window")
                            as *mut NSWindow)
                    };

                    let alert = NSAlert::new(mtm);
                    alert.setAlertStyle(NSAlertStyle::Warning);
                    alert.addButtonWithTitle(&NSString::from_str("Save"));
                    alert.addButtonWithTitle(&NSString::from_str("Don't Save"));
                    alert.addButtonWithTitle(&NSString::from_str("Cancel"));
                    alert.setMessageText(&NSString::from_str(
                        "Do you want to save your changes before closing?",
                    ));
                    alert.setInformativeText(&NSString::from_str(&format!(
                        "{filename} has unsaved changes.",
                    )));

                    let completion = StackBlock::new(move |response| {
                        NSApplication::sharedApplication(mtm).stopModalWithCode(response);
                    });

                    alert.beginSheetModalForWindow_completionHandler(ns_window, Some(&completion));

                    let response = alert.runModal();
                    if response == NSAlertFirstButtonReturn {
                        return Ok("save".to_string());
                    }

                    if response == NSAlertSecondButtonReturn {
                        return Ok("discard".to_string());
                    }

                    if response == NSAlertThirdButtonReturn {
                        return Ok("cancel".to_string());
                    }

                    Ok("cancel".to_string())
                })();

                let _ = tx.send(result);
            })
            .map_err(|error| error.to_string())?;

        return rx
            .recv()
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, filename);
        Ok("unsupported".to_string())
    }
}

#[tauri::command]
fn pick_markdown_file() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let mtm =
            MainThreadMarker::new().ok_or_else(|| "failed to access the main thread".to_string())?;
        let panel = objc2_app_kit::NSOpenPanel::openPanel(mtm);

        panel.setCanChooseDirectories(false);
        panel.setCanChooseFiles(true);
        panel.setAllowsMultipleSelection(false);
        panel.setCanCreateDirectories(false);
        #[allow(deprecated)]
        panel.setAllowedFileTypes(Some(&NSArray::from_retained_slice(&[
            NSString::from_str("md"),
            NSString::from_str("markdown"),
            NSString::from_str("txt"),
        ])));

        let response = panel.runModal();
        if response != objc2_app_kit::NSModalResponseOK {
            return Ok(None);
        }

        let urls = panel.URLs();
        let url = urls.firstObject().ok_or_else(|| "missing selected file url".to_string())?;
        let path = url
            .path()
            .map(|path| path.to_string())
            .ok_or_else(|| "failed to read selected file path".to_string())?;

        return Ok(Some(path));
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let preferences_path = preferences_file_path(app.handle())?;
            let preferences = load_preferences_from_disk(&preferences_path);

            app.manage(PreferencesState {
                file_path: preferences_path,
                preferences: Mutex::new(preferences),
            });

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            append_debug_log,
            clear_debug_log,
            hide_window,
            load_app_preferences,
            open_external_url,
            pick_markdown_file,
            read_markdown_file,
            save_app_preferences,
            show_window,
            show_unsaved_changes_sheet,
            write_markdown_file,
            sync_window_document_state
        ])
        .build(tauri::generate_context!())
        .expect("error while building ClipMark");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        match event {
            tauri::RunEvent::Opened { urls } => {
                for url in urls {
                    let Ok(path) = url.to_file_path() else {
                        continue;
                    };

                    let Some(path) = path.to_str() else {
                        continue;
                    };

                    let _ = app_handle.emit(
                        OPEN_DOCUMENT_EVENT,
                        serde_json::json!({ "path": path }),
                    );
                }
            }
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                let mtm = MainThreadMarker::new().expect("failed to access the main thread");
                if NSApplication::sharedApplication(mtm).modalWindow().is_some() {
                    return;
                }

                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        load_preferences_from_disk, save_preferences_to_disk, validate_external_url, AppPreferences,
        ThemeMode,
    };
    use std::fs;

    #[test]
    fn accepts_supported_external_url_schemes() {
        assert!(validate_external_url("https://example.com").is_ok());
        assert!(validate_external_url("mailto:test@example.com").is_ok());
        assert!(validate_external_url("tel:+82-2-555-1234").is_ok());
        assert!(validate_external_url("file:///tmp/note.md").is_ok());
    }

    #[test]
    fn rejects_unsupported_external_url_schemes() {
        assert!(validate_external_url("javascript:alert('x')").is_err());
        assert!(validate_external_url("data:text/plain,hello").is_err());
    }

    #[test]
    fn preferences_default_when_file_is_missing() {
        let path = std::env::temp_dir().join("clipmark-missing-preferences.json");
        let _ = fs::remove_file(&path);

        assert_eq!(load_preferences_from_disk(&path), AppPreferences::default());
    }

    #[test]
    fn preferences_round_trip_through_disk() {
        let path = std::env::temp_dir().join("clipmark-test-preferences.json");
        let preferences = AppPreferences {
            auto_load_external_media: false,
            is_preview_visible: false,
            is_toc_visible: true,
            theme_mode: ThemeMode::Dark,
        };

        save_preferences_to_disk(&path, &preferences).expect("should save preferences");

        assert_eq!(load_preferences_from_disk(&path), preferences);

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn preferences_preserve_existing_values_when_theme_mode_is_missing() {
        let path = std::env::temp_dir().join("clipmark-test-legacy-preferences.json");

        fs::write(
            &path,
            r#"{
  "autoLoadExternalMedia": false,
  "isPreviewVisible": true,
  "isTocVisible": false
}"#,
        )
        .expect("should write legacy preferences");

        assert_eq!(
            load_preferences_from_disk(&path),
            AppPreferences {
                auto_load_external_media: false,
                is_preview_visible: true,
                is_toc_visible: false,
                theme_mode: ThemeMode::System,
            }
        );

        let _ = fs::remove_file(&path);
    }
}
