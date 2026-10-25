use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::{command, State};

fn default_theme() -> String {
    "dark".to_string()
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settings {
    pub llm_provider: String,
    pub api_key: Option<String>,
    pub model: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_true")]
    pub screen_capture_permission: bool,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub vision_model: Option<String>,
    #[serde(default)]
    pub tts_provider: Option<String>,
    #[serde(default)]
    pub tts_model: Option<String>,
    #[serde(default)]
    pub speech_rate: Option<f32>,
    #[serde(default)]
    pub speech_voice: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            llm_provider: "nvidia".into(),
            api_key: None,
            model: "meta/llama-3.3-70b-instruct".into(),
            theme: "dark".into(),
            screen_capture_permission: true,
            temperature: Some(0.7),
            max_tokens: Some(4096),
            system_prompt: None,
            vision_model: Some("nvidia/nemotron-3.5-super-vl-120b-a12b".into()),
            tts_provider: Some("nvidia".into()),
            tts_model: Some("nvidia/magpie-tts-zeroshot".into()),
            speech_rate: Some(1.0),
            speech_voice: None,
        }
    }
}

fn get_config_path() -> Option<PathBuf> {
    ProjectDirs::from("com", "unfold", "Unfold").map(|proj| {
        let dir = proj.config_dir();
        let _ = std::fs::create_dir_all(dir);
        dir.join("settings.json")
    })
}

fn load_saved_settings() -> Settings {
    if let Some(path) = get_config_path() {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str::<Settings>(&content) {
                    return settings;
                }
            }
        }
    }
    Settings::default()
}

fn persist_settings(settings: &Settings) {
    if let Some(path) = get_config_path() {
        if let Ok(json) = serde_json::to_string_pretty(settings) {
            let _ = std::fs::write(path, json);
        }
    }
}

pub struct AppState {
    pub settings: RwLock<Settings>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            settings: RwLock::new(load_saved_settings()),
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
    persist_settings(&settings);
    Ok(settings)
}

#[command]
pub async fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<Settings, String> {
    update_settings(state, settings).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let defaults = Settings::default();
        assert_eq!(defaults.llm_provider, "nvidia");
        assert_eq!(defaults.model, "meta/llama-3.3-70b-instruct");
        assert!(defaults.screen_capture_permission);
        assert_eq!(defaults.api_key, None);
    }

    #[test]
    fn test_settings_serialization() {
        let settings = Settings {
            llm_provider: "nvidia".into(),
            api_key: Some("nvapi-test-123".into()),
            model: "meta/llama-3.3-70b-instruct".into(),
            theme: "dark".into(),
            screen_capture_permission: true,
            temperature: Some(0.7),
            max_tokens: Some(4096),
            system_prompt: None,
            vision_model: None,
            tts_provider: None,
            tts_model: None,
            speech_rate: None,
            speech_voice: None,
        };

        let json = serde_json::to_string(&settings).expect("serialize settings");
        let parsed: Settings = serde_json::from_str(&json).expect("deserialize settings");
        assert_eq!(parsed, settings);
    }

    #[test]
    fn test_app_state_update() {
        let state = AppState {
            settings: RwLock::new(Settings::default()),
        };
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
