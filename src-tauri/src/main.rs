#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
#[cfg(target_os = "macos")]
use std::ffi::CStr;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "macos")]
use std::sync::mpsc;
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::sync::OnceLock;

#[cfg(target_os = "macos")]
use block2::StackBlock;
#[cfg(target_os = "macos")]
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
#[cfg(target_os = "macos")]
use objc2::{sel, MainThreadMarker};
#[cfg(target_os = "macos")]
use objc2_app_kit::{
    NSAlert, NSAlertFirstButtonReturn, NSAlertSecondButtonReturn, NSAlertStyle,
    NSAlertThirdButtonReturn, NSApplication, NSWindow,
};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSArray, NSString, NSURL};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const DEFAULT_WINDOW_WIDTH: f64 = 1440.0;
const DEFAULT_WINDOW_HEIGHT: f64 = 920.0;
const DEFAULT_WINDOW_MIN_WIDTH: f64 = 1100.0;
const DEFAULT_WINDOW_MIN_HEIGHT: f64 = 720.0;

#[cfg(target_os = "macos")]
static OPEN_URL_APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static PENDING_OPEN_DOCUMENT_PATHS: Mutex<Vec<String>> = Mutex::new(Vec::new());

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
    #[serde(default)]
    preview_panel_width: Option<u16>,
    #[serde(default)]
    toc_panel_width: Option<u16>,
    #[serde(default = "default_theme_mode")]
    theme_mode: ThemeMode,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            auto_load_external_media: true,
            is_preview_visible: true,
            is_toc_visible: true,
            preview_panel_width: None,
            toc_panel_width: None,
            theme_mode: ThemeMode::System,
        }
    }
}

struct PreferencesState {
    file_path: PathBuf,
    preferences: Mutex<AppPreferences>,
}

#[allow(dead_code)]
#[derive(Default)]
struct WindowRegistry {
    next_window_id: u64,
    window_paths: HashMap<String, Option<String>>,
    path_windows: HashMap<String, String>,
}

#[allow(dead_code)]
impl WindowRegistry {
    fn register_window(&mut self, label: String) {
        self.window_paths.entry(label).or_insert(None);
    }

    fn next_document_label(&mut self) -> String {
        self.next_window_id += 1;
        format!("document-{}", self.next_window_id)
    }

    fn register_document_path(&mut self, label: &str, path: Option<String>) {
        if let Some(Some(previous_path)) = self.window_paths.get(label) {
            self.path_windows.remove(previous_path);
        }

        self.window_paths.insert(label.to_string(), path.clone());

        if let Some(next_path) = path {
            if let Some(previous_label) = self.path_windows.get(&next_path) {
                if previous_label != label {
                    self.window_paths.insert(previous_label.clone(), None);
                }
            }

            self.path_windows.insert(next_path, label.to_string());
        }
    }

    fn unregister_window(&mut self, label: &str) {
        if let Some(Some(path)) = self.window_paths.remove(label) {
            self.path_windows.remove(&path);
        }
    }

    fn window_for_path(&self, path: &str) -> Option<String> {
        self.path_windows.get(path).cloned()
    }

    fn is_path_open_elsewhere(&self, label: &str, path: &str) -> bool {
        self.path_windows
            .get(path)
            .is_some_and(|window_label| window_label != label)
    }
}

#[allow(dead_code)]
struct WindowRegistryState {
    registry: Mutex<WindowRegistry>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct InitialDocumentWindowState {
    is_new_document: bool,
    path: Option<String>,
}

fn normalize_document_path_for_registry(path: &str) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| PathBuf::from(path))
        .to_string_lossy()
        .to_string()
}

fn encoded_document_url(path: Option<&str>) -> WebviewUrl {
    match path {
        Some(path) => {
            WebviewUrl::App(format!("index.html?path={}", urlencoding::encode(path)).into())
        }
        None => WebviewUrl::App("index.html?new=1".into()),
    }
}

fn focus_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn reserve_document_window_in_registry(
    registry: &mut WindowRegistry,
    path: Option<&str>,
) -> String {
    let label = registry.next_document_label();
    registry.register_window(label.clone());

    if let Some(path) = path {
        let normalized_path = normalize_document_path_for_registry(path);
        registry.register_document_path(&label, Some(normalized_path));
    }

    label
}

fn rollback_reserved_document_window_in_registry(registry: &mut WindowRegistry, label: &str) {
    registry.unregister_window(label);
}

#[derive(Debug, PartialEq, Eq)]
enum DocumentWindowOpenDecision {
    Focus(String),
    AlreadyOpening,
    Create,
}

fn document_window_open_decision(
    existing_label: Option<String>,
    window_exists: bool,
) -> DocumentWindowOpenDecision {
    match (existing_label, window_exists) {
        (Some(label), true) => DocumentWindowOpenDecision::Focus(label),
        (Some(_), false) => DocumentWindowOpenDecision::AlreadyOpening,
        (None, _) => DocumentWindowOpenDecision::Create,
    }
}

fn create_document_window_with_path(
    app_handle: &AppHandle,
    registry_state: &State<'_, WindowRegistryState>,
    path: Option<String>,
) -> Result<(), String> {
    let label = {
        let mut registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        reserve_document_window_in_registry(&mut registry, path.as_deref())
    };

    let build_result = WebviewWindowBuilder::new(
        app_handle,
        label.clone(),
        encoded_document_url(path.as_deref()),
    )
    .title("ClipMark")
    .inner_size(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT)
    .min_inner_size(DEFAULT_WINDOW_MIN_WIDTH, DEFAULT_WINDOW_MIN_HEIGHT)
    .build();

    if let Err(error) = build_result {
        let mut registry = registry_state
            .registry
            .lock()
            .map_err(|lock_error| lock_error.to_string())?;
        rollback_reserved_document_window_in_registry(&mut registry, &label);
        return Err(error.to_string());
    }

    Ok(())
}

fn open_document_window_with_path(
    app_handle: &AppHandle,
    registry_state: &State<'_, WindowRegistryState>,
    path: String,
) -> Result<(), String> {
    let normalized_path = normalize_document_path_for_registry(&path);
    let existing_label = {
        let registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.window_for_path(&normalized_path)
    };

    let existing_window = existing_label
        .as_deref()
        .and_then(|label| app_handle.get_webview_window(label));

    match document_window_open_decision(existing_label, existing_window.is_some()) {
        DocumentWindowOpenDecision::Focus(_) => {
            let window = existing_window.expect("window should exist for focus decision");
            focus_window(&window)
        }
        DocumentWindowOpenDecision::AlreadyOpening => Ok(()),
        DocumentWindowOpenDecision::Create => {
            create_document_window_with_path(app_handle, registry_state, Some(path))
        }
    }
}

fn document_paths_from_opened_urls(urls: impl IntoIterator<Item = Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter_map(|path| path.to_str().map(ToOwned::to_owned))
        .collect()
}

fn queue_pending_open_document_paths(paths: impl IntoIterator<Item = String>) {
    let Ok(mut pending_paths) = PENDING_OPEN_DOCUMENT_PATHS.lock() else {
        return;
    };

    pending_paths.extend(paths);
}

fn take_pending_open_document_paths() -> Vec<String> {
    let Ok(mut pending_paths) = PENDING_OPEN_DOCUMENT_PATHS.lock() else {
        return Vec::new();
    };

    std::mem::take(&mut *pending_paths)
}

fn open_document_paths(
    app_handle: &AppHandle,
    registry_state: &State<'_, WindowRegistryState>,
    paths: impl IntoIterator<Item = String>,
) {
    for path in paths {
        let _ = open_document_window_with_path(app_handle, registry_state, path);
    }
}

#[cfg(target_os = "macos")]
unsafe extern "C-unwind" fn clipmark_application_open_urls(
    _: &AnyObject,
    _: Sel,
    _: &AnyObject,
    urls: &NSArray<NSURL>,
) {
    let paths = document_paths_from_opened_urls((0..urls.count()).filter_map(|index| {
        let url = urls.objectAtIndex(index);
        let absolute_string = url.absoluteString()?;
        Url::parse(&absolute_string.to_string()).ok()
    }));

    if paths.is_empty() {
        return;
    }

    let Some(app_handle) = OPEN_URL_APP_HANDLE.get() else {
        queue_pending_open_document_paths(paths);
        return;
    };
    let Some(registry_state) = app_handle.try_state::<WindowRegistryState>() else {
        queue_pending_open_document_paths(paths);
        return;
    };

    open_document_paths(app_handle, &registry_state, paths);
}

#[cfg(target_os = "macos")]
fn install_safe_open_urls_delegate() {
    let class_name = CStr::from_bytes_with_nul(b"TaoAppDelegateParent\0")
        .expect("valid Tao app delegate class name");
    let Some(class) = AnyClass::get(class_name) else {
        return;
    };
    let Some(method) = class.instance_method(sel!(application:openURLs:)) else {
        return;
    };

    unsafe {
        let implementation: Imp = std::mem::transmute(
            clipmark_application_open_urls
                as unsafe extern "C-unwind" fn(&AnyObject, Sel, &AnyObject, &NSArray<NSURL>),
        );
        method.set_implementation(implementation);
    }
}

fn is_document_path_open_elsewhere_in_registry(
    registry: &WindowRegistry,
    label: &str,
    path: &str,
) -> bool {
    let normalized_path = normalize_document_path_for_registry(path);
    registry.is_path_open_elsewhere(label, &normalized_path)
}

fn initial_document_window_state_for_label(
    registry: &WindowRegistry,
    label: &str,
) -> InitialDocumentWindowState {
    let path = registry.window_paths.get(label).cloned().flatten();

    InitialDocumentWindowState {
        is_new_document: label.starts_with("document-") && path.is_none(),
        path,
    }
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
fn load_app_preferences(
    preferences_state: State<'_, PreferencesState>,
) -> Result<AppPreferences, String> {
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

#[tauri::command]
fn create_document_window(
    app_handle: AppHandle,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<(), String> {
    create_document_window_with_path(&app_handle, &registry_state, None)
}

#[tauri::command]
fn open_document_window(
    app_handle: AppHandle,
    registry_state: State<'_, WindowRegistryState>,
    path: String,
) -> Result<(), String> {
    open_document_window_with_path(&app_handle, &registry_state, path)
}

#[tauri::command]
fn register_window_document_path(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
    path: Option<String>,
) -> Result<(), String> {
    let label = window.label().to_string();
    let normalized_path = path.map(|path| normalize_document_path_for_registry(&path));
    let mut registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;

    registry.register_window(label.clone());
    registry.register_document_path(&label, normalized_path);

    Ok(())
}

#[tauri::command]
fn is_document_path_open_elsewhere(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
    path: String,
) -> Result<bool, String> {
    let registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(is_document_path_open_elsewhere_in_registry(
        &registry,
        window.label(),
        &path,
    ))
}

#[tauri::command]
fn get_initial_document_window_state(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<InitialDocumentWindowState, String> {
    let registry = registry_state
        .registry
        .lock()
        .map_err(|error| error.to_string())?;

    Ok(initial_document_window_state_for_label(
        &registry,
        window.label(),
    ))
}

#[tauri::command]
fn close_document_window(
    window: tauri::Window,
    registry_state: State<'_, WindowRegistryState>,
) -> Result<(), String> {
    let label = window.label().to_string();
    {
        let mut registry = registry_state
            .registry
            .lock()
            .map_err(|error| error.to_string())?;
        registry.unregister_window(&label);
    }

    window.close().map_err(|error| error.to_string())
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
    represented_path_changed: bool,
    title: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let window_for_main_thread = window.clone();
        window
            .run_on_main_thread(move || {
                let Ok(ns_window) = window_for_main_thread.ns_window() else {
                    return;
                };
                let ns_window: &NSWindow = unsafe { &*(ns_window as *mut NSWindow) };

                let title = NSString::from_str(&title);
                ns_window.setTitle(&title);
                ns_window.setDocumentEdited(edited);

                if represented_path_changed {
                    let represented_filename = NSString::from_str(path.as_deref().unwrap_or(""));
                    ns_window.setRepresentedFilename(&represented_filename);
                }
            })
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, path, edited, represented_path_changed, title);
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
                        .expect("missing ns_window") as *mut NSWindow)
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
                        .expect("missing ns_window") as *mut NSWindow)
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

        return rx.recv().map_err(|error| error.to_string())?;
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
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| "failed to access the main thread".to_string())?;
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
        let url = urls
            .firstObject()
            .ok_or_else(|| "missing selected file url".to_string())?;
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

            app.manage(WindowRegistryState {
                registry: Mutex::new(WindowRegistry::default()),
            });

            if let Some(window) = app.get_webview_window("main") {
                let registry_state = app.state::<WindowRegistryState>();
                let mut registry = registry_state
                    .registry
                    .lock()
                    .map_err(|error| error.to_string())?;
                registry.register_window(window.label().to_string());
            }

            let pending_paths = take_pending_open_document_paths();
            if !pending_paths.is_empty() {
                let registry_state = app.state::<WindowRegistryState>();
                open_document_paths(app.handle(), &registry_state, pending_paths);
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            append_debug_log,
            clear_debug_log,
            close_document_window,
            create_document_window,
            get_initial_document_window_state,
            hide_window,
            is_document_path_open_elsewhere,
            load_app_preferences,
            open_document_window,
            open_external_url,
            pick_markdown_file,
            read_markdown_file,
            register_window_document_path,
            save_app_preferences,
            show_window,
            show_unsaved_changes_sheet,
            write_markdown_file,
            sync_window_document_state
        ])
        .build(tauri::generate_context!())
        .expect("error while building ClipMark");

    #[cfg(target_os = "macos")]
    {
        let _ = OPEN_URL_APP_HANDLE.set(app.handle().clone());
        install_safe_open_urls_delegate();
    }

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        match event {
            tauri::RunEvent::Opened { urls } => {
                let registry_state = app_handle.state::<WindowRegistryState>();
                open_document_paths(
                    app_handle,
                    &registry_state,
                    document_paths_from_opened_urls(urls),
                );
            }
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                let mtm = MainThreadMarker::new().expect("failed to access the main thread");
                if NSApplication::sharedApplication(mtm)
                    .modalWindow()
                    .is_some()
                {
                    return;
                }

                let registry_state = app_handle.state::<WindowRegistryState>();
                let _ = create_document_window_with_path(app_handle, &registry_state, None);
            }
            _ => {}
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        document_paths_from_opened_urls, document_window_open_decision, encoded_document_url,
        initial_document_window_state_for_label, is_document_path_open_elsewhere_in_registry,
        load_preferences_from_disk, normalize_document_path_for_registry,
        queue_pending_open_document_paths, reserve_document_window_in_registry,
        rollback_reserved_document_window_in_registry, save_preferences_to_disk,
        take_pending_open_document_paths, validate_external_url, AppPreferences,
        DocumentWindowOpenDecision, InitialDocumentWindowState, ThemeMode, WindowRegistry,
    };
    use serde_json::Value;
    use std::fs;
    use tauri::WebviewUrl;
    use url::Url;

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
    fn document_paths_from_opened_urls_keeps_only_file_paths() {
        let paths = document_paths_from_opened_urls([
            Url::parse("file:///tmp/clipmark-a.md").expect("valid file URL"),
            Url::parse("https://example.com/clipmark-b.md").expect("valid web URL"),
            Url::parse("file:///tmp/clipmark%20space.md").expect("valid encoded file URL"),
        ]);

        assert_eq!(
            paths,
            vec![
                "/tmp/clipmark-a.md".to_string(),
                "/tmp/clipmark space.md".to_string(),
            ],
        );
    }

    #[test]
    fn tauri_config_registers_markdown_file_association() {
        let config_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
        let config: Value = serde_json::from_str(
            &fs::read_to_string(config_path).expect("should read tauri config"),
        )
        .expect("tauri config should be valid JSON");

        let associations = config["bundle"]["fileAssociations"]
            .as_array()
            .expect("bundle.fileAssociations should be configured");
        let markdown = associations
            .iter()
            .find(|association| {
                association["ext"]
                    .as_array()
                    .is_some_and(|extensions| extensions.iter().any(|ext| ext == "md"))
            })
            .expect("markdown association should exist");

        assert_eq!(markdown["role"], "Editor");
        assert_eq!(markdown["rank"], "Owner");
        assert!(markdown["contentTypes"]
            .as_array()
            .expect("markdown association should declare content types")
            .iter()
            .any(|content_type| content_type == "net.daringfireball.markdown"));
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
            preview_panel_width: Some(480),
            toc_panel_width: Some(260),
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
                preview_panel_width: None,
                toc_panel_width: None,
                theme_mode: ThemeMode::System,
            }
        );

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn window_registry_reuses_existing_window_for_open_path() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/clipmark-a.md");

        registry.register_window("main".to_string());
        registry.register_document_path("main", Some(path.clone()));

        assert_eq!(registry.window_for_path(&path), Some("main".to_string()));
    }

    #[test]
    fn window_registry_replaces_old_path_when_window_document_changes() {
        let mut registry = WindowRegistry::default();
        let old_path = normalize_document_path_for_registry("/tmp/old.md");
        let new_path = normalize_document_path_for_registry("/tmp/new.md");

        registry.register_window("document-1".to_string());
        registry.register_document_path("document-1", Some(old_path.clone()));
        registry.register_document_path("document-1", Some(new_path.clone()));

        assert_eq!(registry.window_for_path(&old_path), None);
        assert_eq!(
            registry.window_for_path(&new_path),
            Some("document-1".to_string())
        );
    }

    #[test]
    fn window_registry_detects_paths_open_in_other_windows() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/shared.md");

        registry.register_window("main".to_string());
        registry.register_window("document-1".to_string());
        registry.register_document_path("document-1", Some(path.clone()));

        assert!(registry.is_path_open_elsewhere("main", &path));
        assert!(!registry.is_path_open_elsewhere("document-1", &path));
    }

    #[test]
    fn window_registry_removes_window_mappings_on_close() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/closing.md");

        registry.register_window("document-2".to_string());
        registry.register_document_path("document-2", Some(path.clone()));
        registry.unregister_window("document-2");

        assert_eq!(registry.window_for_path(&path), None);
    }

    #[test]
    fn window_registry_clears_previous_owner_when_path_moves_between_windows() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/moved-owner.md");

        registry.register_window("main".to_string());
        registry.register_window("document-1".to_string());
        registry.register_document_path("main", Some(path.clone()));
        registry.register_document_path("document-1", Some(path.clone()));

        assert_eq!(registry.window_paths.get("main"), Some(&None));
        assert_eq!(
            registry.window_paths.get("document-1"),
            Some(&Some(path.clone()))
        );
        assert_eq!(
            registry.window_for_path(&path),
            Some("document-1".to_string())
        );

        registry.unregister_window("document-1");

        assert_eq!(registry.window_for_path(&path), None);
        assert!(!registry.is_path_open_elsewhere("document-2", &path));
    }

    #[test]
    fn document_path_open_elsewhere_helper_uses_registry() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/shared-save-as.md");

        registry.register_window("main".to_string());
        registry.register_window("document-1".to_string());
        registry.register_document_path("document-1", Some(path.clone()));

        assert!(is_document_path_open_elsewhere_in_registry(
            &registry,
            "main",
            "/tmp/shared-save-as.md",
        ));
        assert!(!is_document_path_open_elsewhere_in_registry(
            &registry,
            "document-1",
            "/tmp/shared-save-as.md",
        ));
    }

    #[test]
    fn document_window_reservation_registers_path_before_window_build() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/reserved-before-build.md");

        let label = reserve_document_window_in_registry(
            &mut registry,
            Some("/tmp/reserved-before-build.md"),
        );

        assert_eq!(label, "document-1");
        assert_eq!(registry.window_for_path(&path), Some(label));
    }

    #[test]
    fn document_window_reservation_rolls_back_path_when_build_fails() {
        let mut registry = WindowRegistry::default();
        let path = normalize_document_path_for_registry("/tmp/rollback-build-failure.md");

        let label = reserve_document_window_in_registry(
            &mut registry,
            Some("/tmp/rollback-build-failure.md"),
        );

        rollback_reserved_document_window_in_registry(&mut registry, &label);

        assert_eq!(registry.window_for_path(&path), None);
        assert_eq!(registry.window_paths.get(&label), None);
    }

    #[test]
    fn document_window_open_decision_treats_reserved_path_as_already_opening() {
        assert_eq!(
            document_window_open_decision(Some("document-1".to_string()), false),
            DocumentWindowOpenDecision::AlreadyOpening,
        );
    }

    #[test]
    fn document_window_open_decision_focuses_existing_window() {
        assert_eq!(
            document_window_open_decision(Some("document-1".to_string()), true),
            DocumentWindowOpenDecision::Focus("document-1".to_string()),
        );
    }

    #[test]
    fn document_window_open_decision_creates_when_path_is_not_registered() {
        assert_eq!(
            document_window_open_decision(None, false),
            DocumentWindowOpenDecision::Create,
        );
    }

    #[test]
    fn pending_open_document_paths_are_drained_once() {
        let _ = take_pending_open_document_paths();
        queue_pending_open_document_paths(vec![
            "/tmp/finder-a.md".to_string(),
            "/tmp/finder-b.md".to_string(),
        ]);

        assert_eq!(
            take_pending_open_document_paths(),
            vec![
                "/tmp/finder-a.md".to_string(),
                "/tmp/finder-b.md".to_string(),
            ],
        );
        assert_eq!(take_pending_open_document_paths(), Vec::<String>::new());
    }

    #[test]
    fn document_window_url_marks_untitled_windows_as_new_documents() {
        let WebviewUrl::App(path) = encoded_document_url(None) else {
            panic!("document windows should use an app URL");
        };

        assert_eq!(path.to_string_lossy(), "index.html?new=1");
    }

    #[test]
    fn document_window_url_encodes_initial_document_path() {
        let WebviewUrl::App(path) = encoded_document_url(Some("/tmp/note with space.md")) else {
            panic!("document windows should use an app URL");
        };

        assert_eq!(
            path.to_string_lossy(),
            "index.html?path=%2Ftmp%2Fnote%20with%20space.md"
        );
    }

    #[test]
    fn initial_document_window_state_returns_reserved_path_for_document_window() {
        let mut registry = WindowRegistry::default();
        registry.register_window("document-1".to_string());
        registry.register_document_path("document-1", Some("/tmp/open.md".to_string()));

        assert_eq!(
            initial_document_window_state_for_label(&registry, "document-1"),
            InitialDocumentWindowState {
                is_new_document: false,
                path: Some("/tmp/open.md".to_string()),
            },
        );
    }

    #[test]
    fn initial_document_window_state_marks_pathless_document_window_as_new() {
        let mut registry = WindowRegistry::default();
        registry.register_window("document-1".to_string());

        assert_eq!(
            initial_document_window_state_for_label(&registry, "document-1"),
            InitialDocumentWindowState {
                is_new_document: true,
                path: None,
            },
        );
    }

    #[test]
    fn initial_document_window_state_keeps_main_window_as_welcome() {
        let mut registry = WindowRegistry::default();
        registry.register_window("main".to_string());

        assert_eq!(
            initial_document_window_state_for_label(&registry, "main"),
            InitialDocumentWindowState {
                is_new_document: false,
                path: None,
            },
        );
    }
}
