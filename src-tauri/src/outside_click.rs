//! Dismiss the expanded panel when the user clicks outside the HWND.
//! Always-on-top widgets often keep focus, so a low-level mouse hook is
//! more reliable than blur alone.
//!
//! Windows: WH_MOUSE_LL global hook.
//! macOS / Linux: no-op here — frontend uses blur / onFocusChanged instead.

use std::sync::OnceLock;

use tauri::{AppHandle, Emitter, Manager};

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn install(app: &AppHandle) {
    let _ = APP.set(app.clone());

    #[cfg(windows)]
    install_mouse_hook();
}

#[cfg(windows)]
fn install_mouse_hook() {
    use windows::Win32::Foundation::HINSTANCE;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowsHookExW, WH_MOUSE_LL};

    unsafe {
        let module = GetModuleHandleW(None)
            .ok()
            .map(|handle| HINSTANCE(handle.0));
        let _ = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), module, 0);
    }
}

#[cfg(windows)]
unsafe extern "system" fn mouse_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, HC_ACTION, MSLLHOOKSTRUCT, WM_LBUTTONDOWN,
    };

    if code == HC_ACTION as i32 && wparam.0 as u32 == WM_LBUTTONDOWN {
        let info = unsafe { &*(lparam.0 as *const MSLLHOOKSTRUCT) };
        maybe_emit_outside_click(info.pt.x, info.pt.y);
    }

    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

#[cfg(windows)]
fn maybe_emit_outside_click(x: i32, y: i32) {
    let Some(app) = APP.get() else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if !window.is_visible().unwrap_or(false) {
        return;
    }

    let Ok(pos) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };

    // Collapsed orb is ~60 logical CSS pixels; only dismiss the expanded panel.
    let scale = window.scale_factor().unwrap_or(1.0);
    let orb_limit = (78.0 * scale) as u32;
    if size.width <= orb_limit && size.height <= orb_limit {
        return;
    }

    let left = pos.x;
    let top = pos.y;
    let right = pos.x.saturating_add_unsigned(size.width);
    let bottom = pos.y.saturating_add_unsigned(size.height);

    let inside = x >= left && x < right && y >= top && y < bottom;
    if inside {
        return;
    }

    let _ = window.emit("eskusmi-click-outside", ());
}
