'use client';

import type { CallState, TranscriptTurn } from './dograh-driver';

/**
 * The free, in-browser voice driver for the "Talk to our AI" page.
 *
 *  listening  → Web Speech API when the browser has it (Chrome/Edge/Android), otherwise
 *               push-to-talk recorded with MediaRecorder and transcribed by Groq Whisper
 *               (/api/talk/[token]/transcribe); typing always works as a last resort.
 *  thinking   → /api/talk/[token]/agent (GPT-OSS on Groq, or the offline simulator)
 *  speaking   → /api/talk/[token]/speak (Groq Orpheus, optional) else browser speechSynthesis
 *
 * Nothing here costs money and no telephony carrier is involved.
 */

export type InputMode = 'speech' | 'push' | 'text';

export interface AgentApplied {
  meeting?: { id: string; start_time: string; meet_url: string; title: string };
  task?: { id: string; title: string };
  opted_out?: boolean;
}

export interface AgentTurnResponse {
  reply: string;
  intent?: string;
  actions?: Record<string, unknown>;
  applied?: AgentApplied;
  end_call: boolean;
  simulated?: boolean;
}

export interface LocalVoiceDriverOptions {
  token: string;
  language: string;
  onStateChange: (state: CallState, details?: string) => void;
  onTranscriptTurn: (turn: TranscriptTurn) => void;
  onCallComplete: (summary: string) => void;
  onInputMode?: (mode: InputMode, note?: string) => void;
  onInterim?: (text: string) => void;
  onAgentApplied?: (applied: AgentApplied) => void;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const RECOGNITION_LANG: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', hinglish: 'hi-IN' };
const TTS_LANG: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', hinglish: 'hi-IN' };

function now(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export class LocalVoiceDriver {
  private readonly opts: LocalVoiceDriverOptions;
  private language: string;
  private nonce?: string;
  private history: TranscriptTurn[] = [];
  private callActive = false;
  private startedAt = 0;
  private processing = false;
  private muted = false;
  private inputMode: InputMode = 'text';
  private recognition?: SpeechRecognitionLike;
  private recognitionActive = false;
  private noSpeechRestarts = 0;
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private audioEl?: HTMLAudioElement;
  private speechResolve?: () => void;
  private actions: { meeting_id?: string; handoff?: boolean; opt_out?: boolean } = {};
  private transcriptionAvailable: boolean | null = null;

  constructor(opts: LocalVoiceDriverOptions) {
    this.opts = opts;
    this.language = opts.language || 'en';
  }

  public get isActive(): boolean {
    return this.callActive;
  }

  public setLanguage(language: string) {
    this.language = language;
    if (this.recognition) this.recognition.lang = RECOGNITION_LANG[language] || 'en-IN';
  }

  // ------------------------------------------------------------------ lifecycle

  public async startCall(nonce: string): Promise<void> {
    this.nonce = nonce;
    this.opts.onStateChange('requesting_permission', 'Checking microphone access…');

    let micOk = false;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micOk = true;
      }
    } catch {
      micOk = false;
    }

    this.callActive = true;
    this.startedAt = Date.now();
    this.history = [];
    this.actions = {};
    this.postEvent('call_started');
    this.opts.onStateChange('connecting', 'Connecting to Apex AI voice agent…');

    const SpeechCtor = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
    if (micOk && SpeechCtor) {
      this.inputMode = 'speech';
      this.opts.onInputMode?.('speech', 'Just speak — the agent listens after each answer.');
    } else if (micOk && typeof MediaRecorder !== 'undefined') {
      this.inputMode = 'push';
      this.opts.onInputMode?.('push', 'Hold the mic button while you speak, or type below.');
    } else {
      this.inputMode = 'text';
      this.opts.onInputMode?.('text', micOk ? 'Voice input is not supported here — type your replies.' : 'Microphone unavailable — type your replies below.');
    }

    const greeting = await this.agentTurn(null);
    if (!this.callActive) return;
    await this.speak(greeting.reply);
    if (!this.callActive) return;
    if (greeting.end_call) {
      this.finish(greeting.reply);
      return;
    }
    this.listen();
  }

  public endCall(): void {
    if (!this.callActive) {
      this.cleanup();
      return;
    }
    this.finish('Call ended by prospect. Thank you for connecting with Apex AI SDR.');
  }

  /** Component unmount without a call in progress. */
  public dispose(): void {
    this.callActive = false;
    this.cleanup();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopRecognition();
      this.opts.onStateChange('listening', 'Microphone muted — unmute or type your reply.');
    } else if (this.callActive && !this.processing) {
      this.listen();
    }
  }

  /** Typed reply (always available). */
  public async sendText(text: string): Promise<void> {
    await this.handleUserText(text);
  }

  // ------------------------------------------------------------------ listening

  private listen(): void {
    if (!this.callActive || this.processing) return;
    if (this.inputMode === 'speech' && !this.muted) {
      this.startRecognition();
      this.opts.onStateChange('listening', 'Listening to you…');
      return;
    }
    this.opts.onStateChange('listening', this.inputMode === 'push' ? 'Hold the mic button to talk, or type your reply.' : 'Type your reply below.');
  }

  private startRecognition(): void {
    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) {
      this.fallbackInput('Speech recognition unavailable');
      return;
    }
    this.stopRecognition();
    const rec = new SpeechCtor();
    rec.lang = RECOGNITION_LANG[this.language] || 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      this.opts.onInterim?.(finalText || interim);
      if (finalText.trim()) {
        const text = finalText.trim();
        finalText = '';
        this.recognitionActive = false;
        rec.onend = null;
        try {
          rec.stop();
        } catch {
          // already stopped
        }
        this.handleUserText(text);
      }
    };
    rec.onerror = (event) => {
      this.recognitionActive = false;
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return; // onend restarts
      }
      // not-allowed, service-not-allowed, network, audio-capture, language-not-supported
      this.fallbackInput(`Speech recognition error: ${event.error}`);
    };
    rec.onend = () => {
      const wasActive = this.recognitionActive;
      this.recognitionActive = false;
      if (!this.callActive || this.processing || this.muted || this.inputMode !== 'speech') return;
      if (wasActive && this.noSpeechRestarts < 12) {
        this.noSpeechRestarts++;
        setTimeout(() => {
          if (this.callActive && !this.processing && !this.muted && this.inputMode === 'speech') this.startRecognition();
        }, 250);
      } else if (wasActive) {
        this.opts.onStateChange('listening', 'Still there? Tap the mic button or type your reply.');
      }
    };
    try {
      rec.start();
      this.recognition = rec;
      this.recognitionActive = true;
    } catch (err) {
      this.fallbackInput(`Could not start recognition: ${(err as Error).message}`);
    }
  }

  private stopRecognition(): void {
    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = undefined;
      this.recognitionActive = false;
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        // ignore
      }
    }
  }

  private fallbackInput(reason: string): void {
    this.stopRecognition();
    if (this.stream && typeof MediaRecorder !== 'undefined' && this.transcriptionAvailable !== false) {
      this.inputMode = 'push';
      this.opts.onInputMode?.('push', 'Voice recognition is unavailable in this browser — hold the mic button to talk, or type.');
    } else {
      this.inputMode = 'text';
      this.opts.onInputMode?.('text', 'Voice input is unavailable here — type your replies.');
    }
    console.info('[voice] input fallback:', reason);
    if (this.callActive && !this.processing) this.listen();
  }

  /** Push-to-talk: hold to record, release to transcribe (Groq Whisper). */
  public startRecording(): void {
    if (!this.callActive || this.processing || !this.stream || typeof MediaRecorder === 'undefined') return;
    if (this.recorder && this.recorder.state === 'recording') return;
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const recorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
      this.chunks = [];
      if (blob.size < 2000) return; // too short to be speech
      this.transcribe(blob);
    };
    recorder.start();
    this.recorder = recorder;
    this.opts.onStateChange('listening', 'Recording… release to send.');
  }

  public stopRecording(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
    }
  }

  private async transcribe(blob: Blob): Promise<void> {
    if (!this.callActive) return;
    this.opts.onStateChange('connected', 'Transcribing…');
    try {
      const form = new FormData();
      form.append('file', blob, 'audio.webm');
      form.append('language', this.language);
      const res = await fetch(`/api/talk/${this.opts.token}/transcribe`, { method: 'POST', body: form });
      if (res.status === 503) {
        this.transcriptionAvailable = false;
        this.inputMode = 'text';
        this.opts.onInputMode?.('text', 'Transcription is not configured on this server — type your replies.');
        this.listen();
        return;
      }
      const json = await res.json();
      this.transcriptionAvailable = true;
      const text = (json.text || '').trim();
      if (!text) {
        this.opts.onStateChange('listening', "I didn't catch that — try again or type your reply.");
        return;
      }
      await this.handleUserText(text);
    } catch {
      this.opts.onStateChange('listening', 'Transcription failed — please type your reply.');
    }
  }

  // ------------------------------------------------------------------ conversation

  private async handleUserText(text: string): Promise<void> {
    const clean = text.trim();
    if (!clean || !this.callActive || this.processing) return;
    this.processing = true;
    this.stopRecognition();
    this.opts.onInterim?.('');
    this.pushTurn('user', clean);
    this.opts.onStateChange('connected', 'Apex AI is thinking…');

    const turn = await this.agentTurn(clean);
    if (!this.callActive) {
      this.processing = false;
      return;
    }
    await this.speak(turn.reply);
    this.processing = false;
    if (!this.callActive) return;
    if (turn.end_call) {
      this.finish(turn.reply);
      return;
    }
    this.noSpeechRestarts = 0;
    this.listen();
  }

  private pushTurn(role: 'agent' | 'user', text: string): void {
    const turn: TranscriptTurn = { role, text, time: now() };
    this.history.push(turn);
    this.opts.onTranscriptTurn(turn);
  }

  private async agentTurn(userText: string | null): Promise<AgentTurnResponse> {
    try {
      const res = await fetch(`/api/talk/${this.opts.token}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nonce: this.nonce,
          history: this.history.map((t) => ({ role: t.role, text: t.text })),
          user_text: userText,
          language: this.language,
        }),
      });
      const json = (await res.json()) as AgentTurnResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || `Agent HTTP ${res.status}`);
      if (json.applied) {
        if (json.applied.meeting) this.actions.meeting_id = json.applied.meeting.id;
        if (json.applied.task) this.actions.handoff = true;
        if (json.applied.opted_out) this.actions.opt_out = true;
        if (json.applied.meeting || json.applied.task || json.applied.opted_out) this.opts.onAgentApplied?.(json.applied);
      }
      this.pushTurn('agent', json.reply);
      return json;
    } catch (err) {
      const reply = "Sorry, I'm having trouble hearing you right now. Could you type that, or shall we end the call and I'll email you a summary?";
      this.pushTurn('agent', reply);
      this.postEvent('error', { details: (err as Error).message });
      return { reply, end_call: false };
    }
  }

  // ------------------------------------------------------------------ speaking

  private async speak(text: string): Promise<void> {
    if (!this.callActive || !text) return;
    this.opts.onStateChange('speaking', 'Apex AI is speaking…');
    const words = text.split(/\s+/).length;
    const maxWaitMs = Math.min(20_000, 1500 + words * 380);

    // 1. Optional server-side TTS (Groq Orpheus). 204 = not configured.
    try {
      const res = await fetch(`/api/talk/${this.opts.token}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: this.language }),
      });
      if (res.ok && res.status === 200) {
        const blob = await res.blob();
        if (blob.size > 0 && (await this.playBlob(blob, maxWaitMs))) return;
      }
    } catch {
      // fall through to browser TTS
    }

    // 2. Browser speechSynthesis (free, offline voices)
    await this.speakWithBrowser(text, maxWaitMs);
  }

  private playBlob(blob: Blob, maxWaitMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audioEl = audio;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        this.audioEl = undefined;
        resolve(ok);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => finish(false));
      setTimeout(() => finish(true), maxWaitMs + 5000);
    });
  }

  private speakWithBrowser(text: string, maxWaitMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setTimeout(resolve, Math.min(maxWaitMs, 2500));
        return;
      }
      const synth = window.speechSynthesis;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.speechResolve = undefined;
        resolve();
      };
      this.speechResolve = finish;
      try {
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const lang = TTS_LANG[this.language] || 'en-IN';
        utter.lang = lang;
        const voices = synth.getVoices();
        const preferred =
          voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase() && /google|natural|online/i.test(v.name)) ||
          voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0]));
        if (preferred) utter.voice = preferred;
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.onend = finish;
        utter.onerror = finish;
        synth.speak(utter);
        // Headless / voiceless environments never fire onend.
        setTimeout(finish, maxWaitMs);
      } catch {
        finish();
      }
    });
  }

  private cancelSpeech(): void {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {
        // ignore
      }
      this.audioEl = undefined;
    }
    this.speechResolve?.();
  }

  // ------------------------------------------------------------------ end of call

  private finish(summary: string): void {
    const durationSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    this.callActive = false;
    this.cleanup();
    this.opts.onStateChange('ended', 'Call finished');
    this.postEvent('call_completed', {
      durationSeconds,
      transcript: this.history.map((t) => ({ role: t.role, text: t.text })),
      language: this.language,
      actions: this.actions,
    });
    this.opts.onCallComplete(summary);
  }

  private cleanup(): void {
    this.processing = false;
    this.stopRecognition();
    this.cancelSpeech();
    if (this.recorder && this.recorder.state === 'recording') {
      try {
        this.recorder.onstop = null;
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.recorder = undefined;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = undefined;
    }
  }

  private async postEvent(event: string, meta: Record<string, unknown> = {}): Promise<void> {
    try {
      await fetch(`/api/talk/${this.opts.token}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...meta }),
        keepalive: true,
      });
    } catch {
      // ignore
    }
  }
}
