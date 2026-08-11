import { speak, stopSpeaking } from './speech';

export enum VoicePriority {
  EMERGENCY = 1,
  SAFETY = 2,
  NAVIGATION = 3,
  COMMANDS = 4,
  GENERAL = 5
}

interface VoiceMessage {
  text: string;
  priority: VoicePriority;
  timestamp: number;
  onEnd?: () => void;
}

export class VoiceEngine {
  private queue: VoiceMessage[] = [];
  private speaking = false;
  private currentPriority = VoicePriority.GENERAL;
  private currentText = '';
  private isMuted: () => boolean = () => false;
  
  // Smart filter cache: maps object/text to last spoken timestamp
  private spokenCache: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 15000; // Do not repeat same general phrase within 15s

  public onStateChange: (active: boolean, text: string, queueSize: number, priority: VoicePriority) => void = () => {};

  constructor() {}

  public setMuteGetter(getter: () => boolean) {
    this.isMuted = getter;
  }

  /**
   * Adds a message to the voice queue with JARVIS-style priority filtering.
   */
  public add(text: string, priority: VoicePriority, bypassFilter = false, onEnd?: () => void) {
    if (this.isMuted()) {
      if (onEnd) onEnd();
      return;
    }

    const normalizedText = text.trim().toLowerCase();

    // Smart filtering: don't repeat the exact same general message within TTL
    // Emergency & Commands usually bypass filtering
    if (!bypassFilter && priority >= VoicePriority.SAFETY) {
      const lastSpoken = this.spokenCache.get(normalizedText);
      const now = Date.now();
      if (lastSpoken && now - lastSpoken < this.CACHE_TTL_MS) {
        if (onEnd) onEnd();
        return; // Filter out repetitious speech
      }
      this.spokenCache.set(normalizedText, now);
    }

    // Emergency immediately interrupts everything
    if (priority === VoicePriority.EMERGENCY) {
      this.clearQueue();
      stopSpeaking();
      this.speaking = false;
      this.queue.push({ text, priority, timestamp: Date.now(), onEnd });
      this.processSpeech();
      return;
    }

    // Drop low priority messages if queue is too large to prevent massive backlog
    if (this.queue.length > 4 && priority > VoicePriority.SAFETY) {
      if (onEnd) onEnd();
      return; 
    }

    this.queue.push({ text, priority, timestamp: Date.now(), onEnd });
    // Sort by priority (lower number = higher priority)
    this.queue.sort((a, b) => a.priority - b.priority);
    
    this.processSpeech();
  }

  private processSpeech() {
    if (this.speaking || this.queue.length === 0) {
      this.notifyState();
      return;
    }

    const next = this.queue.shift()!;
    this.speaking = true;
    this.currentText = next.text;
    this.currentPriority = next.priority;
    this.notifyState();

    if (this.isMuted()) {
      setTimeout(() => {
        this.finishSpeaking();
      }, 500);
      return;
    }

    // Use centralized speak from speech.ts which handles offline, native, etc.
    speak(this.currentText, () => {
      if (next.onEnd) next.onEnd();
      this.finishSpeaking();
    });
  }

  private finishSpeaking() {
    this.speaking = false;
    this.currentText = '';
    this.currentPriority = VoicePriority.GENERAL;
    this.processSpeech();
  }

  public stop() {
    this.clearQueue();
    stopSpeaking();
    this.speaking = false;
    this.currentText = '';
    this.notifyState();
  }

  public clearQueue() {
    this.queue = [];
  }

  private notifyState() {
    this.onStateChange(this.speaking, this.currentText, this.queue.length, this.currentPriority);
  }

  // Convenience methods
  public emergency(text: string, onEnd?: () => void) { this.add(text, VoicePriority.EMERGENCY, true, onEnd); }
  public safety(text: string, onEnd?: () => void) { this.add(text, VoicePriority.SAFETY, false, onEnd); }
  public navigation(text: string, onEnd?: () => void) { this.add(text, VoicePriority.NAVIGATION, false, onEnd); }
  public command(text: string, onEnd?: () => void) { this.add(text, VoicePriority.COMMANDS, true, onEnd); }
  public general(text: string, onEnd?: () => void) { this.add(text, VoicePriority.GENERAL, false, onEnd); }

  public getStatus() {
    return {
      speaking: this.speaking,
      text: this.currentText,
      queueSize: this.queue.length,
      priority: this.currentPriority
    };
  }
}

export const voiceEngine = new VoiceEngine();
