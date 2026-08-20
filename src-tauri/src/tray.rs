use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::network::NetworkState;
use crate::protocol::PresenceStatus;

pub struct TrayStatusItems {
    available: CheckMenuItem<tauri::Wry>,
    focus: CheckMenuItem<tauri::Wry>,
    away: CheckMenuItem<tauri::Wry>,
    busy: CheckMenuItem<tauri::Wry>,
}

impl TrayStatusItems {
    pub fn sync(&self, status: PresenceStatus) {
        let _ = self
            .available
            .set_checked(matches!(status, PresenceStatus::Available));
        let _ = self
            .focus
            .set_checked(matches!(status, PresenceStatus::Focus));
        let _ = self.away.set_checked(matches!(status, PresenceStatus::Away));
        let _ = self.busy.set_checked(matches!(status, PresenceStatus::Busy));
    }
}

pub fn sync_tray_status(app: &AppHandle, status: PresenceStatus) {
    if let Some(items) = app.try_state::<TrayStatusItems>() {
        items.sync(status);
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn apply_status(app: &AppHandle, status: PresenceStatus) {
    if let Some(state) = app.try_state::<NetworkState>() {
        if let Some(identity) = state.identity_snapshot() {
            state.set_presence(identity.name, status.clone());
        }
    }

    sync_tray_status(app, status.clone());

    let _ = app.emit(
        "presence-changed",
        serde_json::json!({ "status": status.as_str() }),
    );
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let available =
        CheckMenuItem::with_id(app, "status_available", "Available", true, true, None::<&str>)?;
    let focus =
        CheckMenuItem::with_id(app, "status_focus", "Focus", true, false, None::<&str>)?;
    let away = CheckMenuItem::with_id(app, "status_away", "Away", true, false, None::<&str>)?;
    let busy = CheckMenuItem::with_id(app, "status_busy", "Busy", true, false, None::<&str>)?;

    app.manage(TrayStatusItems {
        available: available.clone(),
        focus: focus.clone(),
        away: away.clone(),
        busy: busy.clone(),
    });

    let status_menu = Submenu::with_id_and_items(
        app,
        "status_menu",
        "Status",
        true,
        &[&available, &focus, &away, &busy],
    )?;

    let open_item = MenuItem::with_id(app, "open", "Open eskusmi", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit eskusmi", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "title", "eskusmi", false, None::<&str>)?,
            &separator,
            &status_menu,
            &PredefinedMenuItem::separator(app)?,
            &open_item,
            &quit_item,
        ],
    )?;

    let Some(icon) = app.default_window_icon().cloned() else {
        eprintln!("[eskusmi] No default window icon for tray");
        return Ok(());
    };

    let _tray = TrayIconBuilder::with_id("eskusmi_tray")
        .icon(icon)
        .tooltip("eskusmi")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => {
                app.exit(0);
            }
            "status_available" => apply_status(app, PresenceStatus::Available),
            "status_focus" => apply_status(app, PresenceStatus::Focus),
            "status_away" => apply_status(app, PresenceStatus::Away),
            "status_busy" => apply_status(app, PresenceStatus::Busy),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}
