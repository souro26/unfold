use std::sync::Arc;
use tauri::{State, command};
use tokio::sync::Mutex;
use crate::overlay::OverlayManager;

#[command]
pub async fn toggle_overlay(
    state: State<'_, Arc<Mutex<OverlayManager>>>,
) -> Result<bool, String> {
    let mut m = state.lock().await;
    m.toggle().await;
    Ok(m.is_visible())
}

#[command]
pub async fn show_overlay(
    state: State<'_, Arc<Mutex<OverlayManager>>>,
) -> Result<(), String> {
    let mut m = state.lock().await;
    m.show().await;
    Ok(())
}

#[command]
pub async fn hide_overlay(
    state: State<'_, Arc<Mutex<OverlayManager>>>,
) -> Result<(), String> {
    let mut m = state.lock().await;
    m.hide().await;
    Ok(())
}

#[command]
pub async fn show_command_palette(
    state: State<'_, Arc<Mutex<OverlayManager>>>,
) -> Result<(), String> {
    let mut m = state.lock().await;
    m.show_command_palette().await;
    Ok(())
}

#[command]
pub async fn toggle_click_through(
    state: State<'_, Arc<Mutex<OverlayManager>>>,
) -> Result<bool, String> {
    let mut m = state.lock().await;
    m.toggle_click_through().await;
    Ok(m.is_click_through())
}

#[command]
pub async fn set_click_through(
    state: State<'_, Arc<Mutex<OverlayManager>>>,
    enabled: bool,
) -> Result<bool, String> {
    let mut m = state.lock().await;
    m.set_click_through(enabled).await;
    Ok(m.is_click_through())
}
