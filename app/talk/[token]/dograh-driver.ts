'use client';

export interface DograhWidgetAPI {
  start(): void;
  end(): void;
  setContext(vars: Record<string, any>): void;
  getContext(): Record<string, any>;
  onStatusChange(cb: (status: 'idle' | 'connecting' | 'connected' | 'failed', text?: string) => void): void;
  onCallStart(cb: () => void): void;
  onCallConnected(cb: (payload: { agentId: string | number; workflowRunId: string | number; token: string }) => void): void;
  onCallDisconnected(cb: (payload: { agentId: string | number; workflowRunId: string | number; token: string; durationSeconds: number }) => void): void;
  onCallEnd(cb: () => void): void;
  onError(cb: (err: Error) => void): void;
}

declare global {
  interface Window {
    DograhWidget?: DograhWidgetAPI;
  }
}

export type CallState =
  | 'idle'
  | 'requesting_permission'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'ended'
  | 'error';

export interface TranscriptTurn {
  role: 'agent' | 'user';
  text: string;
  time: string;
}

export class DograhDriver {
  private token: string;
  private language: string;
  private onStateChange: (state: CallState, details?: string) => void;
  private onTranscriptTurn: (turn: TranscriptTurn) => void;
  private onCallComplete: (summary: string) => void;
  private simulationTimer?: NodeJS.Timeout;
  private isSimulated = false;
  /** True between startCall() and the end of the call — endCall() is a no-op otherwise. */
  private callActive = false;

  constructor(options: {
    token: string;
    language: string;
    onStateChange: (state: CallState, details?: string) => void;
    onTranscriptTurn: (turn: TranscriptTurn) => void;
    onCallComplete: (summary: string) => void;
  }) {
    this.token = options.token;
    this.language = options.language;
    this.onStateChange = options.onStateChange;
    this.onTranscriptTurn = options.onTranscriptTurn;
    this.onCallComplete = options.onCallComplete;
  }

  public async loadScript(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const widgetSrc = process.env.NEXT_PUBLIC_DOGRAH_WIDGET_SRC;
    if (!widgetSrc || widgetSrc.includes('demo') || process.env.NEXT_PUBLIC_VOICE_PROVIDER === 'demo') {
      this.isSimulated = true;
      return true;
    }

    if (window.DograhWidget) {
      this.bindDograhCallbacks();
      return true;
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = 'dograh-widget';
      script.src = widgetSrc;
      script.async = true;
      script.onload = () => {
        if (window.DograhWidget) {
          this.bindDograhCallbacks();
          resolve(true);
        } else {
          this.isSimulated = true;
          resolve(true);
        }
      };
      script.onerror = () => {
        this.isSimulated = true;
        resolve(true);
      };
      document.body.appendChild(script);
    });
  }

  private bindDograhCallbacks() {
    const w = window.DograhWidget;
    if (!w) return;

    w.onStatusChange((status, text) => {
      if (status === 'connecting') this.onStateChange('connecting', text);
      else if (status === 'connected') this.onStateChange('connected', text);
      else if (status === 'failed') this.onStateChange('error', text);
      else if (status === 'idle') this.onStateChange('idle');
    });

    w.onCallStart(() => {
      this.onStateChange('connecting', 'Negotiating WebRTC audio channel...');
      this.postEvent('call_started');
    });

    w.onCallConnected(() => {
      this.onStateChange('speaking', 'AI Agent is speaking...');
    });

    w.onCallDisconnected((payload) => {
      this.callActive = false;
      this.onStateChange('ended', 'Call finished');
      this.postEvent('call_completed', { durationSeconds: payload.durationSeconds });
      this.onCallComplete('WebRTC consultation completed. Next steps delivered.');
    });

    w.onError((err) => {
      this.callActive = false;
      this.onStateChange('error', err.message);
      this.postEvent('error', { details: err.message });
    });
  }

  public async startCall(contextNonce: string, prospectName: string, companyName: string): Promise<void> {
    this.onStateChange('requesting_permission', 'Checking microphone access...');

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      this.onStateChange('error', 'Microphone permission was denied. Please allow microphone access to talk.');
      return;
    }

    this.callActive = true;

    if (!this.isSimulated && window.DograhWidget) {
      window.DograhWidget.setContext({
        talk_ref: contextNonce,
        lang: this.language,
      });
      window.DograhWidget.start();
      return;
    }

    // Run interactive simulation
    this.runSimulation(prospectName, companyName);
  }

  public endCall(): void {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = undefined;
    }
    // React Strict Mode mounts effects twice in development; the component's cleanup calls
    // endCall() before any call exists. Nothing must be reported in that case.
    if (!this.callActive) {
      return;
    }
    this.callActive = false;
    if (!this.isSimulated && window.DograhWidget) {
      window.DograhWidget.end();
    } else {
      this.onStateChange('ended', 'Call ended by prospect');
      this.postEvent('call_completed', { durationSeconds: 45 });
      this.onCallComplete('Call concluded. Thank you for connecting with Apex AI SDR.');
    }
  }

  private runSimulation(prospectName: string, companyName: string) {
    this.onStateChange('connecting', 'Connecting to Apex AI Voice Agent via WebRTC...');
    this.postEvent('call_started');

    const firstName = prospectName || 'there';
    const company = companyName || 'your team';

    const script: Array<{
      role: 'agent' | 'user';
      text: string;
      delayMs: number;
      state: CallState;
    }> = [
      {
        role: 'agent',
        text: `Namaste ${firstName}! This is Apex AI SDR calling on behalf of Apex Technologies. Thank you for tapping our talk link. Can you hear me clearly?`,
        delayMs: 2500,
        state: 'speaking',
      },
      {
        role: 'user',
        text: `Yes, I can hear you fine. I saw your message regarding B2B pipeline automation for ${company}.`,
        delayMs: 6500,
        state: 'listening',
      },
      {
        role: 'agent',
        text: `Wonderful! We help sales leaders across India eliminate manual SDR follow-up delays using compliant multi-agent orchestration. Would you be open to a 15-minute walkthrough with our solutions director this Thursday at 3:00 PM IST?`,
        delayMs: 11500,
        state: 'speaking',
      },
      {
        role: 'user',
        text: `Thursday at 3:00 PM IST works for me. Please confirm that slot.`,
        delayMs: 17500,
        state: 'listening',
      },
      {
        role: 'agent',
        text: `Slot confirmed! I have locked in Thursday 3:00 PM IST and triggered your calendar confirmation. Thank you ${firstName}, looking forward to connecting!`,
        delayMs: 22000,
        state: 'speaking',
      },
    ];

    let currentStep = 0;

    const executeStep = () => {
      if (currentStep >= script.length) {
        this.callActive = false;
        this.onStateChange('ended', 'Call successfully completed');
        this.postEvent('call_completed', { durationSeconds: 28 });
        this.onCallComplete(
          `Demo confirmed for Thursday at 3:00 PM IST. Meeting invite dispatched.`
        );
        return;
      }

      const item = script[currentStep];
      this.simulationTimer = setTimeout(() => {
        this.onStateChange(item.state);
        this.onTranscriptTurn({
          role: item.role,
          text: item.text,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        currentStep++;
        executeStep();
      }, item.delayMs - (currentStep === 0 ? 0 : script[currentStep - 1].delayMs));
    };

    executeStep();
  }

  private async postEvent(event: string, meta: Record<string, any> = {}) {
    try {
      await fetch(`/api/talk/${this.token}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...meta }),
      });
    } catch {
      // ignore
    }
  }
}
