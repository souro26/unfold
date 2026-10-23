export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenCaptureRequest {
  region?: ScreenRegion;
  include_cursor?: boolean;
}

export interface ScreenCaptureResponse {
  image_base64: string;
  width: number;
  height: number;
  timestamp: string;
}

export interface VisionRequest {
  prompt: string;
  image_base64: string;
  model: string;
  provider: string;
  api_key: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface VisionResponse {
  content: string;
  model: string;
  provider: string;
  timestamp: string;
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  is_primary: boolean;
}
