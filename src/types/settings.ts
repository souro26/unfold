export type LLMProvider = 'groq' | 'gemini' | 'ollama' | 'openai' | 'llama_cpp' | 'local' | 'nvidia';

export interface Settings {
  llm_provider: LLMProvider;
  api_key: string | null;
  model: string;
  vision_model?: string;
  tts_provider?: 'nvidia' | 'system';
  tts_model?: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  speech_rate?: number;
  speech_voice?: string;
}
