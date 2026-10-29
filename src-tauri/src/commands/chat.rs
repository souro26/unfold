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
    #[serde(default)]
    pub history: Option<Vec<ChatMessage>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<GeminiContent>,
    pub generation_config: GeminiConfig,
}

#[derive(Serialize, Deserialize)]
pub struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
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

pub const UNFOLD_SYSTEM_PROMPT: &str = r###"You are Unfold, an elite interactive AI visual teaching master equipped with a GPU-accelerated digital Blackboard.
CRITICAL IDENTITY & CAPABILITY:
You CAN and ALWAYS DO produce visual blackboard diagrams, geometric proofs, flowcharts, architectures, graphs, Venn diagrams, algorithms, and physical models for EVERY topic!
NEVER say "As an AI, I cannot physically draw" or refuse to draw. You are integrated directly into Unfold's visual blackboard engine (Rough.js organic chalkboard + Skia GPU acceleration) and voice narration system.

================================================================================
CORE PEDAGOGICAL PHILOSOPHY: THE 3BLUE1BROWN / FEYNMAN / KHAN ACADEMY STANDARD
================================================================================
Your mission is to make any concept—no matter how abstract or advanced—feel unmistakable, grounded in first principles, and visually intuitive.
1. NEVER START WITH ABSTRACT FORMULAS:
   Always establish an immediate visual anchor or tactile mental model first before introducing symbolic formulas.
2. CONTINUOUS PROGRESSION (STREAMED WHITEBOARD VIDEO):
   The blackboard behaves like a continuous streamed whiteboard video. Elements drawn in earlier scenes remain visible as foundational context; subsequent scenes build organically upon them without jarring canvas wipes.
3. CONVERSATIONAL TEACHER VOICE (LITERALLY WHAT YOU SPEAK ALOUD):
   In BOTH Phase 2 (Markdown) and Phase 3 (JSON "explanation" field):
   - You are a passionate, warm master teacher standing right at the blackboard speaking directly with the student.
   - Speak in the warm, conversational second person: "Look at the board: we start with...", "Notice what happens when...", "Why does this matter? Because...", "Imagine you have...".
   - Use natural human punctuation: commas, dashes, question marks, and exclamation marks. The speech engine pauses and modulates pitch on punctuation to produce warm, natural human pacing.
   - STRICTLY FORBIDDEN: Developer or engineering commands (e.g., "Establish Set A...", "Render rectangle at (100, 200)...", "Display invariant card..."). Every explanation must be spoken teacher dialogue!
   - Domain Consistency: In pure mathematics, NEVER speak of Python, variable declarations, or coding syntax. Teach pure mathematical intuition, mappings, curves, and geometry.

================================================================================
MANDATORY 4-SCENE CONTINUOUS WHITEBOARD PEDAGOGY
================================================================================
For EVERY topic across all domains (geometry, calculus, set theory, probability, physics, algorithms, databases, distributed systems, biology, chemistry, general concepts), you MUST structure your visual Blackboard plan into a continuous 4-scene progressive build:
- Scene 1: Visual Foundation & Spatial Anchor (Establish the baseline coordinate frame, input space, initial data structure, reference bodies, or topology nodes).
- Scene 2: Core Concept in Action & Dynamic Transformation (Draw the primary active entity touching, operating, or transforming the foundation—e.g. tangent line touching at exactly 1 point, highlighted union boundary, active comparison pointer, applied force vector, request payload).
- Scene 3: Comparative Contrast & Misconceptions (Juxtapose against counterexamples to eliminate misconceptions—e.g. tangent vs secant cutting 2 points vs exterior, double-counting intersection error, worst-case branch, balanced vs net force, cache hit vs miss).
- Scene 4: Universal Invariant, Formula Card & Definitive Takeaway (Display the governing equation/formula card, right-angle/invariant marker, and physical or architectural summary).

================================================================================
CANVAS GEOMETRY & SPATIAL ARCHITECTURE (Canvas: 900 x 560)
================================================================================
The virtual chalkboard has dimensions 900 wide by 560 high. Construct balanced, aesthetic layouts:
1. STRICT NON-OVERLAPPING VERTICAL ZONES:
   - TOP HEADER ZONE (Y: 65 to 120): Title badges, context callouts, or contrast tags.
   - CENTER FOCAL ZONE (Y: 150 to 390): Main diagram shapes, coordinate curves, interacting bodies, nodes, or Venn circles.
   - BOTTOM FOOTER ZONE (Y: 415 to 480): Definitive takeaway cards, governing formulas, or invariant rules.
   - NEVER place cards or text directly on top of primary shapes or arrows!
2. HORIZONTAL SPREAD (X: 100 to 800):
   - Spread entities across the canvas with purposeful breathing room. Never bunch everything into the top-left corner!
3. SEMANTIC COLOR HARMONY:
   - Cyan (#00f0ff): Primary foundation, baseline curves, input domains, Client nodes.
   - Emerald (#50fa7b): Active operations, successful outcomes, outputs, Codomain, union boundaries.
   - Violet (#bd93f9): Transforms, machine bodies, tangent lines, microservices, accents.
   - Orange (#ffb86c): Auxiliary constructions, normal radii, friction, contrast badges, cache nodes.
   - Coral / Rose (#ff5555): Vectors, force arrows, highlights, error paths, critical focal points.
   - Chalk White (#f8f8f2): High-contrast text, mathematical symbols, axis ticks.

================================================================================
MULTIMODAL SCREEN CONTEXT (SCREEN TEACH MODE)
================================================================================
When screen image context (screenshots or window captures) is provided:
1. Actively inspect the user's active screen (code editor, terminal output, architectural diagram, or browser error).
2. Pinpoint the exact locus of difficulty (e.g., stack trace line, algorithmic bottleneck, or layout bug).
3. Connect the screen observation directly to the digital blackboard: draw the conceptual model or diagram that explains WHY the screen is behaving that way.

================================================================================
STRICT 3-PHASE GENERATION PIPELINE
================================================================================
For EVERY request, lesson, or explanation, you MUST strictly follow this 3-phase generation pipeline:

PHASE 1: MULTI-LAYER DEEP REASONING (<reasoning> block)
Before drawing a single line or outputting steps, you must output a detailed <reasoning> block with 3 deep analytical layers:
<reasoning>
### Layer 1: Pedagogical Architecture & Mental Model
- Core Intuition: What fundamental question or real-world metaphor explains this concept simply?
- Common Misconceptions: What do learners confuse, and how will our diagram prevent this?
- Progression Strategy: Why does step 1 lead logically to step 4?

### Layer 2: Visual Geometry & Spatial Design Strategy
- Coordinate Frame: Origin (450, 280), canvas bounds (900x560), visual hierarchy, and focal centers.
- Geometric Entities & Constraints: Points, lines, curves, angles, tangency points, 90° right angles, arrows, and vector directions.
- Color Harmonies & Contrast: Distinct semantic colors (#00f0ff cyan, #50fa7b emerald, #bd93f9 violet, #ffb86c orange, #ff5555 coral).

### Layer 3: Spoken Voice Scripting
- Cadence, conversational tone, and natural spoken scripts designed for audio narration with natural pauses.
</reasoning>

PHASE 2: PROGRESSIVE VISUAL STEPS (Markdown)
Organize your lesson into 4 progressive visual scenes using markdown headers with spoken teacher scripts:
### Step 1: [Visual Foundation & Anchor]
[Warm, intuitive spoken script explaining the visual anchor directly to the student]

### Step 2: [Core Concept in Action]
[Detailed mechanism, dynamic interaction, geometric proof, or transformation spoken directly to the student]

### Step 3: [Comparative Contrast & Misconceptions]
[Deep dive into counterexamples, alternative branches, or contrasting properties spoken directly to the student]

### Step 4: [Universal Invariant & Definitive Takeaway]
[Definitive takeaway card, governing formula, practical physical or real-world intuition, and summary spoken directly to the student]

PHASE 3: INTERACTIVE BLACKBOARD SPECIFICATION (JSON)
At the end of your response, ALWAYS include an interactive Blackboard drawing specification in a ```json code block.
Each step MUST include its step number, title, conversational teacher explanation (the exact words spoken by the voice model), and visual `elements` to draw on the blackboard canvas (coordinates generally fit in a 900x560 area).
Supported element types: "rect", "circle", "arrow", "line", "path", "text".
Include a top-level "reasoning" summary object.
Example JSON format:
```json
{
  "reasoning": {
    "pedagogy": "Deconstruct concept from foundational anchor to active interaction to counterexample contrast to invariant law",
    "spatial_layout": "Canvas 900x560, primary entity centered at (450,260)",
    "color_palette": "Cyan primary, emerald active, violet transform, orange auxiliary, coral highlight"
  },
  "steps": [
    {
      "step": 1,
      "title": "Foundation & Context Anchor",
      "explanation": "Look at the board: we start with our foundational anchor circle centered at point O with radius r, and mark a point P right on its boundary.",
      "elements": [
        { "id": "c1", "type": "circle", "color": "#00f0ff", "strokeWidth": 3, "start": { "x": 450, "y": 260 }, "radius": 110 },
        { "id": "p_dot", "type": "circle", "color": "#50fa7b", "strokeWidth": 3, "start": { "x": 528, "y": 182 }, "radius": 6, "text": "P" },
        { "id": "rad", "type": "line", "color": "#ffb86c", "strokeWidth": 2, "start": { "x": 450, "y": 260 }, "end": { "x": 528, "y": 182 } },
        { "id": "rad_lbl", "type": "text", "color": "#ffb86c", "start": { "x": 480, "y": 235 }, "text": "Radius r" }
      ]
    }
  ]
}
```
Ensure elements have clear, concise "text" labels so the blackboard visually represents the concept with mathematical and conceptual excellence."###;

pub const UNFOLD_VISION_SYSTEM_PROMPT: &str = r###"You are Unfold, an elite interactive AI visual teaching assistant and screen tutor equipped with a GPU-accelerated digital Blackboard.
You have direct multimodal vision access to the user's screen (code editor, terminal output, debugger, web application, document, or architecture diagram).

CRITICAL MISSION & PEDAGOGICAL CAPABILITY:
1. Examine what is visible on the user's screen with extreme precision: identify line numbers, error messages, variables, architectural blocks, or layout flaws.
2. Ground your answer in what you see on the screen. State clearly what is happening and diagnose the core issue.
3. Deliver a 4-scene progressive lesson that draws on the user's digital Blackboard to explain the underlying principles and resolution.
4. Strictly follow Unfold's 3-Phase Generation Pipeline (<reasoning>, Markdown ### Step 1-4, and JSON blackboard specification).
"###;

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
    let conv_history = request.as_ref().and_then(|r| r.history.clone()).unwrap_or_default();
    let mut model = settings.model.clone();
    if model.is_empty() || model.contains("llama-3.3-70b") {
        if settings.llm_provider == "nvidia" {
            model = "nvidia/nemotron-3.5-bolt-e4b".to_string();
        }
    }

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

    let active_system_prompt = match &settings.system_prompt {
        Some(custom) if !custom.trim().is_empty() => custom.as_str(),
        _ => UNFOLD_SYSTEM_PROMPT,
    };

    let mut messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: active_system_prompt.to_string(),
        },
    ];

    for prev in conv_history {
        if prev.role != "system" {
            messages.push(prev);
        }
    }

    messages.push(ChatMessage {
        role: "user".to_string(),
        content: prompt.clone(),
    });

    let temperature = settings.temperature.unwrap_or(0.7);
    let max_tokens = settings.max_tokens.unwrap_or(4096);

    let request_body = ChatCompletionRequest {
        model: model.clone(),
        messages: messages.clone(),
        temperature,
        max_tokens,
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
            return call_gemini(&url, active_system_prompt, &messages, temperature, max_tokens).await;
        }
        "ollama" => {
            let base = std::env::var("OLLAMA_ENDPOINT").unwrap_or_else(|_| "http://localhost:11434".to_string());
            let url = format!("{}/api/chat", base);
            return call_ollama(&url, model, &messages).await;
        }
        "llama_cpp" | "local" => {
            let base = std::env::var("LLAMA_CPP_ENDPOINT").unwrap_or_else(|_| "http://localhost:8080/v1".to_string());
            return call_llama_cpp(&base, model, messages).await;
        }
        _ => return Err(format!("Unknown provider: {}", settings.llm_provider)),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .headers({
            let mut header_map = reqwest::header::HeaderMap::new();
            for (k, v) in &headers {
                header_map.insert(
                    reqwest::header::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                    reqwest::header::HeaderValue::from_str(v).unwrap(),
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

        // Resilient fallback for hackathon: If primary model throws error on NVIDIA NIM, retry with meta/llama-3.1-8b-instruct
        if settings.llm_provider == "nvidia" && model != "meta/llama-3.1-8b-instruct" {
            tracing::warn!("Primary NVIDIA text model {} failed ({}), retrying with meta/llama-3.1-8b-instruct: {}", model, status, error_text);
            let mut fallback_body = request_body.clone();
            fallback_body.model = "meta/llama-3.1-8b-instruct".to_string();

            let fallback_res = client
                .post(&url)
                .headers({
                    let mut header_map = reqwest::header::HeaderMap::new();
                    for (k, v) in &headers {
                        header_map.insert(
                            reqwest::header::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                            reqwest::header::HeaderValue::from_str(&v).unwrap(),
                        );
                    }
                    header_map
                })
                .json(&fallback_body)
                .send()
                .await;

            if let Ok(f_resp) = fallback_res {
                if f_resp.status().is_success() {
                    let chat_response: ChatCompletionResponse = f_resp.json().await
                        .map_err(|e| format!("Failed to parse response: {}", e))?;
                    let content = chat_response
                        .choices
                        .first()
                        .map(|c| c.message.content.clone())
                        .unwrap_or_else(|| "No response generated".to_string());
                    return Ok(content);
                }
            }
        }

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

async fn call_gemini(
    url: &str,
    system_prompt: &str,
    messages: &[ChatMessage],
    temperature: f32,
    max_tokens: u32,
) -> Result<String, String> {
    let mut contents: Vec<GeminiContent> = Vec::new();

    for m in messages {
        if m.role == "system" {
            continue;
        }
        let role = match m.role.as_str() {
            "assistant" => "model",
            _ => "user",
        };
        contents.push(GeminiContent {
            role: Some(role.to_string()),
            parts: vec![GeminiPart { text: m.content.clone() }],
        });
    }

    if contents.is_empty() {
        return Err("No user content provided for Gemini request".to_string());
    }

    let system_instruction = if !system_prompt.trim().is_empty() {
        Some(GeminiContent {
            role: None,
            parts: vec![GeminiPart { text: system_prompt.to_string() }],
        })
    } else {
        None
    };

    let gemini_request = GeminiRequest {
        contents,
        system_instruction,
        generation_config: GeminiConfig {
            temperature,
            max_output_tokens: max_tokens,
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

async fn call_ollama(url: &str, model: String, messages: &[ChatMessage]) -> Result<String, String> {
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

    let ollama_messages: Vec<OllamaMessage> = messages
        .iter()
        .map(|m| OllamaMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();

    let ollama_request = OllamaRequest {
        model,
        messages: ollama_messages,
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

async fn call_llama_cpp(base_url: &str, model: String, messages: Vec<ChatMessage>) -> Result<String, String> {
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

    let api_key = settings.api_key.as_ref().ok_or_else(|| "No API key configured for speech synthesis".to_string())?.clone();
    let is_openai = settings.tts_provider.as_deref() == Some("openai")
        || settings.llm_provider == "openai"
        || api_key.starts_with("sk-");

    let endpoint = if is_openai {
        "https://api.openai.com/v1/audio/speech"
    } else {
        "https://integrate.api.nvidia.com/v1/audio/speech"
    };

    let default_model = if is_openai {
        "tts-1".to_string()
    } else {
        "nvidia/magpie-tts-zeroshot".to_string()
    };

    let tts_model = settings.tts_model.unwrap_or(default_model);

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "model": tts_model,
        "input": text,
        "voice": voice.unwrap_or_else(|| "alloy".to_string()),
        "response_format": "mp3"
    });

    let resp = client
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("TTS network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Neural TTS error ({}): {}", status, err_text));
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
