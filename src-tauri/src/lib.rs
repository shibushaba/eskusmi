#[cfg(not(windows))]
use tauri::window::Color;
use tauri::{Manager, PhysicalPosition, WindowEvent};

mod discovery;
mod network;
mod outside_click;
mod peers;
mod protocol;
mod tray;

use network::NetworkState;

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn place_bottom_right(window: &tauri::WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    let work = *monitor.work_area();
    let scale = monitor.scale_factor();
    let size = window.outer_size().unwrap_or_else(|_| {
        tauri::PhysicalSize::new((60.0 * scale) as u32, (60.0 * scale) as u32)
    });
    let margin = (20.0 * scale) as i32;
    let x = work.position.x + work.size.width as i32 - size.width as i32 - margin;
    let y = work.position.y + work.size.height as i32 - size.height as i32 - margin;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

/// Windows often paints a gray/white square behind transparent undecorated
/// windows unless shadow is forced off and the webview background is fully clear.
fn harden_window_transparency(window: &tauri::WebviewWindow) {
    let _ = window.set_shadow(false);
    let _ = window.set_decorations(false);

    // Important: on Windows, HWND backgroundColor ignores alpha and becomes opaque.
    // Prefer leaving the window brush alone and force WebView2's DefaultBackgroundColor
    // to A=0 (true transparency) instead of Color(0,0,0,0) on the HWND.
    #[cfg(windows)]
    {
        let _ = window.with_webview(|webview| {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                ICoreWebView2Controller2, COREWEBVIEW2_COLOR,
            };
            use windows::core::Interface;

            unsafe {
                if let Ok(controller2) = webview.controller().cast::<ICoreWebView2Controller2>() {
                    let _ = controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR {
                        // Match CSS surface — never leave clear pixels for the compositor
                        // to fill with light corner triangles.
                        R: 0x11,
                        G: 0x11,
                        B: 0x13,
                        A: 255,
                    });
                }
            }
        });

        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                strip_os_chrome(hwnd);

                // Fully extend the DWM frame so client area can be truly transparent.
                let margins = windows::Win32::UI::Controls::MARGINS {
                    cxLeftWidth: -1,
                    cxRightWidth: -1,
                    cyTopHeight: -1,
                    cyBottomHeight: -1,
                };
                let _ = windows::Win32::Graphics::Dwm::DwmExtendFrameIntoClientArea(
                    hwnd,
                    &margins,
                );

                // Win11 DWM rounds with anti-aliasing. Prefer that over CSS-radius
                // on a transparent HWND (ghost light corners) or SetWindowRgn (jagged).
                let preference: u32 = 2; // DWMWCP_ROUND
                let _ = windows::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                    hwnd,
                    windows::Win32::Graphics::Dwm::DWMWA_WINDOW_CORNER_PREFERENCE,
                    std::ptr::addr_of!(preference).cast(),
                    std::mem::size_of::<u32>() as u32,
                );

                // Kill the 1px Win11 system border that reads as a gray square on transparent widgets.
                let border_none: u32 = 0xFFFFFFFE; // DWMWA_COLOR_NONE
                let _ = windows::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                    hwnd,
                    windows::Win32::Graphics::Dwm::DWMWA_BORDER_COLOR,
                    std::ptr::addr_of!(border_none).cast(),
                    std::mem::size_of::<u32>() as u32,
                );

                let disable_transitions: i32 = 1;
                let _ = windows::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                    hwnd,
                    windows::Win32::Graphics::Dwm::DWMWA_TRANSITIONS_FORCEDISABLED,
                    std::ptr::addr_of!(disable_transitions).cast(),
                    std::mem::size_of::<i32>() as u32,
                );

                apply_window_shape(hwnd, window);
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    }
}

#[cfg(windows)]
unsafe fn strip_os_chrome(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        WS_BORDER, WS_CAPTION, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_DLGFRAME, WS_MAXIMIZEBOX,
        WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME, WS_EX_APPWINDOW, WS_EX_CLIENTEDGE,
        WS_EX_DLGMODALFRAME, WS_EX_LAYERED, WS_EX_STATICEDGE, WS_EX_TOOLWINDOW, WS_EX_WINDOWEDGE,
        WINDOW_EX_STYLE, WINDOW_STYLE,
    };

    let style = WINDOW_STYLE(GetWindowLongPtrW(hwnd, GWL_STYLE) as u32);
    let style = (style
        & !(WS_CAPTION
            | WS_THICKFRAME
            | WS_MINIMIZEBOX
            | WS_MAXIMIZEBOX
            | WS_SYSMENU
            | WS_BORDER
            | WS_DLGFRAME))
        | WS_POPUP
        | WS_CLIPCHILDREN
        | WS_CLIPSIBLINGS;
    SetWindowLongPtrW(hwnd, GWL_STYLE, style.0 as isize);

    let ex = WINDOW_EX_STYLE(GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32);
    let ex = (ex
        & !(WS_EX_APPWINDOW
            | WS_EX_WINDOWEDGE
            | WS_EX_DLGMODALFRAME
            | WS_EX_CLIENTEDGE
            | WS_EX_STATICEDGE
            | WS_EX_LAYERED
            | WINDOW_EX_STYLE(0x0020_0000))) // WS_EX_NOREDIRECTIONBITMAP
        | WS_EX_TOOLWINDOW;
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex.0 as isize);

    let _ = SetWindowPos(
        hwnd,
        None,
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
    );
}

#[cfg(windows)]
unsafe fn apply_window_shape(
    hwnd: windows::Win32::Foundation::HWND,
    window: &tauri::WebviewWindow,
) {
    use windows::Win32::Graphics::Gdi::SetWindowRgn;

    let Ok(size) = window.outer_size() else {
        return;
    };
    if size.width == 0 || size.height == 0 {
        return;
    }

    // Keep a rectangular client region. Soft rounding comes from
    // DWMWA_WINDOW_CORNER_PREFERENCE (DWMWCP_ROUND), not GDI regions.
    let _ = SetWindowRgn(hwnd, None, true);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let network_state = NetworkState::new().expect("failed to init network state");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("eskusmi")
                .macos_launcher(tauri_plugin_autostart::MacosLauncher::LaunchAgent)
                .build(),
        )
        .manage(network_state)
        .invoke_handler(tauri::generate_handler![
            quit_app,
            network::start_network,
            network::get_network_status,
            network::update_presence,
            network::list_peers,
            network::ping_peer,
            network::acknowledge_ping,
            network::list_incoming_pings,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Dockless tray-style widget on macOS (floats across Spaces better).
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            if let Err(err) = tray::setup_tray(&handle) {
                eprintln!("[eskusmi] Tray setup failed: {err}");
            }

            outside_click::install(&handle);

            let window = app
                .get_webview_window("main")
                .expect("missing main window");

            harden_window_transparency(&window);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(60.0, 60.0)));
            place_bottom_right(&window);

            // WebView2 (and some Linux compositors) need a short delay before
            // transparency / placement settles.
            let delayed = window.clone();
            std::thread::spawn(move || {
                for ms in [50_u64, 150, 300, 800, 1600] {
                    std::thread::sleep(std::time::Duration::from_millis(ms));
                    if let (Ok(size), Ok(scale)) = (delayed.outer_size(), delayed.scale_factor()) {
                        let orb_limit = (78.0 * scale) as u32;
                        if size.width > orb_limit || size.height > orb_limit {
                            continue;
                        }
                    }
                    harden_window_transparency(&delayed);
                    place_bottom_right(&delayed);
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
                    // Re-apply after resize — Windows can restore opaque compositing.
                    if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                        harden_window_transparency(&webview);
                    }
                }
                WindowEvent::CloseRequested { api, .. } => {
                    // Keep running in the tray; Quit eskusmi exits for real.
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
