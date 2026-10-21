use serde::{Deserialize, Serialize};
use tauri::{State, command};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub llm_provider: String,
    pub api_key: Option<String>,
    pub model: String,
    pub theme: String,
    pub screen_capture_permission: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self { llm_provider: "groq".into(), api_key: None, model: "openai/gpt-oss-120b".into(), theme: "dark".into(), screen_capture_permission: false }
    }
}

pub struct AppState {
    pub settings: std::sync::RwLock<Settings>,
}

impl Default for AppState {
    fn default() -> Self { Self { settings: std::sync::RwLock::new(Settings::default()) } }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SendMessageRequest {
    pub prompt: String,
    pub conversation_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChatMessage,
}

// Use types from screen_capture module
use crate::screen_capture::{ScreenCaptureRequest, ScreenCaptureResponse, ScreenRegion, VisionRequest, VisionResponse, MonitorInfo};

// Gemini types at module level to avoid duplicates in functions
#[derive(Serialize, Deserialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    generationConfig: GeminiConfig,
}

#[derive(Serialize, Deserialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize, Deserialize)]
struct GeminiConfig {
    temperature: f32,
    maxOutputTokens: u32,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
}

// GeminiContent, GeminiPart, GeminiConfig are already defined with Serialize+Deserialize above
// so we don't need to redefine them here - just use the existing types

#[command]
pub async fn toggle_overlay(state: State<'_, std::sync::Arc<tokio::sync::Mutex<crate::overlay::OverlayManager>>>) -> Result<bool, String> {
    let mut m = state.lock().await;
    m.toggle().await;
    Ok(m.is_visible())
}

#[command]
pub async fn show_overlay(state: State<'_, std::sync::Arc<tokio::sync::Mutex<crate::overlay::OverlayManager>>>) -> Result<(), String> {
    let mut m = state.lock().await;
    m.show().await;
    Ok(())
}

#[command]
pub async fn hide_overlay(state: State<'_, std::sync::Arc<tokio::sync::Mutex<crate::overlay::OverlayManager>>>) -> Result<(), String> {
    let mut m = state.lock().await;
    m.hide().await;
    Ok(())
}

#[command]
pub async fn show_command_palette(state: State<'_, std::sync::Arc<tokio::sync::Mutex<crate::overlay::OverlayManager>>>) -> Result<(), String> {
    let mut m = state.lock().await;
    m.show_command_palette().await;
    Ok(())
}

#[command]
pub async fn toggle_click_through(state: State<'_, std::sync::Arc<tokio::sync::Mutex<crate::overlay::OverlayManager>>>) -> Result<bool, String> {
    let mut m = state.lock().await;
    m.toggle_click_through().await;
    Ok(m.is_click_through())
}

#[command]
pub async fn set_click_through(state: State<'_, std::sync::Arc<tokio::sync::Mutex<crate::overlay::OverlayManager>>>, enabled: bool) -> Result<bool, String> {
    let mut m = state.lock().await;
    m.set_click_through(enabled).await;
    Ok(m.is_click_through())
}

#[command]
pub async fn send_message(
    state: State<'_, crate::commands::AppState>,
    request: SendMessageRequest
) -> Result<String, String> {
    let settings = state.settings.read().unwrap().clone();
    
    let api_key = settings.api_key.clone()
        .ok_or_else(|| "No API key configured. Please set your API key in settings.".to_string())?;
    
    let prompt = request.prompt.clone();
    let model = settings.model.clone();
    
    let system_prompt = r#"You are Unfold, an AI teaching assistant that explains concepts clearly and creates interactive visualizations.

When explaining concepts:
1. Break down complex topics into clear, logical steps
2. Use analogies and concrete examples
3. Structure responses with clear headings
4. Include code examples when relevant
5. Suggest visualizations when appropriate

For visualizations, respond with a special marker:
<<<VISUALIZATION:type:params>>>
Where type can be: algorithm, diagram, chart, equation
And params is a JSON object with visualization parameters.

Keep responses clear, educational, and engaging. Use markdown formatting."#;

    let messages = vec![
        ChatMessage { role: "system".to_string(), content: system_prompt.to_string() },
        ChatMessage { role: "user".to_string(), content: prompt.clone() },
    ];

    let request_body = ChatCompletionRequest {
        model: model.clone(),
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
    };

    let (url, headers) = match settings.llm_provider.as_str() {
        "groq" => {
            let mut h = HashMap::new();
            h.insert("Authorization".to_string(), format!("Bearer {}", api_key));
            h.insert("Content-Type".to_string(), "application/json".to_string());
            ("https://api.groq.com/openai/v1/chat/completions".to_string(), h)
        }
        "openai" => {
            let mut h = HashMap::new();
            h.insert("Authorization".to_string(), format!("Bearer {}", api_key));
            h.insert("Content-Type".to_string(), "application/json".to_string());
            ("https://api.openai.com/v1/chat/completions".to_string(), h)
        }
        "gemini" => {
            let mut h = HashMap::new();
            h.insert("Content-Type".to_string(), "application/json".to_string());
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", 
                model.replace("models/", ""), api_key);
            return call_gemini(&url, prompt).await;
        }
        "ollama" => {
            let mut h = HashMap::new();
            h.insert("Content-Type".to_string(), "application/json".to_string());
            let base = std::env::var("OLLAMA_ENDPOINT").unwrap_or_else(|_| "http://localhost:11434".to_string());
            let url = format!("{}/api/chat", base);
            return call_ollama(&url, model, prompt).await;
        }
        _ => return Err(format!("Unknown provider: {}", settings.llm_provider)),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .headers({
            let mut header_map = reqwest::header::HeaderMap::new();
            for (k, v) in headers {
                header_map.insert(reqwest::header::HeaderName::from_bytes(k.as_bytes()).unwrap(), 
                    reqwest::header::HeaderValue::from_str(&v).unwrap());
            }
            header_map
        })
        .json(&ChatCompletionRequest {
            model: model,
            messages: vec![
                ChatMessage { role: "system".to_string(), content: r#"You are Unfold, an AI teaching assistant that explains concepts clearly and creates interactive visualizations.

When explaining concepts:
1. Break down complex topics into clear, logical steps
2. Use analogies and concrete examples
3. Structure responses with clear headings
4. Include code examples when relevant
5. Suggest visualizations when appropriate

For visualizations, respond with a special marker:
<<<VISUALIZATION:type:params>>>
Where type can be: algorithm, diagram, chart, equation
And params is a JSON object with visualization parameters.

Keep responses clear, educational, and engaging. Use markdown formatting."#.to_string() },
                ChatMessage { role: "user".to_string(), content: prompt.clone() },
            ],
            temperature: 0.7,
            max_tokens: 4096,
            stream: false,
        })
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error: {} - {}", status, error_text));
    }

    let chat_response: ChatCompletionResponse = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = chat_response.choices.first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "No response generated".to_string());

    Ok(content)
}

async fn call_gemini(url: &str, prompt: String) -> Result<String, String> {
    let system_prompt = "You are Unfold, an AI teaching assistant. Explain concepts clearly with examples.";

    let gemini_request = GeminiRequest {
        contents: vec![
            GeminiContent { parts: vec![GeminiPart { text: system_prompt.to_string() }] },
            GeminiContent { parts: vec![GeminiPart { text: prompt }] },
        ],
        generationConfig: GeminiConfig {
            temperature: 0.7,
            maxOutputTokens: 4096,
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&gemini_request)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error: {} - {}", status, error));
    }

    let gemini_resp: GeminiResponse = response.json().await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

    let content = gemini_resp.candidates.first()
        .and_then(|c| c.content.parts.first())
        .map(|p| p.text.clone())
        .unwrap_or_else(|| "No response".to_string());

    Ok(content)
}

async fn call_ollama(url: &str, model: String, prompt: String) -> Result<String, String> {
    #[derive(Serialize, Deserialize)]
    struct OllamaMessage {
        role: String,
        content: String,
    }
    #[derive(Serialize)]
    struct OllamaRequest {
        model: String,
        messages: Vec<OllamaMessage>,
        stream: bool,
        options: OllamaOptions,
    }
    #[derive(Serialize)]
    struct OllamaOptions {
        temperature: f32,
        num_predict: u32,
    }

    let ollama_request = OllamaRequest {
        model,
        messages: vec![
            OllamaMessage { role: "system".to_string(), content: "You are Unfold, an AI teaching assistant. Explain concepts clearly with examples.".to_string() },
            OllamaMessage { role: "user".to_string(), content: prompt },
        ],
        stream: false,
        options: OllamaOptions {
            temperature: 0.7,
            num_predict: 4096,
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&ollama_request)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API error: {} - {}", status, error));
    }

    #[derive(Deserialize)]
    struct OllamaResponse {
        message: OllamaMessage,
    }

    let ollama_resp: OllamaResponse = response.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(ollama_resp.message.content)
}

#[command]
pub async fn get_settings(state: State<'_, crate::commands::AppState>) -> Result<Settings, String> {
    tracing::info!("get_settings command invoked from frontend");
    let s = state.settings.read().unwrap().clone();
    tracing::info!("Returning settings: llm_provider={}, model={}, has_key={}", s.llm_provider, s.model, s.api_key.is_some());
    Ok(s)
}

#[command]
pub async fn update_settings(state: State<'_, crate::commands::AppState>, settings: Settings) -> Result<(), String> {
    tracing::info!("update_settings command invoked from frontend: llm_provider={}, model={}, has_key={}", settings.llm_provider, settings.model, settings.api_key.is_some());
    *state.settings.write().unwrap() = settings;
    Ok(())
}

#[command]
pub async fn capture_screen(
    state: State<'_, crate::commands::AppState>,
    request: ScreenCaptureRequest
) -> Result<ScreenCaptureResponse, String> {
    let permission = {
        let settings = state.settings.read().unwrap();
        settings.screen_capture_permission
    };
    
    if !permission {
        return Err("Screen capture permission not granted. Please enable it in settings.".to_string());
    }

    crate::screen_capture::capture_screen_impl(request).await
}

#[command]
pub async fn capture_screen_with_vision(
    state: State<'_, crate::commands::AppState>,
    request: ScreenCaptureRequest,
    vision_request: crate::screen_capture::VisionRequest
) -> Result<crate::screen_capture::VisionResponse, String> {
    let (permission, api_key) = {
        let settings = state.settings.read().unwrap();
        (settings.screen_capture_permission, settings.api_key.clone())
    };
    
    if !permission {
        return Err("Screen capture permission not granted. Please enable it in settings.".to_string());
    }
    
    // First capture the screen
    let capture_result = crate::screen_capture::capture_screen_impl(request).await?;
    
    // Then call vision API with the captured image
    let mut vision_req = vision_request;
    vision_req.image_base64 = capture_result.image_base64;
    
    // Add API key from settings if not provided
    if vision_req.api_key.is_none() {
        vision_req.api_key = api_key;
    }
    
    crate::screen_capture::call_vision_api(vision_req).await
}

#[command]
pub async fn list_monitors() -> Result<Vec<crate::screen_capture::MonitorInfo>, String> {
    crate::screen_capture::list_monitors().await
}

#[command]
pub async fn get_screen_capture_permission(state: State<'_, crate::commands::AppState>) -> Result<bool, String> {
    Ok(state.settings.read().unwrap().screen_capture_permission)
}

#[command]
pub async fn set_screen_capture_permission(
    state: State<'_, crate::commands::AppState>,
    enabled: bool,
) -> Result<(), String> {
    state.settings.write().unwrap().screen_capture_permission = enabled;
    Ok(())
}