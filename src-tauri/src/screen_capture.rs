// src-tauri/src/screen_capture.rs - Windows screen capture using GDI

use base64::Engine;
use image::ImageBuffer;
use std::io::Cursor;
use tracing::{debug, info};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenCaptureRequest {
    pub region: Option<ScreenRegion>,
    pub include_cursor: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenCaptureResponse {
    pub image_base64: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

pub async fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFOEXW};
        use windows::Win32::Foundation::{LPARAM, BOOL, RECT};
        use std::sync::{Arc, Mutex};

        let monitors = Arc::new(Mutex::new(Vec::new()));
        let monitors_clone = monitors.clone();

        unsafe extern "system" fn monitor_enum_proc(
            hmonitor: HMONITOR,
            _hdc: HDC,
            _rect: *mut RECT,
            lparam: LPARAM,
        ) -> BOOL {
            let monitors = lparam.0 as *mut std::sync::Mutex<Vec<MonitorInfo>>;
            if monitors.is_null() {
                return BOOL(1);
            }

            let mut info: MONITORINFOEXW = std::mem::zeroed();
            info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;

            if GetMonitorInfoW(hmonitor, &mut info as *mut _ as *mut _).as_bool() {
                let name = String::from_utf16_lossy(&info.szDevice)
                    .trim_end_matches('\0')
                    .to_string();
                
                let width = (info.monitorInfo.rcMonitor.right - info.monitorInfo.rcMonitor.left) as u32;
                let height = (info.monitorInfo.rcMonitor.bottom - info.monitorInfo.rcMonitor.top) as u32;

                let mut monitor_info = MonitorInfo {
                    index: 0,
                    name,
                    width,
                    height,
                    is_primary: (info.monitorInfo.dwFlags & 1) != 0,
                };

                let mut monitors_lock = (*monitors).lock().unwrap();
                monitor_info.index = monitors_lock.len();
                monitors_lock.push(monitor_info);
            }
            BOOL(1)
        }

        unsafe {
            let _ = EnumDisplayMonitors(
                HDC::default(),
                None,
                Some(monitor_enum_proc),
                LPARAM(&monitors_clone as *const _ as isize),
            );
        }

        let result = monitors.lock().unwrap().clone();
        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Monitor listing not implemented for this platform".to_string())
    }
}

// Windows GDI-based screen capture
#[cfg(target_os = "windows")]
mod windows_gdi_capture {
    use super::*;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
        BitBlt, GetDC,
    };
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{GetDesktopWindow, GetWindowRect};
    use std::ptr::null_mut;

    pub async fn capture_impl(request: ScreenCaptureRequest) -> Result<ScreenCaptureResponse, String> {
        info!("Starting GDI screen capture");

        // Get desktop window
        let desktop_hwnd = unsafe { GetDesktopWindow() };
        let mut rect = RECT::default();
        unsafe { let _ = GetWindowRect(desktop_hwnd, &mut rect); };

        let screen_width = (rect.right - rect.left) as u32;
        let screen_height = (rect.bottom - rect.top) as u32;

        // Get monitor index if specified
        let _monitor_index = request.region.as_ref().map(|r| r.x as usize).unwrap_or(0);
        
        // For multi-monitor, we'd need to get the specific monitor's rect
        // For now, capture the primary monitor (entire virtual screen)
        let capture_width = screen_width;
        let capture_height = screen_height;
        let capture_x = 0i32;
        let capture_y = 0i32;

        unsafe {
            // Get desktop DC
            let desktop_dc = GetDC(HWND(null_mut()));
            if desktop_dc.0.is_null() {
                return Err("Failed to get desktop DC".to_string());
            }

            // Create compatible DC
            let mem_dc = CreateCompatibleDC(desktop_dc);
            if mem_dc.0.is_null() {
                return Err("Failed to create compatible DC".to_string());
            }

            // Create compatible bitmap
            let bitmap = CreateCompatibleBitmap(desktop_dc, capture_width as i32, capture_height as i32);
            if bitmap.0.is_null() {
                let _ = DeleteDC(mem_dc);
                return Err("Failed to create compatible bitmap".to_string());
            }

            // Select bitmap into memory DC
            let old_bitmap = SelectObject(mem_dc, bitmap);

            // Copy screen to memory DC
            let result = BitBlt(
                mem_dc,
                0, 0,
                capture_width as i32,
                capture_height as i32,
                desktop_dc,
                capture_x, capture_y,
                SRCCOPY,
            );

            if result.is_err() {
                SelectObject(mem_dc, old_bitmap);
                let _ = DeleteObject(bitmap);
                let _ = DeleteDC(mem_dc);
                return Err("BitBlt failed".to_string());
            }

            // Get bitmap info
            let mut bmi: BITMAPINFO = std::mem::zeroed();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bmi.bmiHeader.biWidth = capture_width as i32;
            bmi.bmiHeader.biHeight = -(capture_height as i32); // Top-down DIB
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;
            bmi.bmiHeader.biCompression = BI_RGB.0;

            // Allocate buffer for pixel data
            let buffer_size = (capture_width * capture_height * 4) as usize;
            let mut pixel_data = vec![0u8; buffer_size];

            // Get bitmap bits
            let lines = GetDIBits(
                mem_dc,
                bitmap,
                0,
                capture_height,
                Some(pixel_data.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );

            if lines == 0 {
                SelectObject(mem_dc, old_bitmap);
                let _ = DeleteObject(bitmap);
                let _ = DeleteDC(mem_dc);
                return Err("GetDIBits failed".to_string());
            }

            // Cleanup
            SelectObject(mem_dc, old_bitmap);
            let _ = DeleteObject(bitmap);
            let _ = DeleteDC(mem_dc);

            debug!("Captured frame: {}x{}", capture_width, capture_height);

            // Apply region crop if specified
            // pixel_data is in BGRA format (from GetDIBits with 32-bit)
            let mut img = ImageBuffer::<image::Rgba<u8>, _>::from_raw(capture_width, capture_height, pixel_data)
                .ok_or("Failed to create image buffer")?;

            // Convert BGRA to RGBA (GetDIBits gives us BGRA)
            for pixel in img.pixels_mut() {
                let b = pixel[0];
                pixel[0] = pixel[2]; // R
                pixel[2] = b; // B
                // G and A stay the same
            }

            let img = if let Some(region) = request.region {
                let x = region.x.max(0) as u32;
                let y = region.y.max(0) as u32;
                let w = region.width.min(capture_width.saturating_sub(x));
                let h = region.height.min(capture_height.saturating_sub(y));
                
                if w > 0 && h > 0 {
                    image::imageops::crop(&mut img, x, y, w, h).to_image()
                } else {
                    img
                }
            } else {
                img
            };

            let final_width = img.width();
            let final_height = img.height();

            // img is already in RGBA format after our conversion above
            let mut png_data = Vec::new();
            img.write_to(&mut Cursor::new(&mut png_data), image::ImageFormat::Png)
                .map_err(|e| format!("Failed to encode PNG: {}", e))?;

            let base64 = base64::engine::general_purpose::STANDARD.encode(&png_data);

            info!("Screen capture complete: {}x{}", final_width, final_height);

            Ok(ScreenCaptureResponse {
                image_base64: base64,
                width: final_width,
                height: final_height,
                format: "png".to_string(),
            })
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod windows_gdi_capture {
    use super::*;
    pub async fn capture_impl(_request: ScreenCaptureRequest) -> Result<ScreenCaptureResponse, String> {
        Err("Screen capture not implemented for this platform".to_string())
    }
}

pub async fn capture_screen_impl(request: ScreenCaptureRequest) -> Result<ScreenCaptureResponse, String> {
    windows_gdi_capture::capture_impl(request).await
}

// For vision API - send image + prompt to vision-capable models
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VisionRequest {
    pub prompt: String,
    pub image_base64: String,
    pub model: String,
    pub provider: String,
    pub api_key: Option<String>,
    pub conversation_history: Option<Vec<ChatMessage>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VisionResponse {
    pub content: String,
    pub model: String,
    pub provider: String,
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
}

pub async fn call_vision_api(request: VisionRequest) -> Result<VisionResponse, String> {
    match request.provider.as_str() {
        "openrouter" => call_openrouter_vision(request).await,
        "openai" => call_openai_vision(request).await,
        "gemini" => call_gemini_vision(request).await,
        "ollama" => call_ollama_vision(request).await,
        _ => Err(format!("Provider {} does not support vision", request.provider)),
    }
}

async fn call_openrouter_vision(request: VisionRequest) -> Result<VisionResponse, String> {
    let api_key = request.api_key.ok_or("OpenRouter API key required")?;
    
    #[derive(serde::Serialize)]
    struct OpenRouterRequest {
        model: String,
        messages: Vec<OpenRouterMessage>,
        temperature: f32,
        max_tokens: u32,
    }

    #[derive(serde::Serialize, serde::Deserialize)]
    struct OpenRouterMessage {
        role: String,
        content: serde_json::Value,
    }

    #[derive(serde::Deserialize)]
    struct OpenRouterResponse {
        choices: Vec<OpenRouterChoice>,
        usage: Option<OpenRouterUsage>,
    }

    #[derive(serde::Deserialize)]
    struct OpenRouterChoice {
        message: OpenRouterMessage,
    }

    #[derive(serde::Deserialize)]
    struct OpenRouterUsage {
        prompt_tokens: u32,
        completion_tokens: u32,
        total_tokens: u32,
    }

    let mut content = vec![
        serde_json::json!({"type": "text", "text": request.prompt}),
    ];

    if !request.image_base64.is_empty() {
        content.push(serde_json::json!({
            "type": "image_url",
            "image_url": {
                "url": format!("data:image/png;base64,{}", request.image_base64)
            }
        }));
    }

    let messages = vec![
        OpenRouterMessage {
            role: "system".to_string(),
            content: serde_json::json!([{"type": "text", "text": "You are Unfold, an AI teaching assistant. Explain what you see in the image clearly and educationally."}]),
        },
        OpenRouterMessage {
            role: "user".to_string(),
            content: serde_json::json!(content),
        },
    ];

    let body = OpenRouterRequest {
        model: request.model.clone(),
        messages,
        temperature: 0.7,
        max_tokens: 4096,
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://unfold.app")
        .header("X-Title", "Unfold")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenRouter request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter API error: {} - {}", status, error));
    }

    let resp: OpenRouterResponse = response.json().await
        .map_err(|e| format!("Failed to parse OpenRouter response: {}", e))?;

    let content = resp.choices.first()
        .map(|c| {
            match &c.message.content {
                serde_json::Value::Array(arr) => {
                    arr.iter()
                        .filter_map(|v| v.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("")
                }
                serde_json::Value::String(s) => s.clone(),
                _ => "No response".to_string(),
            }
        })
        .unwrap_or_else(|| "No response generated".to_string());

    Ok(VisionResponse {
        content,
        model: request.model,
        provider: "openrouter".to_string(),
        usage: resp.usage.map(|u| UsageInfo {
            prompt_tokens: Some(u.prompt_tokens),
            completion_tokens: Some(u.completion_tokens),
            total_tokens: Some(u.total_tokens),
        }),
    })
}

async fn call_openai_vision(request: VisionRequest) -> Result<VisionResponse, String> {
    let api_key = request.api_key.ok_or("OpenAI API key required")?;

    #[derive(serde::Serialize)]
    struct OpenAIRequest {
        model: String,
        messages: Vec<OpenAIMessage>,
        temperature: f32,
        max_tokens: u32,
    }

    #[derive(serde::Serialize, serde::Deserialize)]
    struct OpenAIMessage {
        role: String,
        content: serde_json::Value,
    }

    #[derive(serde::Deserialize)]
    struct OpenAIResponse {
        choices: Vec<OpenAIChoice>,
        usage: Option<OpenAIUsage>,
    }

    #[derive(serde::Deserialize)]
    struct OpenAIChoice {
        message: OpenAIMessage,
    }

    #[derive(serde::Deserialize)]
    struct OpenAIUsage {
        prompt_tokens: u32,
        completion_tokens: u32,
        total_tokens: u32,
    }

    let mut content = vec![
        serde_json::json!({"type": "text", "text": request.prompt}),
    ];

    if !request.image_base64.is_empty() {
        content.push(serde_json::json!({
            "type": "image_url",
            "image_url": {
                "url": format!("data:image/png;base64,{}", request.image_base64)
            }
        }));
    }

    let messages = vec![
        OpenAIMessage {
            role: "system".to_string(),
            content: serde_json::json!([{"type": "text", "text": "You are Unfold, an AI teaching assistant. Explain what you see in the image clearly and educationally."}]),
        },
        OpenAIMessage {
            role: "user".to_string(),
            content: serde_json::json!(content),
        },
    ];

    let body = OpenAIRequest {
        model: request.model.clone(),
        messages,
        temperature: 0.7,
        max_tokens: 4096,
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {} - {}", status, error));
    }

    let resp: OpenAIResponse = response.json().await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    let content = resp.choices.first()
        .map(|c| {
            match &c.message.content {
                serde_json::Value::Array(arr) => {
                    arr.iter()
                        .filter_map(|v| v.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join("")
                }
                serde_json::Value::String(s) => s.clone(),
                _ => "No response".to_string(),
            }
        })
        .unwrap_or_else(|| "No response generated".to_string());

    Ok(VisionResponse {
        content,
        model: request.model,
        provider: "openai".to_string(),
        usage: resp.usage.map(|u| UsageInfo {
            prompt_tokens: Some(u.prompt_tokens),
            completion_tokens: Some(u.completion_tokens),
            total_tokens: Some(u.total_tokens),
        }),
    })
}

async fn call_gemini_vision(request: VisionRequest) -> Result<VisionResponse, String> {
    let api_key = request.api_key.ok_or("Gemini API key required")?;

    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct GeminiRequest {
        contents: Vec<GeminiContent>,
        generation_config: GeminiConfig,
    }

    #[derive(serde::Serialize)]
    struct GeminiContent {
        parts: Vec<GeminiPart>,
    }

    #[derive(serde::Serialize)]
    #[serde(untagged)]
    enum GeminiPart {
        Text { text: String },
        Image { inline_data: InlineData },
    }

    #[derive(serde::Serialize)]
    struct InlineData {
        mime_type: String,
        data: String,
    }

    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct GeminiConfig {
        temperature: f32,
        max_output_tokens: u32,
    }

    #[derive(serde::Deserialize)]
    struct GeminiResponse {
        candidates: Vec<GeminiCandidate>,
    }

    #[derive(serde::Deserialize)]
    struct GeminiCandidate {
        content: GeminiContentResponse,
    }

    #[derive(serde::Deserialize)]
    struct GeminiContentResponse {
        parts: Vec<GeminiPartResponse>,
    }

    #[derive(serde::Deserialize)]
    struct GeminiPartResponse {
        text: String,
    }

    let mut parts = vec![
        GeminiPart::Text { text: "You are Unfold, an AI teaching assistant. Explain what you see in the image clearly and educationally.".to_string() },
        GeminiPart::Text { text: request.prompt },
    ];

    if !request.image_base64.is_empty() {
        parts.push(GeminiPart::Image { 
            inline_data: InlineData {
                mime_type: "image/png".to_string(),
                data: request.image_base64,
            }
        });
    }

    let body = GeminiRequest {
        contents: vec![GeminiContent { parts }],
        generation_config: GeminiConfig {
            temperature: 0.7,
            max_output_tokens: 4096,
        },
    };

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        request.model.replace("models/", ""),
        api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error: {} - {}", status, error));
    }

    let resp: GeminiResponse = response.json().await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

    let content = resp.candidates.first()
        .and_then(|c| c.content.parts.first())
        .map(|p| p.text.clone())
        .unwrap_or_else(|| "No response".to_string());

    Ok(VisionResponse {
        content,
        model: request.model,
        provider: "gemini".to_string(),
        usage: None,
    })
}

async fn call_ollama_vision(request: VisionRequest) -> Result<VisionResponse, String> {
    #[derive(serde::Serialize)]
    struct OllamaRequest {
        model: String,
        messages: Vec<OllamaMessage>,
        stream: bool,
        options: OllamaOptions,
    }

    #[derive(serde::Serialize, serde::Deserialize)]
    struct OllamaMessage {
        role: String,
        content: String,
        images: Option<Vec<String>>,
    }

    #[derive(serde::Serialize)]
    struct OllamaOptions {
        temperature: f32,
        num_predict: u32,
    }

    #[derive(serde::Deserialize)]
    struct OllamaResponse {
        message: OllamaMessage,
    }

    let base = std::env::var("OLLAMA_ENDPOINT").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let url = format!("{}/api/chat", base);

    let content = request.prompt;
    let images = if !request.image_base64.is_empty() {
        Some(vec![request.image_base64])
    } else {
        None
    };

    let body = OllamaRequest {
        model: request.model.clone(),
        messages: vec![
            OllamaMessage {
                role: "system".to_string(),
                content: "You are Unfold, an AI teaching assistant. Explain what you see in the image clearly and educationally.".to_string(),
                images: None,
            },
            OllamaMessage {
                role: "user".to_string(),
                content,
                images,
            },
        ],
        stream: false,
        options: OllamaOptions {
            temperature: 0.7,
            num_predict: 4096,
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API error: {} - {}", status, error));
    }

    let resp: OllamaResponse = response.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(VisionResponse {
        content: resp.message.content,
        model: request.model,
        provider: "ollama".to_string(),
        usage: None,
    })
}