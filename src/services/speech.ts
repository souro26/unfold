export class SpeechService {
  private static synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;

  static isSupported(): boolean {
    return !!this.synth;
  }

  static speak(text: string, rate: number = 1.0): void {
    if (!this.synth) return;
    this.stop();

    // Clean markdown before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'code snippet omitted')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#$[\]()]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;

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
