#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
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
use tauri::{Emitter, Manager};

const OPEN_DOCUMENT_EVENT: &str = "clipmark://open-document";

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

                NSApplication::sharedApplication(mtm).activateIgnoringOtherApps(true);
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
        let mtm = MainThreadMarker::new().ok_or_else(|| "failed to access the main thread".to_string())?;
        let panel = unsafe { objc2_app_kit::NSOpenPanel::openPanel(mtm) };

        unsafe {
            panel.setCanChooseDirectories(false);
            panel.setCanChooseFiles(true);
            panel.setAllowsMultipleSelection(false);
            panel.setCanCreateDirectories(false);
            panel.setAllowedFileTypes(Some(&NSArray::from_retained_slice(&[
                NSString::from_str("md"),
                NSString::from_str("markdown"),
                NSString::from_str("txt"),
            ])));
        }

        let response = unsafe { panel.runModal() };
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            append_debug_log,
            clear_debug_log,
            hide_window,
            pick_markdown_file,
            read_markdown_file,
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
