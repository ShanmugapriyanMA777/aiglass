/* eslint-disable @typescript-eslint/no-explicit-any */
let currentSettings = { speed: 1.0, lang: 'en-US' };

export function configureSpeech(speed: number, lang: string) {
  currentSettings = { speed, lang };
}

export function speak(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = currentSettings.speed;
  utterance.lang = currentSettings.lang;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function isSpeaking() {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}

export type SpeechRecognitionCallback = (transcript: string) => void;

export class SpeechRecognitionHelper {
  private recognition: any = null;
  private callback: SpeechRecognitionCallback | null = null;

  constructor() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = currentSettings.lang;
    }
  }

  isSupported() {
    return this.recognition !== null;
  }

  start(callback: SpeechRecognitionCallback) {
    if (!this.recognition) return;
    this.callback = callback;
    this.recognition.lang = currentSettings.lang;
    this.recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      if (this.callback) this.callback(transcript);
    };
    this.recognition.start();
  }

  stop() {
    if (this.recognition) this.recognition.stop();
  }
}
