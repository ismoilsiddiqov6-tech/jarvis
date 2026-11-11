/**
 * Speech Recognition (STT) and Speech Synthesis (TTS) utility for JARVIS
 */

// Extend window interface for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechRecognitionCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: any) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export class JarvisSpeech {
  private recognition: any = null;
  private isListening: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  public isSpeaking: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'uz-UZ';
      }

      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => this.loadVoices();
        }
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  public isRecognitionSupported(): boolean {
    return !!this.recognition;
  }

  public setLanguage(lang: string) {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public startListening(callbacks: SpeechRecognitionCallbacks) {
    if (!this.recognition) {
      callbacks.onError?.('Ushbu brauzerda ovozli nutqni aniqlash qo\'llab-quvvatlanmaydi.');
      return;
    }

    try {
      this.recognition.onstart = () => {
        this.isListening = true;
        callbacks.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        callbacks.onResult(text, !!finalTranscript);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        callbacks.onError?.(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        callbacks.onEnd?.();
      };

      this.recognition.start();
    } catch (err) {
      this.isListening = false;
      callbacks.onError?.(err);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  // Speak response with JARVIS British butler cadence
  public speak(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      lang?: string;
    }
  ) {
    if (!this.synth) return;

    this.stopSpeaking();

    // Clean text of markdown asterisks or special tokens for clearer speech
    const cleanText = text
      .replace(/\*+/g, '')
      .replace(/#/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    // Try to find Uzbek voice or articulate UK/English/Russian voice
    if (this.voices.length === 0) {
      this.loadVoices();
    }

    const uzVoice = this.voices.find(v => v.lang.startsWith('uz'));
    const ruVoice = this.voices.find(v => v.lang.startsWith('ru'));
    const ukVoice = this.voices.find(v => v.lang === 'en-GB' || v.name.includes('UK') || v.name.includes('British'));
    const defaultVoice = this.voices.find(v => v.default) || this.voices[0];

    // Language detection: if prompt was in Russian/English, match accordingly
    const targetLang = options?.lang || 'uz-UZ';
    utterance.lang = targetLang;

    if (uzVoice) {
      utterance.voice = uzVoice;
    } else if (targetLang.startsWith('ru') && ruVoice) {
      utterance.voice = ruVoice;
    } else if (ukVoice) {
      utterance.voice = ukVoice;
    } else if (defaultVoice) {
      utterance.voice = defaultVoice;
    }

    // Jarvis tone: slightly deeper pitch, crisp calm tempo
    utterance.pitch = 0.96;
    utterance.rate = 1.02;

    utterance.onstart = () => {
      this.isSpeaking = true;
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options?.onEnd?.();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options?.onEnd?.();
    };

    try {
      this.synth.speak(utterance);
    } catch {
      this.isSpeaking = false;
    }
  }

  public stopSpeaking() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }
}

export const jarvisVoice = new JarvisSpeech();
