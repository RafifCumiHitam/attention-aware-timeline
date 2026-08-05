import { useRealtimeStore } from "@/stores/realtime-store";

export interface WebSocketClientOptions {
  url?: string;
  sessionId?: string;
  userId?: string;
  token?: string | null;
  pingIntervalMs?: number; // default 15000ms
  pingTimeoutMs?: number; // default 5000ms
  maxReconnectDelayMs?: number; // default 16000ms
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string;
  private userId: string;
  private token: string | null;

  private pingIntervalMs: number;
  private pingTimeoutMs: number;
  private maxReconnectDelayMs: number;

  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private pingSentTime: number = 0;
  private isIntentionallyClosed: boolean = false;
  private outboundQueue: string[] = [];

  constructor(options: WebSocketClientOptions = {}) {
    const baseUrl =
      options.url ||
      process.env.NEXT_PUBLIC_WS_URL ||
      "ws://localhost:8000/api/v1/ws/learning";

    this.sessionId = options.sessionId || "demo-session-1";
    this.userId = options.userId || "demo-user-1";
    this.token = options.token || null;

    const queryParams = new URLSearchParams({
      session_id: this.sessionId,
      user_id: this.userId,
    });
    if (this.token) {
      queryParams.append("token", this.token);
    }

    this.url = `${baseUrl}?${queryParams.toString()}`;
    this.pingIntervalMs = options.pingIntervalMs || 15000;
    this.pingTimeoutMs = options.pingTimeoutMs || 5000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs || 16000;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    const store = useRealtimeStore.getState();

    if (store.reconnectAttempts === 0) {
      store.setConnectionStatus("connecting");
    } else {
      store.setConnectionStatus("reconnecting");
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error("[WebSocket] Failed to instantiate WebSocket:", error);
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    console.log("[WebSocket] Connection established");
    const store = useRealtimeStore.getState();
    store.setConnectionStatus("connected");
    store.resetReconnectAttempts();

    this.startHeartbeat();
    this.flushOutboundQueue();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const store = useRealtimeStore.getState();

      switch (data.type) {
        case "pong":
          this.handlePong();
          break;

        case "adaptive_playback_command":
          store.setAdaptiveCommand({
            playbackRate: data.playback_rate,
            action: data.action,
            reason: data.reason,
          });
          break;

        case "realtime_state_sync":
          store.updateTelemetry({
            progressSeconds: data.progress_seconds,
            progressPercent: (data.progress_seconds / 60) * 100, // normalized default
            attentionScore: data.attention_score,
            currentEmotion: data.current_emotion,
          });
          store.setAdaptiveCommand({
            playbackRate: data.playback_rate,
            action: "maintain",
            reason: "Synced from session broadcast",
          });
          break;

        case "telemetry_ack":
          // Telemetry received and acknowledged by server
          break;

        default:
          console.debug("[WebSocket] Received message:", data);
      }
    } catch (err) {
      console.error("[WebSocket] Error parsing message:", err);
    }
  }

  private handleError(event: Event): void {
    console.error("[WebSocket] Error encountered:", event);
    useRealtimeStore.getState().setConnectionStatus("error");
  }

  private handleClose(event: CloseEvent): void {
    console.warn(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason})`);
    this.stopHeartbeat();

    if (!this.isIntentionallyClosed) {
      useRealtimeStore.getState().setConnectionStatus("reconnecting");
      this.scheduleReconnect();
    } else {
      useRealtimeStore.getState().setConnectionStatus("disconnected");
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.pingSentTime = Date.now();
    const pingPayload = JSON.stringify({
      type: "ping",
      timestamp: this.pingSentTime / 1000,
    });

    this.ws.send(pingPayload);

    // Expect pong within pingTimeoutMs
    this.pongTimeoutTimer = setTimeout(() => {
      console.warn("[WebSocket] Heartbeat pong timeout. Force closing stale connection...");
      if (this.ws) {
        this.ws.close();
      }
    }, this.pingTimeoutMs);
  }

  private handlePong(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
    const latency = Date.now() - this.pingSentTime;
    useRealtimeStore.getState().setPingLatency(latency);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const store = useRealtimeStore.getState();
    store.incrementReconnectAttempts();
    const attempts = store.reconnectAttempts;

    // Exponential backoff with jitter
    const delay = Math.min(
      this.maxReconnectDelayMs,
      Math.pow(2, attempts - 1) * 1000 + Math.random() * 500
    );

    console.log(`[WebSocket] Scheduling reconnect in ${Math.round(delay)}ms (Attempt #${attempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public sendTelemetry(payload: {
    videoId: string;
    progressSeconds: number;
    progressPercent: number;
    attentionScore: number;
    currentEmotion: string;
    gazeX?: number | null;
    gazeY?: number | null;
  }): void {
    // Update local Zustand store immediately for snappy UI responsiveness
    useRealtimeStore.getState().updateTelemetry({
      progressSeconds: payload.progressSeconds,
      progressPercent: payload.progressPercent,
      attentionScore: payload.attentionScore,
      currentEmotion: payload.currentEmotion,
      gazeX: payload.gazeX,
      gazeY: payload.gazeY,
    });

    const msg = JSON.stringify({
      type: "telemetry_update",
      session_id: this.sessionId,
      video_id: payload.videoId,
      progress_seconds: payload.progressSeconds,
      progress_percent: payload.progressPercent,
      attention_score: payload.attentionScore,
      current_emotion: payload.currentEmotion,
      gaze_x: payload.gazeX ?? null,
      gaze_y: payload.gazeY ?? null,
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      // Queue offline message (up to max 50 items)
      if (this.outboundQueue.length >= 50) {
        this.outboundQueue.shift();
      }
      this.outboundQueue.push(msg);
    }
  }

  private flushOutboundQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.outboundQueue.length > 0) {
      const msg = this.outboundQueue.shift();
      if (msg) {
        this.ws.send(msg);
      }
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useRealtimeStore.getState().setConnectionStatus("disconnected");
  }
}
