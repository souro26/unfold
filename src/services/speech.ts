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
  onChunkStart?: (chunk: string, index: number, total: number) => void;
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
  private static activeSessionId: number = 0;

  static {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        SpeechService.selectedVoice = SpeechService.getBestVoiceForLang(SpeechService.selectedLang);
      };
    }
  }

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

  static getBestVoiceForLang(langCode: string): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    if (voices.length === 0) return null;
    const langPrefix = langCode.split('-')[0].toLowerCase();
    const matching = voices.filter(
      (v) => v.lang.toLowerCase() === langCode.toLowerCase() || v.lang.toLowerCase().startsWith(langPrefix)
    );
    if (matching.length === 0) return voices[0] || null;

    // Prioritize natural/neural voices over legacy robotic SAPI5 desktop voices
    const natural = matching.find((v) => /natural|neural|online/i.test(v.name));
    if (natural) return natural;

    const google = matching.find((v) => /google/i.test(v.name));
    if (google) return google;

    const nonDesktop = matching.find((v) => !/desktop/i.test(v.name));
    if (nonDesktop) return nonDesktop;

    return matching[0];
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
    this.selectedVoice = this.getBestVoiceForLang(langCode);
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

  /**
   * Split text into expressive sentence and thought chunks for natural human pacing
   */
  public static splitIntoNaturalChunks(text: string): string[] {
    const clean = this.parseSSML(text);
    if (!clean) return [];

    // Split on sentence boundaries: periods, question marks, exclamation marks, colons, or newlines
    const rawChunks = clean.match(/[^.!?:\n]+(?:[.!?:\n]+|$)/g) || [clean];
    const result: string[] = [];

    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      // If a single sentence is long (> 18 words) and contains clauses separated by commas/semicolons, sub-split
      const words = trimmed.split(/\s+/);
      if (words.length > 18 && /[,;]/.test(trimmed)) {
        const subParts = trimmed.split(/(?<=[,;])\s+/);
        for (const sub of subParts) {
          const s = sub.trim();
          if (s) result.push(s);
        }
      } else {
        result.push(trimmed);
      }
    }
    return result;
  }

  static async speak(text: string, options: SpeechOptions = {}): Promise<void> {
    const cleanText = this.parseSSML(text);
    if (!cleanText) return;

    this.stop();
    const sessionId = this.activeSessionId;

    // 1. Try Neural / Cloud TTS if configured
    try {
      const settings = await getSettings();
      const isNeuralConfigured = settings.tts_provider !== 'system' && (
        (settings.api_key && (settings.llm_provider === 'nvidia' || settings.llm_provider === 'openai' || settings.tts_provider === 'openai')) ||
        settings.tts_provider === 'custom'
      );
      if (isNeuralConfigured) {
        const audioData = await invoke<string>('synthesize_speech', {
          text: cleanText,
          voice: options.voiceName || 'alloy',
        });
        if (audioData) {
          if (sessionId !== this.activeSessionId) return;
          const audio = new Audio(audioData);
          this.currentAudio = audio;
          if (options.onStart) options.onStart();
          audio.onended = () => {
            this.currentAudio = null;
            if (sessionId === this.activeSessionId && options.onEnd) {
              options.onEnd();
            }
          };
          audio.onerror = (e) => {
            console.warn('Audio playback error, falling back to Web Speech:', e);
            this.currentAudio = null;
            if (sessionId === this.activeSessionId) {
              this.speakWithWebSpeech(cleanText, options);
            }
          };
          await audio.play();
          return;
        }
      }
    } catch (err) {
      // Gracefully fall back to local browser speech synthesis
    }

    // 2. Fallback to Expressive Web Speech API with sentence chunking & natural pauses
    this.speakWithWebSpeech(cleanText, options);
  }

  public static speakWithWebSpeech(cleanText: string, options: SpeechOptions = {}): void {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    const chunks = this.splitIntoNaturalChunks(cleanText);
    if (chunks.length === 0) {
      options.onEnd?.();
      return;
    }

    const sessionId = this.activeSessionId;
    let chunkIndex = 0;
    let started = false;

    const playNextChunk = () => {
      if (sessionId !== this.activeSessionId) return;

      if (chunkIndex >= chunks.length) {
        if (sessionId === this.activeSessionId) {
          options.onEnd?.();
        }
        return;
      }

      const chunk = chunks[chunkIndex];
      const isQuestion = chunk.endsWith('?');
      const isExclamation = chunk.endsWith('!') || /^(notice|look at|remember|observe|watch|why)/i.test(chunk);
      const isInvariant = /(takeaway|golden rule|rule|invariant|formula|summary|guarantee)/i.test(chunk);

      // Expressive Pitch & Rate Modulation:
      // Questions go slightly up (1.05) with inquisitive teacher tone
      // Exclamations/insights go up (1.03) with lively presence
      // Takeaway/invariant rules go grounded and calm (0.96)
      let pitch = options.pitch ?? 1.0;
      let rate = options.rate ?? 1.0;

      if (isQuestion) {
        pitch = Math.min(1.2, pitch * 1.05);
        rate = Math.max(0.85, rate * 0.98);
      } else if (isExclamation) {
        pitch = Math.min(1.2, pitch * 1.03);
        rate = Math.min(1.15, rate * 1.02);
      } else if (isInvariant) {
        pitch = Math.max(0.85, pitch * 0.96);
        rate = Math.max(0.85, rate * 0.96);
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = rate;
      utterance.pitch = pitch;

      const targetLang = options.lang || this.selectedLang || this.detectLanguage(chunk);
      utterance.lang = targetLang;

      if (options.voiceName) {
        const v = this.getVoices().find((voice) => voice.name === options.voiceName);
        if (v) utterance.voice = v;
      } else if (this.selectedVoice && this.selectedVoice.lang.toLowerCase().startsWith(targetLang.split('-')[0].toLowerCase())) {
        utterance.voice = this.selectedVoice;
      } else {
        const best = this.getBestVoiceForLang(targetLang);
        if (best) utterance.voice = best;
      }

      utterance.onstart = () => {
        if (sessionId !== this.activeSessionId) return;
        if (!started) {
          started = true;
          options.onStart?.();
        }
        options.onChunkStart?.(chunk, chunkIndex, chunks.length);
      };

      utterance.onend = () => {
        if (sessionId !== this.activeSessionId) return;
        chunkIndex++;

        // Natural micro-pauses between sentences/clauses
        let pauseMs = 320;
        if (isQuestion) pauseMs = 520;       // Reflective pause after asking student a question
        else if (isExclamation) pauseMs = 420; // Emphasize key observation
        else if (chunk.endsWith(',') || chunk.endsWith(';')) pauseMs = 180; // Natural breath
        else if (isInvariant) pauseMs = 450; // Pause after invariant card

        const adjustedPause = pauseMs / (options.rate ?? 1.0);

        setTimeout(() => {
          if (sessionId === this.activeSessionId) {
            playNextChunk();
          }
        }, adjustedPause);
      };

      utterance.onerror = (e) => {
        if (sessionId !== this.activeSessionId) return;
        // Canceled or interrupted utterances during scene switch are normal
        if (e.error === 'canceled' || e.error === 'interrupted') return;
        console.warn('SpeechSynthesis error on chunk:', e);
        chunkIndex++;
        playNextChunk();
      };

      this.synth!.speak(utterance);
    };

    playNextChunk();
  }

  static stop(): void {
    this.activeSessionId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }

  static pause(): void {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
    }
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
    }
  }

  static resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
    }
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  static isSpeaking(): boolean {
    const isAudioPlaying = !!(this.currentAudio && !this.currentAudio.paused);
    const isSynthSpeaking = !!(this.synth && this.synth.speaking);
    return isAudioPlaying || isSynthSpeaking;
  }
}
