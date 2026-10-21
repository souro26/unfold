use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverlayState { Hidden, Visible, CommandPalette }

pub struct OverlayManager {
    pub app: tauri::AppHandle,
    window: Option<tauri::WebviewWindow>,
    state: OverlayState,
    click_through: bool,
}

impl OverlayManager {
    pub fn new(app: tauri::AppHandle) -> Self {
        info!("OverlayManager::new() called");
        Self { app, window: None, state: OverlayState::Hidden, click_through: false }
    }

    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.window.is_some() {
            debug!("initialize() called but window already exists");
            return Ok(());
        }

        info!("Initializing overlay window...");

        // Get primary monitor size for initial window dimensions
        let (width, height) = if let Ok(Some(monitor)) = self.app.primary_monitor() {
            let size = monitor.size();
            info!("Primary monitor found: {}x{}", size.width, size.height);
            (size.width, size.height)
        } else {
            warn!("No primary monitor found, using fallback 1920x1080");
            (1920, 1080)
        };

        info!("Building overlay window: {}x{}", width, height);

        let window = tauri::WebviewWindowBuilder::new(
            &self.app, "overlay", tauri::WebviewUrl::App("overlay.html".into())
        )
        .title("Unfold Overlay")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .inner_size(width as f64, height as f64)
        .visible(false)
        .focused(false)
        .build()?;

        info!("Window created successfully, label: {:?}", window.label());

        // Verify window properties
        if let Ok(pos) = window.outer_position() {
            info!("Window position: {:?}", pos);
        }
        if let Ok(size) = window.outer_size() {
            info!("Window outer size: {:?}", size);
        }
        if let Ok(inner) = window.inner_size() {
            info!("Window inner size: {:?}", inner);
        }
        if let Ok(visible) = window.is_visible() {
            info!("Window is_visible: {}", visible);
        }
        if let Ok(decorations) = window.is_decorated() {
            info!("Window is_decorated: {}", decorations);
        }
        if let Ok(always_on_top) = window.is_always_on_top() {
            info!("Window is_always_on_top: {}", always_on_top);
        }

        // Start with click-through disabled (toolbar interactive)
        window.set_ignore_cursor_events(false)?;
        info!("set_ignore_cursor_events(false) - click-through disabled initially");

        self.window = Some(window);
        info!("Overlay window initialized and stored");
        Ok(())
    }

    pub async fn toggle(&mut self) {
        info!("toggle() called, current state: {:?}", self.state);
        match self.state {
            OverlayState::Hidden => self.show().await,
            _ => self.hide().await,
        }
    }

    pub async fn show(&mut self) {
        info!("show() called, current state: {:?}", self.state);
        if let Some(w) = &self.window {
            self.click_through = false;
            let _ = w.set_ignore_cursor_events(false);
            if self.state == OverlayState::Hidden { 
                info!("State was Hidden, ensuring window covers primary monitor");
                self.ensure_monitors_covered().await; 
            }
            info!("Calling w.show() and w.set_focus()");
            match w.show() {
                Ok(_) => info!("w.show() succeeded"),
                Err(e) => error!("w.show() failed: {:?}", e),
            }
            match w.set_focus() {
                Ok(_) => info!("w.set_focus() succeeded"),
                Err(e) => error!("w.set_focus() failed: {:?}", e),
            }
            self.state = OverlayState::Visible;
            self.app.emit("overlay:visibility-changed", true).ok();
            info!("State changed to Visible, event emitted");
            
            // Verify visibility after show
            if let Ok(visible) = w.is_visible() {
                info!("Window is_visible after show: {}", visible);
            }
            if let Ok(pos) = w.outer_position() {
                info!("Window position after show: {:?}", pos);
            }
        } else { 
            warn!("No window exists, initializing first");
            self.initialize().await.ok(); 
            Box::pin(self.show()).await; 
        }
    }

    pub async fn hide(&mut self) {
        info!("hide() called, current state: {:?}", self.state);
        if let Some(w) = &self.window {
            match w.hide() {
                Ok(_) => info!("w.hide() succeeded"),
                Err(e) => error!("w.hide() failed: {:?}", e),
            }
            self.state = OverlayState::Hidden;
            self.app.emit("overlay:visibility-changed", false).ok();
            info!("State changed to Hidden, event emitted");
        }
    }

    pub async fn show_command_palette(&mut self) {
        info!("show_command_palette() called");
        self.show().await;
        if let Some(w) = &self.window {
            w.emit("overlay:show-command-palette", ()).ok();
            self.state = OverlayState::CommandPalette;
            info!("State changed to CommandPalette, event emitted");
        }
    }

    pub async fn toggle_click_through(&mut self) {
        self.click_through = !self.click_through;
        info!("toggle_click_through() called, new value: {}", self.click_through);
        if let Some(w) = &self.window {
            match w.set_ignore_cursor_events(self.click_through) {
                Ok(_) => info!("set_ignore_cursor_events({}) succeeded", self.click_through),
                Err(e) => error!("set_ignore_cursor_events({}) failed: {:?}", self.click_through, e),
            }
            w.emit("overlay:click-through-changed", self.click_through).ok();
            info!("Click-through event emitted: {}", self.click_through);
        }
    }

    pub async fn set_click_through(&mut self, enabled: bool) {
        self.click_through = enabled;
        info!("set_click_through({}) called", self.click_through);
        if let Some(w) = &self.window {
            match w.set_ignore_cursor_events(self.click_through) {
                Ok(_) => info!("set_ignore_cursor_events({}) succeeded", self.click_through),
                Err(e) => error!("set_ignore_cursor_events({}) failed: {:?}", self.click_through, e),
            }
            w.emit("overlay:click-through-changed", self.click_through).ok();
            info!("Click-through event emitted: {}", self.click_through);
        }
    }

    async fn ensure_monitors_covered(&self) {
        info!("ensure_monitors_covered() called");
        if let Some(w) = &self.window {
            if let Ok(Some(mon)) = self.app.primary_monitor() {
                let size = *mon.size();
                let pos = *mon.position();
                let _ = w.set_position(tauri::Position::Physical(pos));
                let _ = w.set_size(tauri::Size::Physical(size));
                info!("Overlay window positioned at {:?}, size {:?}", pos, size);
            }
        }
    }

    pub fn is_visible(&self) -> bool { self.state != OverlayState::Hidden }
    pub fn is_click_through(&self) -> bool { self.click_through }
}