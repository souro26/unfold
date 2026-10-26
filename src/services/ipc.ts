import { invoke } from '@tauri-apps/api/core';
import { Settings, ScreenCaptureRequest, ScreenCaptureResponse, VisionRequest, VisionResponse } from '../types';

export async function setClickThrough(enabled: boolean): Promise<boolean> {
  return await invoke<boolean>('set_click_through', { enabled });
}

export async function toggleOverlay(): Promise<void> {
  await invoke('toggle_overlay');
}

const SETTINGS_STORAGE_KEY = 'unfold_settings';

export async function getSettings(): Promise<Settings> {
  try {
    const s = await invoke<Settings>('get_settings');
    if (s) {
      try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s)); } catch {}
      return s;
    }
  } catch (err) {
    console.warn('IPC get_settings failed, checking local storage:', err);
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    llm_provider: 'nvidia',
    api_key: null,
    model: 'nvidia/nemotron-3.5-bolt-e4b',
    temperature: 0.7,
    max_tokens: 4096,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  // 1. Persist to local storage immediately
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }

  // 2. Invoke backend IPC with fallback between save_settings and update_settings
  try {
    await invoke('save_settings', { settings });
  } catch (err) {
    try {
      await invoke('update_settings', { settings });
    } catch (innerErr) {
      console.warn('IPC update_settings also failed:', innerErr);
      // If running without backend, local storage save was already successful
    }
  }
}

export async function sendMessage(
  prompt: string,
  conversationId?: string,
  imageBase64?: string
): Promise<string> {
  return await invoke<string>('send_message', {
    prompt,
    conversation_id: conversationId,
    image_base64: imageBase64,
    request: {
      prompt,
      conversation_id: conversationId,
      image_base64: imageBase64,
    },
  });
}

export async function captureScreen(request?: ScreenCaptureRequest): Promise<ScreenCaptureResponse> {
  return await invoke<ScreenCaptureResponse>('capture_screen', {
    request: request || {
      region: { x: 0, y: 0, width: 0, height: 0 },
      include_cursor: false,
    },
  });
}

export async function captureScreenWithVision(
  request: ScreenCaptureRequest,
  visionRequest: VisionRequest
): Promise<VisionResponse> {
  return await invoke<VisionResponse>('capture_screen_with_vision', {
    request,
    vision_request: visionRequest,
  });
}

export async function writeLogFile(filename: string, content: string): Promise<string> {
  try {
    return await invoke<string>('write_log_file', { filename, content });
  } catch (err) {
    console.warn(`[IPC writeLogFile fallback] Unable to write ${filename} via Tauri IPC:`, err);
    try {
      localStorage.setItem(`unfold_log_${filename}`, content);
    } catch {}
    return `localStorage://unfold_log_${filename}`;
  }
}

export async function appendLogFile(filename: string, content: string): Promise<string> {
  try {
    return await invoke<string>('append_log_file', { filename, content });
  } catch (err) {
    console.warn(`[IPC appendLogFile fallback] Unable to append to ${filename} via Tauri IPC:`, err);
    try {
      const prev = localStorage.getItem(`unfold_log_${filename}`) || '';
      localStorage.setItem(`unfold_log_${filename}`, prev + content);
    } catch {}
    return `localStorage://unfold_log_${filename}`;
  }
}

export async function getLogsDirectory(): Promise<string> {
  try {
    return await invoke<string>('get_logs_directory');
  } catch (err) {
    return 'logs/';
  }
}
