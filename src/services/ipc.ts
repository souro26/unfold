import { invoke } from '@tauri-apps/api/core';
import { Settings, ScreenCaptureRequest, ScreenCaptureResponse, VisionRequest, VisionResponse } from '../types';

export async function setClickThrough(enabled: boolean): Promise<boolean> {
  try {
    return await invoke<boolean>('set_click_through', { enabled });
  } catch {
    return false;
  }
}

export async function toggleOverlay(): Promise<void> {
  try {
    await invoke('toggle_overlay');
  } catch {}
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
    // Running in browser or IPC unavailable
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
      // Running in browser, local storage save was already successful
    }
  }
}

export interface ChatHistoryItem {
  role: string;
  content: string;
}

export async function sendMessage(
  prompt: string,
  conversationId?: string,
  imageBase64?: string,
  history?: ChatHistoryItem[]
): Promise<string> {
  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  if (isTauri) {
    try {
      return await invoke<string>('send_message', {
        prompt,
        conversation_id: conversationId,
        image_base64: imageBase64,
        history,
        request: {
          prompt,
          conversation_id: conversationId,
          image_base64: imageBase64,
          history,
        },
      });
    } catch (err) {
      console.warn('Tauri IPC send_message failed, attempting web direct fetch:', err);
    }
  }

  // Web Browser Fallback: Direct CORS fetch to configured LLM provider
  return await sendWebDirectMessage(prompt, imageBase64);
}

async function sendWebDirectMessage(prompt: string, imageBase64?: string): Promise<string> {
  try {
    const settings = await getSettings();
    const apiKey = settings.api_key;
    if (!apiKey) return ''; // Fallback to instant verified blueprint

    let endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    let model = settings.model || 'nvidia/nemotron-3.5-bolt-e4b';

    const hasImage = Boolean(imageBase64 && imageBase64.length > 50);

    if (hasImage) {
      if (settings.llm_provider === 'nvidia' || !settings.llm_provider) {
        endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
        model = 'nvidia/nemotron-3.5-super-vl-120b-a12b';
      } else if (settings.llm_provider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        model = 'llama-3.2-11b-vision-preview';
      } else if (settings.llm_provider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        model = 'gpt-4o';
      }
    } else {
      if (settings.llm_provider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        model = settings.model || 'llama-3.3-70b-versatile';
      } else if (settings.llm_provider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        model = settings.model || 'gpt-4o';
      }
    }

    // Standard multimodal user message payload
    const userContent = hasImage
      ? [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: `[SCREEN OBSERVATION CONTEXT]\nCarefully analyze what is on the user's screen (code, UI layout, diagrams, text, or errors).\n\nUser Question:\n${prompt}`,
          },
        ]
      : prompt;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        temperature: settings.temperature ?? 0.7,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  } catch (err) {
    console.warn('Web direct LLM fetch error, falling back to local blueprint:', err);
  }
  return '';
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
