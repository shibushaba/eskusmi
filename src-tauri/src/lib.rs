#[cfg(not(windows))]
use tauri::window::Color;
use tauri::{Manager, PhysicalPosition, WindowEvent};

mod discovery;
mod network;
mod peers;
mod protocol;
mod tray;

use network::NetworkState;

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
                        R: 0,
                        G: 0,
                        B: 0,
                        A: 0,
                    });
                }
            }
        });

        if let Ok(hwnd) = window.hwnd() {
            unsafe {
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

                // Prevent DWM from rounding the HWND; we round in CSS so corners stay truly transparent.
                let preference: u32 = 1; // DWMWCP_DONOTROUND
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

                // Hard clip: ellipse for orb, rounded rect for panels.
                // Guarantees no visible rectangular HWND fringe even if compositing is imperfect.
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
unsafe fn apply_window_shape(
    hwnd: windows::Win32::Foundation::HWND,
    window: &tauri::WebviewWindow,
) {
    use windows::Win32::Graphics::Gdi::{CreateEllipticRgn, CreateRoundRectRgn, SetWindowRgn};

    let Ok(size) = window.outer_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let w = size.width as i32;
    let h = size.height as i32;
    if w <= 0 || h <= 0 {
        return;
    }

    // Collapsed orb is 60×60 logical; treat anything near that as circular.
    let orb_threshold = (78.0 * scale) as u32;
    let region = if size.width <= orb_threshold && size.height <= orb_threshold {
        CreateEllipticRgn(0, 0, w, h)
    } else {
        // Match CSS --esk-radius-lg (~18px logical).
        let corner = ((18.0 * scale).round() as i32).max(8) * 2;
        CreateRoundRectRgn(0, 0, w + 1, h + 1, corner, corner)
    };

    let _ = SetWindowRgn(hwnd, Some(region), true);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let network_state = NetworkState::new().expect("failed to init network state");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(network_state)
        .invoke_handler(tauri::generate_handler![
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

            if let Err(err) = tray::setup_tray(&handle) {
                eprintln!("[eskusmi] Tray setup failed: {err}");
            }

            let window = app
                .get_webview_window("main")
                .expect("missing main window");

            harden_window_transparency(&window);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(60.0, 60.0)));
            place_bottom_right(&window);

            let delayed = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(250));
                harden_window_transparency(&delayed);
                if let (Ok(size), Ok(scale)) = (delayed.outer_size(), delayed.scale_factor()) {
                    let max_inflate = (180.0 * scale) as u32;
                    let min_inflate = (70.0 * scale) as u32;
                    if size.width > min_inflate && size.width < max_inflate {
                        let _ = delayed
                            .set_size(tauri::Size::Logical(tauri::LogicalSize::new(60.0, 60.0)));
                    }
                }
                place_bottom_right(&delayed);
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
