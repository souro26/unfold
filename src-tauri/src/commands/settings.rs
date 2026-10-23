use serde::{Deserialize, Serialize};
use tauri::{State, command};
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settings {
    pub llm_provider: String,
    pub api_key: Option<String>,
    pub model: String,
    pub theme: String,
    pub screen_capture_permission: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            llm_provider: "gemini".into(),
            api_key: None,
            model: "gemini-1.5-flash".into(),
            theme: "dark".into(),
            screen_capture_permission: true,
        }
    }
}

pub struct AppState {
    pub settings: RwLock<Settings>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            settings: RwLock::new(Settings::default()),
        }
    }
}

#[command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let settings = state
        .settings
        .read()
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    Ok(settings.clone())
}

#[command]
pub async fn update_settings(state: State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    let mut current = state
        .settings
        .write()
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    *current = settings.clone();
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let defaults = Settings::default();
        assert_eq!(defaults.llm_provider, "gemini");
        assert_eq!(defaults.model, "gemini-1.5-flash");
        assert!(defaults.screen_capture_permission);
        assert_eq!(defaults.api_key, None);
    }

    #[test]
    fn test_settings_serialization() {
        let settings = Settings {
            llm_provider: "groq".into(),
            api_key: Some("test-api-key-123".into()),
            model: "llama-3-70b".into(),
            theme: "dark".into(),
            screen_capture_permission: true,
        };

        let json = serde_json::to_string(&settings).expect("serialize settings");
        let parsed: Settings = serde_json::from_str(&json).expect("deserialize settings");
        assert_eq!(parsed, settings);
    }

    #[test]
    fn test_app_state_update() {
        let state = AppState::default();
        {
            let mut writer = state.settings.write().unwrap();
            writer.llm_provider = "openai".into();
            writer.api_key = Some("sk-test".into());
        }

        let reader = state.settings.read().unwrap();
        assert_eq!(reader.llm_provider, "openai");
        assert_eq!(reader.api_key, Some("sk-test".into()));
    }
}
