export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  voiceName?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export class SpeechService {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static selectedVoice: SpeechSynthesisVoice | null = null;

  static isSupported(): boolean {
    return !!this.synth;
  }

  static getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  static setVoice(voiceName: string): void {
    const voices = this.getVoices();
    const found = voices.find((v) => v.name === voiceName || v.lang.startsWith(voiceName));
    if (found) {
      this.selectedVoice = found;
    }
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

  static speak(text: string, options: SpeechOptions = {}): void {
    if (!this.synth) return;
    this.stop();

    const cleanText = this.parseSSML(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    } else if (options.voiceName) {
      const v = this.getVoices().find((voice) => voice.name === options.voiceName);
      if (v) utterance.voice = v;
    }

    if (options.onStart) utterance.onstart = () => options.onStart!();
    if (options.onEnd) utterance.onend = () => options.onEnd!();
    if (options.onError) utterance.onerror = (e) => options.onError!(e);

    this.synth.speak(utterance);
  }

  static stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  static isSpeaking(): boolean {
    return !!(this.synth && this.synth.speaking);
  }
}
