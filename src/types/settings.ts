export type LLMProvider = 'groq' | 'gemini' | 'ollama' | 'openai' | 'llama_cpp' | 'local';

export interface Settings {
  llm_provider: LLMProvider;
  api_key: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  vision_model?: string;
  speech_rate?: number;
  speech_voice?: string;
}
