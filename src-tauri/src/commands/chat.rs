use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{State, command};
use crate::commands::settings::AppState;
use crate::screen_capture::{VisionRequest, call_vision_api};

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct SendMessageRequest {
    pub prompt: String,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub image_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: f32,
    pub max_tokens: u32,
    pub stream: bool,
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
pub struct Choice {
    pub message: ChatMessage,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiRequest {
    pub contents: Vec<GeminiContent>,
    pub generation_config: GeminiConfig,
}

#[derive(Serialize, Deserialize)]
pub struct GeminiContent {
    pub parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize)]
pub struct GeminiPart {
    pub text: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiConfig {
    pub temperature: f32,
    pub max_output_tokens: u32,
}

#[derive(Deserialize)]
pub struct GeminiResponse {
    pub candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
pub struct GeminiCandidate {
    pub content: GeminiContent,
}

#[command]
pub async fn send_message(
    state: State<'_, AppState>,
    prompt: Option<String>,
    conversation_id: Option<String>,
    image_base64: Option<String>,
    request: Option<SendMessageRequest>,
) -> Result<String, String> {
    let settings = state
        .settings
        .read()
        .map_err(|e| format!("Failed to read settings: {}", e))?
        .clone();

    let is_local = settings.llm_provider == "ollama"
        || settings.llm_provider == "llama_cpp"
        || settings.llm_provider == "local";

    let api_key = if is_local {
        settings.api_key.clone().unwrap_or_default()
    } else {
        settings
            .api_key
            .clone()
            .ok_or_else(|| "No API key configured. Please set your API key in settings.".to_string())?
    };

    let prompt = prompt
        .or_else(|| request.as_ref().map(|r| r.prompt.clone()))
        .ok_or_else(|| "Missing required parameter `prompt`".to_string())?;
    let _conversation_id = conversation_id
        .or_else(|| request.as_ref().and_then(|r| r.conversation_id.clone()));
    let img = image_base64
        .or_else(|| request.as_ref().and_then(|r| r.image_base64.clone()));
    let model = settings.model.clone();

    // If screen image context is attached, dispatch to vision pipeline
    if let Some(image_data) = img {
        if !image_data.is_empty() {
            let vision_req = VisionRequest {
                prompt,
                image_base64: image_data,
                model,
                provider: settings.llm_provider,
                api_key: if api_key.is_empty() { None } else { Some(api_key) },
                conversation_history: None,
            };
            let vision_resp = call_vision_api(vision_req).await?;
            return Ok(vision_resp.content);
        }
    }

    let system_prompt = r#"You are Unfold, an AI teaching assistant that explains concepts clearly and creates interactive visualizations.
When explaining concepts:
1. Break down complex topics into clear, logical steps
2. Use analogies and concrete examples
3. Structure responses with clear headings
4. Include code examples when relevant
Keep responses clear, educational, and engaging. Use markdown formatting."#;

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: prompt.clone(),
        },
    ];

    let request_body = ChatCompletionRequest {
        model: model.clone(),
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
    };

    let (url, headers) = match settings.llm_provider.as_str() {
        "nvidia" => {
            let mut h = HashMap::new();
            h.insert("Authorization".to_string(), format!("Bearer {}", api_key));
            h.insert("Content-Type".to_string(), "application/json".to_string());
            ("https://integrate.api.nvidia.com/v1/chat/completions".to_string(), h)
        }
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
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model.replace("models/", ""),
                api_key
            );
            return call_gemini(&url, prompt).await;
        }
        "ollama" => {
            let base = std::env::var("OLLAMA_ENDPOINT").unwrap_or_else(|_| "http://localhost:11434".to_string());
            let url = format!("{}/api/chat", base);
            return call_ollama(&url, model, prompt).await;
        }
        "llama_cpp" | "local" => {
            let base = std::env::var("LLAMA_CPP_ENDPOINT").unwrap_or_else(|_| "http://localhost:8080/v1".to_string());
            return call_llama_cpp(&base, model, prompt).await;
        }
        _ => return Err(format!("Unknown provider: {}", settings.llm_provider)),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .headers({
            let mut header_map = reqwest::header::HeaderMap::new();
            for (k, v) in headers {
                header_map.insert(
                    reqwest::header::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                    reqwest::header::HeaderValue::from_str(&v).unwrap(),
                );
            }
            header_map
        })
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error: {} - {}", status, error_text));
    }

    let chat_response: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = chat_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "No response generated".to_string());

    Ok(content)
}

async fn call_gemini(url: &str, prompt: String) -> Result<String, String> {
    let system_prompt = "You are Unfold, an AI teaching assistant. Explain concepts clearly with examples.";

    let gemini_request = GeminiRequest {
        contents: vec![
            GeminiContent {
                parts: vec![GeminiPart {
                    text: system_prompt.to_string(),
                }],
            },
            GeminiContent {
                parts: vec![GeminiPart { text: prompt }],
            },
        ],
        generation_config: GeminiConfig {
            temperature: 0.7,
            max_output_tokens: 4096,
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

    let gemini_resp: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

    let content = gemini_resp
        .candidates
        .first()
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
            OllamaMessage {
                role: "system".to_string(),
                content: "You are Unfold, an AI teaching assistant. Explain concepts clearly with examples.".to_string(),
            },
            OllamaMessage {
                role: "user".to_string(),
                content: prompt,
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

    let ollama_resp: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(ollama_resp.message.content)
}

async fn call_llama_cpp(base_url: &str, model: String, prompt: String) -> Result<String, String> {
    let system_prompt = "You are Unfold, an AI teaching assistant. Explain concepts clearly with examples.";
    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: prompt,
        },
    ];

    let request_body = ChatCompletionRequest {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
    };

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("llama.cpp request failed: {}. Ensure llama-server is running on {}", e, base_url))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("llama.cpp API error: {} - {}", status, error));
    }

    let chat_response: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse llama.cpp response: {}", e))?;

    let content = chat_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_else(|| "No response generated".to_string());

    Ok(content)
}

#[command]
pub async fn synthesize_speech(
    state: State<'_, AppState>,
    text: String,
    voice: Option<String>,
) -> Result<String, String> {
    use base64::Engine;

    let settings = state
        .settings
        .read()
        .map_err(|e| format!("Failed to read settings: {}", e))?
        .clone();

    let api_key = settings.api_key.ok_or_else(|| "No API key configured for speech synthesis".to_string())?;
    let tts_model = settings
        .tts_model
        .unwrap_or_else(|| "nvidia/magpie-tts-zeroshot".to_string());

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "model": tts_model,
        "input": text,
        "voice": voice.unwrap_or_else(|| "alloy".to_string()),
        "response_format": "mp3"
    });

    let resp = client
        .post("https://integrate.api.nvidia.com/v1/audio/speech")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("TTS network error: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("NVIDIA TTS error: {}", err_text));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("Failed to read TTS audio: {}", e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:audio/mp3;base64,{}", b64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_send_message_request_serde() {
        let json = r#"{"prompt":"Explain quantum computing","conversation_id":"c1"}"#;
        let req: SendMessageRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.prompt, "Explain quantum computing");
        assert_eq!(req.conversation_id, Some("c1".into()));
        assert_eq!(req.image_base64, None);
    }

    #[test]
    fn test_chat_completion_request_serde() {
        let req = ChatCompletionRequest {
            model: "llama-3-8b".into(),
            messages: vec![ChatMessage {
                role: "user".into(),
                content: "hello".into(),
            }],
            temperature: 0.5,
            max_tokens: 1024,
            stream: false,
        };
        let serialized = serde_json::to_string(&req).unwrap();
        assert!(serialized.contains("llama-3-8b"));
        assert!(serialized.contains("hello"));
    }

    #[test]
    fn test_llama_cpp_model_defaults() {
        let req = ChatCompletionRequest {
            model: "nemotron-3-4b-int4".into(),
            messages: vec![ChatMessage {
                role: "user".into(),
                content: "How does distributed consensus work?".into(),
            }],
            temperature: 0.7,
            max_tokens: 2048,
            stream: false,
        };
        let serialized = serde_json::to_string(&req).unwrap();
        assert!(serialized.contains("nemotron-3-4b-int4"));
        assert!(serialized.contains("distributed consensus"));
    }
}
