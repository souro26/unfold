#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod overlay;
mod commands;
mod screen_capture;

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::overlay::OverlayManager;
use crate::commands::AppState;

fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("=== UNFOLD STARTING ===");
    tracing::info!("RUST_LOG = {:?}", std::env::var("RUST_LOG"));

    tauri::Builder::default()
        // Exclude the programmatic "overlay" window from window-state persistence so saved
        // hidden/minimized states never corrupt the transparent overlay's styles or bounds.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["overlay"])
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    tracing::debug!(
                        "Global shortcut triggered: {:?}, state: {:?}",
                        shortcut,
                        event.state
                    );
                    if event.state == ShortcutState::Released {
                        return;
                    }
                    let shortcut_str = shortcut.to_string().to_lowercase();
                    tracing::info!("Shortcut received: '{}'", shortcut_str);
                    let state = app.state::<Arc<Mutex<overlay::OverlayManager>>>();

                    // Split into discrete tokens so "shift" never false-matches "i"
                    let tokens: Vec<&str> = shortcut_str
                        .split(|c: char| c == '+' || c.is_whitespace())
                        .filter(|s| !s.is_empty())
                        .collect();

                    let has_ctrl = tokens.iter().any(|&t| t == "control" || t == "ctrl");
                    let has_shift = tokens.iter().any(|&t| t == "shift");
                    let has_alt = tokens.iter().any(|&t| t == "alt");
                    let has_u = tokens.iter().any(|&t| t == "u" || t == "keyu");
                    let has_i = tokens.iter().any(|&t| t == "i" || t == "keyi");
                    let has_x = tokens.iter().any(|&t| t == "x" || t == "keyx");

                    // Ctrl+Shift+U: toggle overlay AND open command palette at bottom center
                    let is_toggle_and_palette = has_ctrl && has_shift && has_u && !has_alt;
                    // Ctrl+I: show command palette
                    let is_ctrl_i = has_ctrl && has_i && !has_shift && !has_alt;
                    // Ctrl+Shift+X: toggle click-through while overlay is visible
                    let is_toggle_click_through = has_ctrl && has_shift && has_x && !has_alt;

                    tracing::info!(
                        "Parsed tokens={:?} -> toggle_and_palette={}, ctrl_i={}, toggle_click_through={}",
                        tokens,
                        is_toggle_and_palette,
                        is_ctrl_i,
                        is_toggle_click_through
                    );

                    if is_toggle_and_palette {
                        tracing::info!(
                            "Action: Ctrl+Shift+U (toggle overlay + command palette at bottom)"
                        );
                        let o = state.inner().clone();
                        tauri::async_runtime::spawn(async move {
                            let mut m = o.lock().await;
                            m.toggle().await;
                            if m.is_visible() {
                                m.app.emit("overlay:show-command-palette-bottom", ()).ok();
                            }
                        });
                    } else if is_ctrl_i {
                        tracing::info!("Action: Ctrl+I (show command palette)");
                        let o = state.inner().clone();
                        tauri::async_runtime::spawn(async move {
                            let mut m = o.lock().await;
                            m.show_command_palette().await;
                        });
                    } else if is_toggle_click_through {
                        tracing::info!("Action: Ctrl+Shift+X (toggle click-through)");
                        let o = state.inner().clone();
                        tauri::async_runtime::spawn(async move {
                            o.lock().await.toggle_click_through().await;
                        });
                    } else {
                        tracing::warn!("Unknown shortcut format: '{}'", shortcut_str);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .setup(|app| {
            tracing::info!("Setup phase started");
            let overlay_manager = OverlayManager::new(app.handle().clone());
            let overlay_state = Arc::new(Mutex::new(overlay_manager));
            app.manage(overlay_state.clone());

            // Pre-initialize overlay window in background so it's ready immediately
            let o = overlay_state.clone();
            tauri::async_runtime::spawn(async move {
                let mut m = o.lock().await;
                if let Err(e) = m.initialize().await {
                    tracing::error!("Failed to pre-initialize overlay window: {:?}", e);
                } else {
                    tracing::info!("Overlay window pre-initialized successfully");
                }
            });

            setup_tray(app.handle())?;
            setup_global_shortcuts(app.handle())?;

            tracing::info!("Setup phase completed successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::toggle_overlay,
            commands::show_overlay,
            commands::hide_overlay,
            commands::show_command_palette,
            commands::toggle_click_through,
            commands::set_click_through,
            commands::get_settings,
            commands::update_settings,
            commands::send_message,
            commands::capture_screen,
            commands::capture_screen_with_vision,
            commands::list_monitors,
            commands::get_screen_capture_permission,
            commands::set_screen_capture_permission,
        ])
        .on_window_event(|window, event| {
            tracing::debug!("Window event: label={:?}, event={:?}", window.label(), event);
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "overlay" {
                    tracing::info!("Overlay close requested - hiding instead");
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}

fn setup_tray(app: &AppHandle) -> anyhow::Result<()> {
    tracing::info!("Setting up system tray");
    let show_i = MenuItem::with_id(app, "show", "Show Overlay", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Unfold", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let icon_size = 16;
    let mut icon_buffer = vec![0u8; icon_size * icon_size * 4];
    for i in (0..icon_buffer.len()).step_by(4) {
        icon_buffer[i] = 0;
        icon_buffer[i + 1] = 212;
        icon_buffer[i + 2] = 170;
        icon_buffer[i + 3] = 255;
    }
    let icon = tauri::image::Image::new_owned(icon_buffer, icon_size as u32, icon_size as u32);
    tracing::debug!("Tray icon created: {}x{}", icon_size, icon_size);

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .tooltip("Unfold - Press Ctrl+Shift+U to toggle overlay")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                tracing::info!("Tray menu: Show Overlay clicked");
                let o = app.state::<Arc<Mutex<overlay::OverlayManager>>>().inner().clone();
                tauri::async_runtime::spawn(async move {
                    o.lock().await.show().await;
                });
            }
            "quit" => {
                tracing::info!("Tray menu: Quit clicked");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|_tray, event| {
            tracing::debug!("Tray icon event: {:?}", event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {}
        })
        .build(app)?;

    tracing::info!("System tray created successfully");
    Ok(())
}

fn setup_global_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Registering global shortcuts");
    app.global_shortcut().register("ctrl+shift+u")?;
    tracing::info!("Registered: Ctrl+Shift+U");
    app.global_shortcut().register("ctrl+i")?;
    tracing::info!("Registered: Ctrl+I");
    // Use Ctrl+Shift+X instead of bare Escape as a global OS-wide hotkey so Escape does not
    // hijack every application or unexpectedly enable click-through when closing modals.
    app.global_shortcut().register("ctrl+shift+x")?;
    tracing::info!("Registered: Ctrl+Shift+X (toggle click-through)");
    Ok(())
}