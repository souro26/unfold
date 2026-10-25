use unfold::commands::settings::AppState;
use unfold::commands::chat::{SendMessageRequest, ChatMessage, ChatCompletionRequest};
use unfold::screen_capture::ScreenCaptureRequest;

#[test]
fn test_integration_settings_workflow() {
    let app_state = AppState::default();

    // Verify initial default settings
    {
        let settings = app_state.settings.read().unwrap();
        assert_eq!(settings.llm_provider, "nvidia");
        assert_eq!(settings.model, "nvidia/nemotron-3.5-bolt-e4b");
        assert!(settings.screen_capture_permission);
    }

    // Mutate settings as user would through UI
    {
        let mut settings = app_state.settings.write().unwrap();
        settings.llm_provider = "groq".into();
        settings.model = "llama-3.3-70b-versatile".into();
        settings.api_key = Some("gsk_integration_test_key".into());
    }

    // Read back and assert consistency
    {
        let settings = app_state.settings.read().unwrap();
        assert_eq!(settings.llm_provider, "groq");
        assert_eq!(settings.model, "llama-3.3-70b-versatile");
        assert_eq!(settings.api_key.as_deref(), Some("gsk_integration_test_key"));
    }
}

#[test]
fn test_integration_chat_payload_generation() {
    let req = SendMessageRequest {
        prompt: "Teach me how Raft consensus algorithm works step by step".into(),
        conversation_id: Some("conv_integration_42".into()),
        image_base64: None,
    };

    let serialized = serde_json::to_string(&req).expect("serialize send message request");
    assert!(serialized.contains("Teach me how Raft consensus"));
    assert!(serialized.contains("conv_integration_42"));

    let chat_req = ChatCompletionRequest {
        model: "openai/gpt-4o-mini".into(),
        messages: vec![
            ChatMessage {
                role: "system".into(),
                content: "You are Unfold".into(),
            },
            ChatMessage {
                role: "user".into(),
                content: req.prompt,
            },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
    };

    let chat_json = serde_json::to_string(&chat_req).expect("serialize completion request");
    assert!(chat_json.contains("gpt-4o-mini"));
    assert!(chat_json.contains("Raft consensus"));
}

#[test]
fn test_integration_screen_capture_request_handling() {
    let req = ScreenCaptureRequest {
        region: None,
        include_cursor: false,
    };

    let json = serde_json::to_string(&req).expect("serialize capture request");
    let deserialized: ScreenCaptureRequest = serde_json::from_str(&json).expect("deserialize capture request");
    assert_eq!(deserialized.include_cursor, false);
    assert!(deserialized.region.is_none());
}
