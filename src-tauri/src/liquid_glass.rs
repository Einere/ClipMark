use std::cell::RefCell;
use std::collections::HashMap;
use objc2::{define_class, msg_send, sel, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, NSObject};
use objc2_app_kit::{NSButton, NSCursor, NSGlassEffectView, NSView, NSWindow};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
use tauri::{Emitter, Manager, WebviewWindow};

struct TargetState { window: WebviewWindow }

define_class!(
    #[unsafe(super(NSButton))]
    #[thread_kind = MainThreadOnly]
    struct FloatingButton;
    impl FloatingButton {
        #[unsafe(method(resetCursorRects))]
        fn reset_cursor_rects(&self) {
            unsafe { let _: () = msg_send![super(self), resetCursorRects]; }
            let cursor = if self.isEnabled() { NSCursor::pointingHandCursor() } else { NSCursor::arrowCursor() };
            self.addCursorRect_cursor(self.bounds(), &cursor);
        }
    }
);

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = TargetState]
    struct ControlTarget;
    impl ControlTarget {
        #[unsafe(method(copyPath:))]
        fn copy_path(&self, _sender: &NSButton) {
            let _ = self.ivars().window.emit("native-control-action", "copy-path");
        }
        #[unsafe(method(togglePreview:))]
        fn toggle_preview(&self, _sender: &NSButton) {
            let _ = self.ivars().window.emit("native-control-action", "toggle-preview");
        }
    }
);

struct Controls {
    path_glass: Retained<NSView>,
    preview_glass: Retained<NSView>,
    path_button: Retained<NSButton>,
    preview_button: Retained<NSButton>,
    _target: Retained<ControlTarget>,
}

thread_local! { static CONTROLS: RefCell<HashMap<String, Controls>> = RefCell::new(HashMap::new()); }

fn rect(x: f64, y: f64, w: f64, h: f64) -> NSRect {
    NSRect::new(NSPoint::new(x, y), NSSize::new(w, h))
}

fn glass_button(mtm: MainThreadMarker, target: &ControlTarget, action: objc2::runtime::Sel) -> (Retained<NSView>, Retained<NSButton>) {
    // Never request the macOS 26 class on systems that do not provide it.
    let has_liquid_glass = AnyClass::get(c"NSGlassEffectView").is_some();
    let button = FloatingButton::alloc(mtm).set_ivars(());
    let button: Retained<FloatingButton> = unsafe { msg_send![super(button), initWithFrame: rect(0.0, 0.0, 100.0, 44.0)] };
    let button = button.into_super();
    button.setBordered(!has_liquid_glass);
    unsafe {
        button.setTarget(Some(target));
        button.setAction(Some(action));
        let _: () = msg_send![&*button, setFocusRingType: 0usize];
        // AppKit performs native truncation; the action keeps the original path.
        let cell: Retained<objc2::runtime::AnyObject> = msg_send![&*button, cell];
        let _: () = msg_send![&*cell, setLineBreakMode: 5isize];
    }
    let glass = if has_liquid_glass {
        let glass = NSGlassEffectView::initWithFrame(NSGlassEffectView::alloc(mtm), rect(0.0, 0.0, 100.0, 44.0));
        glass.setCornerRadius(22.0);
        glass.setContentView(Some(&button));
        glass.into_super()
    } else {
        let view = NSView::initWithFrame(NSView::alloc(mtm), rect(0.0, 0.0, 100.0, 44.0));
        view.addSubview(&button);
        view
    };
    (glass, button)
}

fn layout(controls: &Controls, content: &NSView) {
    let width = content.bounds().size.width;
    let path_width = (width - 148.0).clamp(44.0, 420.0);
    let y = if content.isFlipped() { content.bounds().size.height - 60.0 } else { 16.0 };
    controls.path_glass.setFrame(rect(16.0, y, path_width, 44.0));
    controls.path_button.setFrame(rect(0.0, 0.0, path_width, 44.0));
    controls.preview_glass.setFrame(rect(width - 116.0, y, 100.0, 44.0));
    controls.preview_button.setFrame(rect(0.0, 0.0, 100.0, 44.0));
}

pub fn resize(window: &WebviewWindow) {
    let label = window.label().to_string();
    let app = window.app_handle().clone();
    let _ = window.run_on_main_thread(move || {
        let Some(window) = app.get_webview_window(&label) else { return; };
        let Ok(pointer) = window.ns_window() else { return; };
        let native = unsafe { &*(pointer as *const NSWindow) };
        if let Some(content) = native.contentView() {
            CONTROLS.with(|all| {
                if let Some(controls) = all.borrow().get(&label) { layout(controls, &content); }
            });
        }
    });
}

pub fn remove(label: String, app: &tauri::AppHandle) {
    let _ = app.run_on_main_thread(move || {
        CONTROLS.with(|all| {
            if let Some(controls) = all.borrow_mut().remove(&label) {
                controls.path_glass.removeFromSuperview();
                controls.preview_glass.removeFromSuperview();
            }
        });
    });
}

#[tauri::command]
pub async fn sync_native_controls(window: WebviewWindow, path: Option<String>, preview_open: bool) -> Result<bool, String> {
    let label = window.label().to_string();
    let app = window.app_handle().clone();
    window.run_on_main_thread(move || {
        let Some(callback_window) = app.get_webview_window(&label) else { return; };
        let Ok(pointer) = callback_window.ns_window() else { return; };
        let mtm = MainThreadMarker::new().expect("native controls require main thread");
        let native = unsafe { &*(pointer as *const NSWindow) };
        let Some(content) = native.contentView() else { return; };
        CONTROLS.with(|all| {
            let mut all = all.borrow_mut();
            let controls = all.entry(label).or_insert_with(|| {
                let target = ControlTarget::alloc(mtm).set_ivars(TargetState { window: callback_window });
                let target: Retained<ControlTarget> = unsafe { msg_send![super(target), init] };
                let (path_glass, path_button) = glass_button(mtm, &target, sel!(copyPath:));
                let (preview_glass, preview_button) = glass_button(mtm, &target, sel!(togglePreview:));
                content.addSubview(&path_glass);
                content.addSubview(&preview_glass);
                Controls { path_glass, preview_glass, path_button, preview_button, _target: target }
            });
            controls.path_button.setTitle(&NSString::from_str(path.as_deref().unwrap_or("Unsaved document")));
            controls.path_button.setEnabled(path.is_some());
            native.invalidateCursorRectsForView(&controls.path_button);
            native.invalidateCursorRectsForView(&controls.preview_button);
            controls.preview_button.setTitle(&NSString::from_str(if preview_open { "Hide preview" } else { "Preview" }));
            unsafe {
                let _: () = msg_send![&*controls.path_button, setAccessibilityLabel: &*NSString::from_str("Copy file path")];
                let _: () = msg_send![&*controls.preview_button, setAccessibilityLabel: &*NSString::from_str("Toggle preview")];
            }
            layout(controls, &content);
        });
    }).map(|_| true).map_err(|e| e.to_string())
}
