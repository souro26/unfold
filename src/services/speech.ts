import { invoke } from '@tauri-apps/api/core';
import { getSettings } from './ipc';

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  voiceName?: string;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface SpeechLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export class SpeechService {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static selectedVoice: SpeechSynthesisVoice | null = null;
  private static selectedLang: string = 'en-US';
  private static currentAudio: HTMLAudioElement | null = null;

  public static readonly SUPPORTED_LANGUAGES: SpeechLanguage[] = [
    { code: 'en-US', name: 'English (US)', nativeName: 'English' },
    { code: 'en-GB', name: 'English (UK)', nativeName: 'English' },
    { code: 'es-ES', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr-FR', name: 'French', nativeName: 'Français' },
    { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
    { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
    { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português' },
    { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
  ];

  static isSupported(): boolean {
    return !!this.synth;
  }

  static getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  static getSupportedLanguages(): SpeechLanguage[] {
    return this.SUPPORTED_LANGUAGES;
  }

  static setVoice(voiceName: string): void {
    const voices = this.getVoices();
    const found = voices.find((v) => v.name === voiceName || v.lang.startsWith(voiceName));
    if (found) {
      this.selectedVoice = found;
      this.selectedLang = found.lang;
    }
  }

  static setLanguage(langCode: string): void {
    this.selectedLang = langCode;
    const voices = this.getVoices();
    // Find best matching voice for this language
    const langPrefix = langCode.split('-')[0].toLowerCase();
    const exactMatch = voices.find((v) => v.lang.toLowerCase() === langCode.toLowerCase());
    const prefixMatch = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    this.selectedVoice = exactMatch || prefixMatch || null;
  }

  static getCurrentLanguage(): string {
    return this.selectedLang;
  }

  /**
   * Lightweight language detector based on unicode scripts
   */
  public static detectLanguage(text: string): string {
    // Japanese Hiragana & Katakana
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
    // Chinese characters (Kanji/Hanzi) without Japanese kana
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
    // Devanagari (Hindi)
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
    // Cyrillic
    if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';
    // Spanish inverted punctuation or common accented chars / words
    if (/[¿¡áéíóúñ]/i.test(text) || /\b(hola|mundo|por|para|como|está|estás)\b/i.test(text)) return 'es-ES';
    // French accented chars or words
    if (/[àâçèéêëîïôûùüÿœæ]/i.test(text) || /\b(bonjour|monde|vous|nous|pour|dans|avec|c'est)\b/i.test(text)) return 'fr-FR';
    // German umlauts, eszett or words
    if (/[äöüß]/i.test(text) || /\b(und|der|die|das|ist|nicht|mit|ein|eine|schöner)\b/i.test(text)) return 'de-DE';

    return 'en-US';
  }

  /**
   * Process text and SSML tags (e.g. <break>, <emphasis>) into TTS-friendly phrases
   */
  public static parseSSML(input: string): string {
    return input
      // Convert breaks to ellipses / punctuation for natural pauses in Web Speech API
      .replace(/<break\s+time=["']?(\d+m?s)["']?\s*\/?>/gi, ' ... ')
      .replace(/<break\s*\/?>/gi, ' ... ')
      // Strip emphasis / prosody tags while preserving content
      .replace(/<(?:emphasis|prosody|say-as)[^>]*>(.*?)<\/(?:emphasis|prosody|say-as)>/gi, '$1')
      // Strip markdown code and formatting
      .replace(/```[\s\S]*?```/g, 'code snippet omitted')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#$[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static async speak(text: string, options: SpeechOptions = {}): Promise<void> {
    const cleanText = this.parseSSML(text);
    if (!cleanText) return;

    this.stop();

    // 1. Try NVIDIA Neural TTS if enabled & configured
    try {
      const settings = await getSettings();
      if (settings.tts_provider !== 'system' && settings.api_key && settings.llm_provider === 'nvidia') {
        const audioData = await invoke<string>('synthesize_speech', {
          text: cleanText,
          voice: options.voiceName || 'alloy',
        });
        if (audioData) {
          const audio = new Audio(audioData);
          this.currentAudio = audio;
          if (options.onStart) options.onStart();
          audio.onended = () => {
            this.currentAudio = null;
            if (options.onEnd) options.onEnd();
          };
          audio.onerror = (e) => {
            console.warn('Audio playback error, falling back to Web Speech:', e);
            this.currentAudio = null;
            this.speakWithWebSpeech(cleanText, options);
          };
          await audio.play();
          return;
        }
      }
    } catch (err) {
      // Gracefully fall back to local browser speech synthesis
    }

    // 2. Fallback to browser Web Speech API
    this.speakWithWebSpeech(cleanText, options);
  }

  public static speakWithWebSpeech(cleanText: string, options: SpeechOptions = {}): void {
    if (!this.synth) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    const targetLang = options.lang || this.selectedLang || this.detectLanguage(cleanText);
    utterance.lang = targetLang;

    if (this.selectedVoice && this.selectedVoice.lang.toLowerCase().startsWith(targetLang.split('-')[0].toLowerCase())) {
      utterance.voice = this.selectedVoice;
    } else if (options.voiceName) {
      const v = this.getVoices().find((voice) => voice.name === options.voiceName);
      if (v) utterance.voice = v;
    } else {
      const prefix = targetLang.split('-')[0].toLowerCase();
      const match = this.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
      if (match) utterance.voice = match;
    }

    if (options.onStart) utterance.onstart = () => options.onStart!();
    if (options.onEnd) utterance.onend = () => options.onEnd!();
    if (options.onError) utterance.onerror = (e) => options.onError!(e);

    this.synth.speak(utterance);
  }

  static stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }

  static isSpeaking(): boolean {
    const isAudioPlaying = !!(this.currentAudio && !this.currentAudio.paused);
    const isSynthSpeaking = !!(this.synth && this.synth.speaking);
    return isAudioPlaying || isSynthSpeaking;
  }
}
