import { invoke } from '@tauri-apps/api/core';
import { Settings, ScreenCaptureRequest, ScreenCaptureResponse, VisionRequest, VisionResponse } from '../types';

export async function setClickThrough(enabled: boolean): Promise<boolean> {
  return await invoke<boolean>('set_click_through', { enabled });
}

export async function toggleOverlay(): Promise<void> {
  await invoke('toggle_overlay');
}

export async function getSettings(): Promise<Settings> {
  return await invoke<Settings>('get_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  await invoke('save_settings', { settings });
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
