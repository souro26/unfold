use std::path::PathBuf;
use tauri::command;

/// Resolves the canonical logs directory for Unfold.
/// Searches for ./logs or ../logs (when in src-tauri) or creates ./logs in workspace root.
pub fn resolve_logs_dir() -> PathBuf {
    let cur = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    // If current dir has a logs folder, use it
    if cur.join("logs").exists() {
        return cur.join("logs");
    }

    // If current dir is src-tauri, check parent
    if cur.file_name().map_or(false, |n| n == "src-tauri") {
        if let Some(parent) = cur.parent() {
            let p_logs = parent.join("logs");
            let _ = std::fs::create_dir_all(&p_logs);
            return p_logs;
        }
    }

    // Otherwise create logs in current directory
    let logs_dir = cur.join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    logs_dir
}

#[command]
pub async fn write_log_file(filename: String, content: String) -> Result<String, String> {
    let logs_dir = resolve_logs_dir();
    // Allow standard extension dots, but sanitize directory traversals
    let clean_name = filename.trim_start_matches(['/', '\\']).to_string();
    let sanitized_filename = clean_name.replace("..", "_");
    let file_path = logs_dir.join(&sanitized_filename);

    if let Some(parent) = file_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write log file {:?}: {}", file_path, e))?;

    tracing::info!("Log written successfully: {:?}", file_path);
    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub async fn append_log_file(filename: String, content: String) -> Result<String, String> {
    use std::io::Write;
    let logs_dir = resolve_logs_dir();
    let clean_name = filename.trim_start_matches(['/', '\\']).to_string();
    let sanitized_filename = clean_name.replace("..", "_");
    let file_path = logs_dir.join(&sanitized_filename);

    if let Some(parent) = file_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open log file for append {:?}: {}", file_path, e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to append to log file {:?}: {}", file_path, e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub async fn get_logs_directory() -> Result<String, String> {
    let logs_dir = resolve_logs_dir();
    Ok(logs_dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_resolve_logs_dir() {
        let dir = resolve_logs_dir();
        assert!(dir.to_string_lossy().contains("logs"));
        assert!(dir.exists());
    }

    #[tokio::test]
    async fn test_write_and_append_log_file() {
        let test_file = "test_audit.log".to_string();
        let write_res = write_log_file(test_file.clone(), "Initial Log Entry\n".to_string()).await;
        assert!(write_res.is_ok());

        let append_res = append_log_file(test_file.clone(), "Second Log Entry\n".to_string()).await;
        assert!(append_res.is_ok());

        let path = PathBuf::from(write_res.unwrap());
        let read_back = std::fs::read_to_string(&path).unwrap();
        assert!(read_back.contains("Initial Log Entry"));
        assert!(read_back.contains("Second Log Entry"));

        // Clean up test file
        let _ = std::fs::remove_file(path);
    }
}
