use tauri::{Emitter, WebviewUrl, WebviewWindowBuilder};
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverlayState {
    Hidden,
    Visible,
    CommandPalette,
}

pub struct OverlayManager {
    pub app: tauri::AppHandle,
    window: Option<tauri::WebviewWindow>,
    state: OverlayState,
    click_through: bool,
}

impl OverlayManager {
    pub fn new(app: tauri::AppHandle) -> Self {
        info!("OverlayManager::new() called");
        Self {
            app,
            window: None,
            state: OverlayState::Hidden,
            click_through: false,
        }
    }

    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.window.is_some() {
            debug!("initialize() called but window already exists");
            return Ok(());
        }

        info!("Initializing overlay window...");

        // Convert primary monitor physical pixels to logical pixels for WebviewWindowBuilder::inner_size
        let (logical_width, logical_height) = if let Ok(Some(monitor)) = self.app.primary_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            info!(
                "Primary monitor found: {}x{} physical (scale factor: {})",
                size.width, size.height, scale
            );
            (size.width as f64 / scale, size.height as f64 / scale)
        } else {
            warn!("No primary monitor found, using fallback 1920x1080");
            (1920.0, 1080.0)
        };

        info!(
            "Building overlay window: {}x{} logical",
            logical_width, logical_height
        );

        // NOTE: Do NOT set `.focused(false)` here. On Windows (tao/wry), `.focused(false)`
        // applies `WS_EX_NOACTIVATE` to the window extended style, preventing the window
        // and its child WebView2 control from activating or receiving mouse clicks when shown.
        let window = WebviewWindowBuilder::new(
            &self.app,
            "overlay",
            WebviewUrl::App("overlay.html".into()),
        )
        .title("Unfold Overlay")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .inner_size(logical_width, logical_height)
        .visible(false)
        .build()?;

        info!("Window created successfully, label: {:?}", window.label());

        // Start with click-through disabled (interactive mode)
        window.set_ignore_cursor_events(false)?;
        Self::apply_win32_cursor_mode(&window, false);
        info!("set_ignore_cursor_events(false) - click-through disabled initially");

        self.window = Some(window);
        info!("Overlay window initialized and stored");
        Ok(())
    }

    /// Ensures the underlying Win32 HWND extended styles (`GWL_EXSTYLE`) and foreground
    /// activation match the desired click-through state.
    #[cfg(target_os = "windows")]
    fn apply_win32_cursor_mode(window: &tauri::WebviewWindow, click_through: bool) {
        use std::ffi::c_void;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetForegroundWindow, SetWindowLongPtrW, SetWindowPos, ShowWindow,
            GWL_EXSTYLE, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
            SWP_SHOWWINDOW, SW_SHOW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TRANSPARENT,
        };

        let Ok(raw_hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);

        unsafe {
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if click_through {
                let new_style = (ex_style
                    | (WS_EX_TRANSPARENT.0 as isize)
                    | (WS_EX_LAYERED.0 as isize))
                    & !(WS_EX_NOACTIVATE.0 as isize);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
                );
            } else {
                // Clear both WS_EX_TRANSPARENT and WS_EX_NOACTIVATE so WebView2 receives mouse input
                let new_style = (ex_style | (WS_EX_LAYERED.0 as isize))
                    & !(WS_EX_TRANSPARENT.0 as isize)
                    & !(WS_EX_NOACTIVATE.0 as isize);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
                );
                let _ = ShowWindow(hwnd, SW_SHOW);
                let _ = SetForegroundWindow(hwnd);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn apply_win32_cursor_mode(_window: &tauri::WebviewWindow, _click_through: bool) {}

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

            if self.state == OverlayState::Hidden {
                info!("State was Hidden, ensuring window covers primary monitor");
                self.ensure_monitors_covered().await;
            }

            info!("Calling w.show(), disabling click-through, and focusing window");
            if let Err(e) = w.show() {
                error!("w.show() failed: {:?}", e);
            }

            // Apply cursor event handling AFTER show() so Win32 & WebView2 controller update while visible
            if let Err(e) = w.set_ignore_cursor_events(false) {
                error!("w.set_ignore_cursor_events(false) failed: {:?}", e);
            }
            Self::apply_win32_cursor_mode(w, false);

            if let Err(e) = w.set_focus() {
                error!("w.set_focus() failed: {:?}", e);
            }

            self.state = OverlayState::Visible;
            self.app.emit("overlay:visibility-changed", true).ok();
            w.emit("overlay:click-through-changed", false).ok();
            info!("State changed to Visible, visibility & click-through events emitted");
        } else {
            warn!("No window exists, initializing first");
            self.initialize().await.ok();
            Box::pin(self.show()).await;
        }
    }

    pub async fn hide(&mut self) {
        info!("hide() called, current state: {:?}", self.state);
        if let Some(w) = &self.window {
            if let Err(e) = w.hide() {
                error!("w.hide() failed: {:?}", e);
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
        // Only toggle click-through when the overlay is actually visible
        if self.state == OverlayState::Hidden {
            debug!("Ignoring toggle_click_through() while overlay is Hidden");
            return;
        }
        let next = !self.click_through;
        self.set_click_through(next).await;
    }

    pub async fn set_click_through(&mut self, enabled: bool) {
        self.click_through = enabled;
        info!("set_click_through({}) called", self.click_through);
        if let Some(w) = &self.window {
            match w.set_ignore_cursor_events(self.click_through) {
                Ok(_) => info!("set_ignore_cursor_events({}) succeeded", self.click_through),
                Err(e) => error!(
                    "set_ignore_cursor_events({}) failed: {:?}",
                    self.click_through, e
                ),
            }
            Self::apply_win32_cursor_mode(w, self.click_through);
            w.emit("overlay:click-through-changed", self.click_through)
                .ok();
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

    pub fn is_visible(&self) -> bool {
        self.state != OverlayState::Hidden
    }

    pub fn is_click_through(&self) -> bool {
        self.click_through
    }
}