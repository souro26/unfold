use tauri::{State, command};
use crate::commands::settings::AppState;
use crate::screen_capture::{
    ScreenCaptureRequest, ScreenCaptureResponse, VisionRequest, VisionResponse, MonitorInfo,
    capture_screen_impl, call_vision_api
};

#[command]
pub async fn capture_screen(
    state: State<'_, AppState>,
    request: Option<ScreenCaptureRequest>,
) -> Result<ScreenCaptureResponse, String> {
    let permission = {
        let settings = state.settings.read().unwrap();
        settings.screen_capture_permission
    };
    if !permission {
        return Err("Screen capture permission not granted. Please enable it in settings.".to_string());
    }

    let req = request.unwrap_or(ScreenCaptureRequest {
        region: None,
        include_cursor: false,
    });
    capture_screen_impl(req).await
}

#[command]
pub async fn capture_screen_with_vision(
    state: State<'_, AppState>,
    request: Option<ScreenCaptureRequest>,
    vision_request: VisionRequest,
) -> Result<VisionResponse, String> {
    let (permission, api_key) = {
        let settings = state.settings.read().unwrap();
        (settings.screen_capture_permission, settings.api_key.clone())
    };
    if !permission {
        return Err("Screen capture permission not granted. Please enable it in settings.".to_string());
    }

    let req = request.unwrap_or(ScreenCaptureRequest {
        region: None,
        include_cursor: false,
    });

    let capture_result = capture_screen_impl(req).await?;
    let mut vision_req = vision_request;
    vision_req.image_base64 = capture_result.image_base64;

    if vision_req.api_key.is_none() {
        vision_req.api_key = api_key;
    }

    call_vision_api(vision_req).await
}

#[command]
pub async fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    crate::screen_capture::list_monitors().await
}

#[command]
pub async fn get_screen_capture_permission(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let settings = state
        .settings
        .read()
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    Ok(settings.screen_capture_permission)
}

#[command]
pub async fn set_screen_capture_permission(
    state: State<'_, AppState>,
    granted: bool,
) -> Result<bool, String> {
    let mut settings = state
        .settings
        .write()
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    settings.screen_capture_permission = granted;
    Ok(granted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_request_defaults() {
        let req = ScreenCaptureRequest {
            region: None,
            include_cursor: false,
        };
        assert!(!req.include_cursor);
        assert!(req.region.is_none());
    }
}
