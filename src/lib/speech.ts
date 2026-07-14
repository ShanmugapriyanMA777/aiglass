/* eslint-disable @typescript-eslint/no-explicit-any */
let currentSettings = { speed: 1.0, lang: 'en-US' };
let activeAudio: HTMLAudioElement | null = null;

export function configureSpeech(speed: number, lang: string) {
  currentSettings = { speed, lang };
}

export function speak(text: string, onEnd?: () => void) {
  // Cancel any active online audio playback
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {
      console.warn('Error pausing active audio:', e);
    }
    activeAudio = null;
  }

  if (!('speechSynthesis' in window)) return;
  
  // Standard cancel for native speech synthesis
  window.speechSynthesis.cancel();

  const lang = currentSettings.lang;
  const isEnglish = lang.toLowerCase().startsWith('en');

  // Query native system voices
  const voices = window.speechSynthesis.getVoices();
  const hasNativeVoice = voices.some(v => 
    v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase())
  );

  // If a native voice for the selected language is not installed/available (e.g. Hindi, Tamil, Telugu),
  // use a bulletproof online TTS service to stream the audio seamlessly.
  if (!isEnglish && !hasNativeVoice) {
    console.log(`No native voice found for language ${lang}. Using online TTS fallback.`);
    const shortLang = lang.split('-')[0]; // 'hi', 'ta', 'te'
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${shortLang}&client=tw-ob&q=${encodeURIComponent(text)}`;

    try {
      const audio = new Audio(url);
      audio.playbackRate = currentSettings.speed;
      activeAudio = audio;
      
      if (onEnd) {
        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null;
          onEnd();
        };
      }

      audio.play().catch(err => {
        console.warn('Online TTS play failed. Trying browser synthesis fallback:', err);
        // Fallback to native engine (last resort, even if it speaks in default English accent)
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = currentSettings.speed;
        utterance.lang = currentSettings.lang;
        if (onEnd) utterance.onend = onEnd;
        window.speechSynthesis.speak(utterance);
      });
      return;
    } catch (e) {
      console.error('Audio initialization failed. Falling back to native SpeechSynthesis:', e);
    }
  }

  // Native web speech synthesis fallback / standard flow
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = currentSettings.speed;
  utterance.lang = currentSettings.lang;

  if (voices.length > 0) {
    // Attempt exact language match first, then language code prefix
    const matchedVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) ||
                         voices.find(v => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch (e) {
      console.warn('Error pausing active audio during stop:', e);
    }
    activeAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking() {
  const audioIsPlaying = activeAudio ? !activeAudio.paused : false;
  return audioIsPlaying || ('speechSynthesis' in window && window.speechSynthesis.speaking);
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
