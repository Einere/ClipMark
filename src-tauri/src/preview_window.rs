use std::collections::HashMap;
use std::sync::{Mutex, atomic::{AtomicU64, Ordering}};
use serde::{Serialize, Deserialize};
use tauri::{Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder, WebviewUrl};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewConnection { pub owner_label: String, pub preview_label: String, pub connection_id: String }

#[derive(Default)]
pub struct PreviewWindows { links: Mutex<HashMap<String, PreviewConnection>>, next: AtomicU64 }

fn connection_for(state: &PreviewWindows, label: &str) -> Result<Option<PreviewConnection>, String> {
    Ok(state.links.lock().map_err(|e| e.to_string())?.values().find(|c| c.owner_label == label || c.preview_label == label).cloned())
}

#[tauri::command]
pub fn get_preview_connection(window: WebviewWindow, state: State<'_, PreviewWindows>) -> Result<Option<PreviewConnection>, String> {
    connection_for(&state, window.label())
}

#[tauri::command]
pub async fn toggle_preview_window(window: WebviewWindow, state: State<'_, PreviewWindows>) -> Result<Option<PreviewConnection>, String> {
    if let Some(connection) = connection_for(&state, window.label())? {
        if let Some(preview) = window.app_handle().get_webview_window(&connection.preview_label) {
            preview.close().map_err(|e| e.to_string())?;
        }
        return Ok(None);
    }
    if window.label().starts_with("preview-") { return Err("Preview owner has closed.".into()); }
    let id = state.next.fetch_add(1, Ordering::Relaxed).to_string();
    let connection = PreviewConnection { owner_label: window.label().into(), preview_label: format!("preview-{}-{id}", window.label()), connection_id: id };
    {
        let mut links = state.links.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = links.get(window.label()) { return Ok(Some(existing.clone())); }
        links.insert(window.label().into(), connection.clone());
    }
    let result = WebviewWindowBuilder::new(window.app_handle(), &connection.preview_label, WebviewUrl::App("index.html?preview=1".into()))
        .title("Preview · ClipMark").inner_size(640.0, 720.0).min_inner_size(320.0, 240.0).focused(false).build();
    let preview = match result {
        Ok(preview) => preview,
        Err(error) => { state.links.lock().map_err(|e| e.to_string())?.remove(window.label()); return Err(error.to_string()); }
    };
    let position_result = (|| -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let origin = window.outer_position().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let size = window.outer_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let area = monitor.work_area();
        let area_origin = area.position.to_logical::<f64>(scale);
        let area_size = area.size.to_logical::<f64>(scale);
        let preview_scale = preview.scale_factor().map_err(|e| e.to_string())?;
        let preview_size = preview.outer_size().map_err(|e| e.to_string())?.to_logical::<f64>(preview_scale);
        let (x, y) = placement((origin.x, origin.y, size.width, size.height), (area_origin.x, area_origin.y, area_size.width, area_size.height), (preview_size.width, preview_size.height));
        preview.set_position(tauri::LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    }
    Ok(())
    })();
    if let Err(error) = position_result {
        state.links.lock().map_err(|e| e.to_string())?.remove(window.label());
        let _ = preview.close();
        return Err(error);
    }
    Ok(Some(connection))
}

pub fn placement(parent: (f64,f64,f64,f64), area: (f64,f64,f64,f64), size: (f64,f64)) -> (f64,f64) {
    let (x,y,w,h) = parent; let (ax,ay,aw,ah) = area; let (pw,ph) = size;
    let clamp = |value: f64, start: f64, length: f64, extent: f64| value.clamp(start, (start + length - extent).max(start));
    let candidates = [(x+w+12.0,clamp(y,ay,ah,ph)),(x-pw-12.0,clamp(y,ay,ah,ph)),(clamp(x,ax,aw,pw),y+h+12.0),(clamp(x,ax,aw,pw),y-ph-12.0)];
    for (cx,cy) in candidates {
        if cx>=ax && cy>=ay && cx+pw<=ax+aw && cy+ph<=ay+ah { return (cx,cy); }
    }
    // ponytail: impossible non-overlap uses minimum overlap on the current screen; no other-app window scan.
    candidates.into_iter().map(|(cx,cy)| (clamp(cx,ax,aw,pw),clamp(cy,ay,ah,ph)))
        .min_by(|a,b| {
            let overlap = |(cx,cy): (f64,f64)| ((cx+pw).min(x+w)-cx.max(x)).max(0.0)*((cy+ph).min(y+h)-cy.max(y)).max(0.0);
            overlap(*a).total_cmp(&overlap(*b))
        }).unwrap()
}

#[tauri::command]
pub fn preview_ready(window: WebviewWindow, state: State<'_, PreviewWindows>) -> Result<(), String> {
    let connection = connection_for(&state, window.label())?.ok_or("Preview is disconnected")?;
    if window.label() != connection.preview_label { return Err("Only a preview can request state.".into()); }
    window.app_handle().emit_to(&connection.owner_label, "preview-ready", &connection).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn publish_preview_snapshot(window: WebviewWindow, state: State<'_, PreviewWindows>, mut snapshot: serde_json::Value) -> Result<(), String> {
    let connection = connection_for(&state, window.label())?.ok_or("Preview is closed")?;
    if window.label() != connection.owner_label || snapshot["connectionId"] != connection.connection_id { return Err("Invalid preview publisher.".into()); }
    snapshot["ownerLabel"] = connection.owner_label.into();
    window.app_handle().emit_to(&connection.preview_label, "preview-snapshot", snapshot).map_err(|e| e.to_string())
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PreviewAction { Save, SaveAs, New, Open, OpenRecent, ClearRecent, CopyPath, TogglePreview, ToggleToc, ToggleExternalMedia, SetThemeMode, FocusEditor }

#[tauri::command]
pub fn preview_document_action(window: WebviewWindow, state: State<'_, PreviewWindows>, action: PreviewAction, value: Option<String>) -> Result<(), String> {
    let connection = connection_for(&state, window.label())?.ok_or("Preview is disconnected")?;
    if window.label() != connection.preview_label { return Err("Only a preview can route actions.".into()); }
    window.app_handle().emit_to(&connection.owner_label, "preview-document-action", serde_json::json!({"action": action, "value": value})).map_err(|e| e.to_string())
}

pub fn destroyed(app: &tauri::AppHandle, label: &str) {
    let state = app.state::<PreviewWindows>();
    let Ok(Some(connection)) = connection_for(&state, label) else { return; };
    if let Ok(mut links) = state.links.lock() { links.remove(&connection.owner_label); }
    if label == connection.owner_label {
        if let Some(preview) = app.get_webview_window(&connection.preview_label) { let _ = preview.close(); }
    } else if let Some(owner) = app.get_webview_window(&connection.owner_label) {
        let _ = owner.emit("preview-closed", &connection);
        let _ = owner.set_focus();
        let _ = owner.emit("preview-document-action", serde_json::json!({"action": "focus-editor"}));
    }
}

#[cfg(test)]
mod tests {
    use super::placement;
    #[test] fn prefers_right_then_left_without_overlap() {
        assert_eq!(placement((0.0,0.0,500.0,700.0),(0.0,0.0,1600.0,900.0),(640.0,720.0)),(512.0,0.0));
        assert_eq!(placement((900.0,0.0,500.0,700.0),(0.0,0.0,1600.0,900.0),(640.0,720.0)),(248.0,0.0));
    }
    #[test] fn handles_negative_origin_and_impossible_fit() {
        assert_eq!(placement((-1400.0,0.0,500.0,700.0),(-1600.0,0.0,1600.0,900.0),(640.0,720.0)),(-888.0,0.0));
        let (x,y)=placement((0.0,0.0,1000.0,800.0),(0.0,0.0,1000.0,800.0),(640.0,720.0));
        assert!(x>=0.0 && y>=0.0 && x+640.0<=1000.0 && y+720.0<=800.0);
    }
}
