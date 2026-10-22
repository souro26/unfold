use std::time::{Duration, Instant};
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
    last_toggle: Option<Instant>,
}

impl OverlayManager {
    pub fn new(app: tauri::AppHandle) -> Self {
        info!("OverlayManager::new() called");
        Self {
            app,
            window: None,
            state: OverlayState::Hidden,
            click_through: false,
            last_toggle: None,
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
        info!("Overlay WebView URL: {:?}", window.url());

        #[cfg(debug_assertions)]
        window.open_devtools();

        // Configure extended styles without showing the window
        window.set_ignore_cursor_events(false)?;
        Self::apply_win32_cursor_mode(&window, false);
        #[cfg(target_os = "windows")]
        Self::setup_window_capture_affinity(&window);
        Self::hide_win32_window(&window);
        info!("Overlay initialized hidden with click-through disabled");

        self.window = Some(window);
        self.state = OverlayState::Hidden;
        Ok(())
    }

    /// Exclude the overlay window itself from desktop screen capture
    #[cfg(target_os = "windows")]
    fn setup_window_capture_affinity(window: &tauri::WebviewWindow) {
        use std::ffi::c_void;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};

        let Ok(raw_hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);

        unsafe {
            let _ = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        }
    }

    /// Updates only the Win32 `GWL_EXSTYLE` hit-test flags (`WS_EX_TRANSPARENT`, `WS_EX_NOACTIVATE`)
    /// WITHOUT changing window visibility (`SWP_SHOWWINDOW` / `ShowWindow`).
    #[cfg(target_os = "windows")]
    fn apply_win32_cursor_mode(window: &tauri::WebviewWindow, click_through: bool) {
        use std::ffi::c_void;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
            SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_LAYERED,
            WS_EX_NOACTIVATE, WS_EX_TRANSPARENT,
        };

        let Ok(raw_hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);

        unsafe {
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let new_style = if click_through {
                (ex_style | (WS_EX_TRANSPARENT.0 as isize) | (WS_EX_LAYERED.0 as isize))
                    & !(WS_EX_NOACTIVATE.0 as isize)
            } else {
                (ex_style | (WS_EX_LAYERED.0 as isize))
                    & !(WS_EX_TRANSPARENT.0 as isize)
                    & !(WS_EX_NOACTIVATE.0 as isize)
            };

            tracing::info!(
                "Win32 GWL_EXSTYLE before={:#010x}, after={:#010x} (WS_EX_TRANSPARENT={}, WS_EX_NOACTIVATE={})",
                ex_style,
                new_style,
                (new_style & (WS_EX_TRANSPARENT.0 as isize)) != 0,
                (new_style & (WS_EX_NOACTIVATE.0 as isize)) != 0,
            );

            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn apply_win32_cursor_mode(_window: &tauri::WebviewWindow, _click_through: bool) {}

    /// Explicitly shows and foregrounds the Win32 `HWND` when `show()` is called.
    #[cfg(target_os = "windows")]
    fn show_and_focus_win32_window(window: &tauri::WebviewWindow) {
        use std::ffi::c_void;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            SetForegroundWindow, SetWindowPos, ShowWindow, HWND_TOPMOST, SWP_FRAMECHANGED,
            SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_SHOW,
        };

        let Ok(raw_hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);

        unsafe {
            let _ = ShowWindow(hwnd, SW_SHOW);
            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
            );
            let _ = SetForegroundWindow(hwnd);
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn show_and_focus_win32_window(_window: &tauri::WebviewWindow) {}

    /// Explicitly hides the Win32 `HWND` when `hide()` is called.
    #[cfg(target_os = "windows")]
    fn hide_win32_window(window: &tauri::WebviewWindow) {
        use std::ffi::c_void;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};

        let Ok(raw_hwnd) = window.hwnd() else {
            return;
        };
        let hwnd = HWND(raw_hwnd.0 as *mut c_void);

        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn hide_win32_window(_window: &tauri::WebviewWindow) {}

    pub async fn toggle(&mut self) {
        // Debounce rapid duplicate triggers (e.g. OS key-repeat or simultaneous global + DOM shortcut)
        let now = Instant::now();
        if let Some(last) = self.last_toggle {
            if now.duration_since(last) < Duration::from_millis(250) {
                debug!("Ignoring duplicate toggle() within 250ms debounce window");
                return;
            }
        }
        self.last_toggle = Some(now);

        let os_visible = self
            .window
            .as_ref()
            .and_then(|w| w.is_visible().ok())
            .unwrap_or(false);
        let should_hide = self.state != OverlayState::Hidden || os_visible;

        info!(
            "toggle() called -> state={:?}, os_visible={} => should_hide={}",
            self.state, os_visible, should_hide
        );

        if should_hide {
            self.hide().await;
        } else {
            self.show().await;
        }
    }

    pub async fn show(&mut self) {
        info!("show() called, current state: {:?}", self.state);
        if let Some(w) = &self.window {
            self.click_through = false;
            self.ensure_monitors_covered().await;

            if let Err(e) = w.show() {
                error!("w.show() failed: {:?}", e);
            }

            if let Err(e) = w.set_ignore_cursor_events(false) {
                error!("w.set_ignore_cursor_events(false) failed: {:?}", e);
            }
            Self::apply_win32_cursor_mode(w, false);
            Self::show_and_focus_win32_window(w);

            if let Err(e) = w.set_focus() {
                error!("w.set_focus() failed: {:?}", e);
            }

            #[cfg(debug_assertions)]
            w.open_devtools();

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
            Self::hide_win32_window(w);
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