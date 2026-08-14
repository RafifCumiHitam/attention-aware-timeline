import { useRealtimeStore } from "@/stores/realtime-store";

export interface WebSocketClientOptions {
  url?: string;
  sessionId?: string;
  userId?: string;
  token?: string | null;
  pingIntervalMs?: number;
  pingTimeoutMs?: number;
  maxReconnectDelayMs?: number;
}

export interface TelemetryPayload {
  videoId: string;
  progressSeconds: number;
  progressPercent: number;
  attentionScore: number;
  currentEmotion: string;
  gazeX?: number | null;
  gazeY?: number | null;
  eventType?: string | null;
  wallClockMs?: number | null;
  seekDeltaSeconds?: number | null;
  isDifficultSection?: boolean;
}

/** Defer Zustand writes so we never setState while React is rendering. */
function scheduleStoreUpdate(fn: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
  } else {
    setTimeout(fn, 0);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("demo-") || trimmed.startsWith("session-")) return false;
  return UUID_RE.test(trimmed);
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

    this.sessionId = options.sessionId || "";
    this.userId = options.userId || "";
    this.token = options.token || null;

    const queryParams = new URLSearchParams({
      session_id: this.sessionId,
      user_id: this.userId || "unknown",
    });
    if (this.token) {
      queryParams.append("token", this.token);
    }

    this.url = `${baseUrl}?${queryParams.toString()}`;
    this.pingIntervalMs = options.pingIntervalMs || 15000;
    this.pingTimeoutMs = options.pingTimeoutMs || 5000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs || 16000;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public connect(): void {
    if (!isValidSessionId(this.sessionId)) {
      console.warn("[WebSocket] Refusing connect — invalid sessionId:", this.sessionId);
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isIntentionallyClosed = false;
    const store = useRealtimeStore.getState();

    if (store.reconnectAttempts === 0) {
      store.setConnectionStatus("connecting");
    } else {
      store.setConnectionStatus("reconnecting");
    }

    console.log("[WebSocket] Constructor/connect", {
      sessionId: this.sessionId,
      userId: this.userId,
      hasToken: Boolean(this.token),
      url: this.url.replace(/token=[^&]+/, "token=***"),
    });

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.warn("[WebSocket] Failed to instantiate:", error);
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    console.log("[WebSocket] onopen", {
      sessionId: this.sessionId,
      readyState: this.ws?.readyState,
    });
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
          scheduleStoreUpdate(() => {
            useRealtimeStore.getState().setAdaptiveCommand({
              playbackRate: data.playback_rate,
              action: data.action,
              reason: data.reason,
            });
          });
          break;

        case "realtime_state_sync":
          scheduleStoreUpdate(() => {
            const s = useRealtimeStore.getState();
            s.updateTelemetry({
              progressSeconds: data.progress_seconds,
              progressPercent: data.progress_percent ?? 0,
              attentionScore: data.attention_score,
              currentEmotion: data.current_emotion,
            });
            s.setAdaptiveCommand({
              playbackRate: data.playback_rate,
              action: "maintain",
              reason: "Synced from session broadcast",
            });
          });
          break;

        case "telemetry_ack":
          break;

        default:
          console.debug("[WebSocket] message:", data.type);
      }
    } catch (err) {
      console.warn("[WebSocket] parse error:", err);
    }
  }

  private handleError(_event: Event): void {
    console.warn(
      "[WebSocket] onerror — transport issue (API offline?). URL base:",
      this.url.split("?")[0]
    );
  }

  private handleClose(event: CloseEvent): void {
    console.warn("[WebSocket] onclose", {
      code: event.code,
      reason: event.reason || "(empty)",
      wasClean: event.wasClean,
      intentional: this.isIntentionallyClosed,
      sessionId: this.sessionId,
    });
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
    this.pingTimer = setInterval(() => this.sendPing(), this.pingIntervalMs);
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
    this.ws.send(
      JSON.stringify({
        type: "ping",
        timestamp: this.pingSentTime / 1000,
      })
    );

    this.pongTimeoutTimer = setTimeout(() => {
      console.warn("[WebSocket] Pong timeout — closing stale socket");
      this.ws?.close(4000, "pong_timeout");
    }, this.pingTimeoutMs);
  }

  private handlePong(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
    const latency = Date.now() - this.pingSentTime;
    scheduleStoreUpdate(() => {
      useRealtimeStore.getState().setPingLatency(latency);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.isIntentionallyClosed) return;

    const store = useRealtimeStore.getState();
    store.incrementReconnectAttempts();
    const attempts = store.reconnectAttempts;

    const delay = Math.min(
      this.maxReconnectDelayMs,
      Math.pow(2, attempts - 1) * 1000 + Math.random() * 500
    );

    console.log(`[WebSocket] scheduleReconnect in ${Math.round(delay)}ms (attempt ${attempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public sendTelemetry(payload: TelemetryPayload): void {
    scheduleStoreUpdate(() => {
      useRealtimeStore.getState().updateTelemetry({
        progressSeconds: payload.progressSeconds,
        progressPercent: payload.progressPercent,
        attentionScore: payload.attentionScore,
        currentEmotion: payload.currentEmotion,
        gazeX: payload.gazeX,
        gazeY: payload.gazeY,
      });
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
      event_type: payload.eventType ?? null,
      wall_clock_ms: payload.wallClockMs ?? Date.now(),
      seek_delta_seconds: payload.seekDeltaSeconds ?? null,
      is_difficult_section: payload.isDifficultSection ?? false,
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      if (this.outboundQueue.length >= 50) this.outboundQueue.shift();
      this.outboundQueue.push(msg);
    }
  }

  private flushOutboundQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.outboundQueue.length > 0) {
      const msg = this.outboundQueue.shift();
      if (msg) this.ws.send(msg);
    }
  }

  public disconnect(): void {
    console.log("[WebSocket] disconnect() intentional", { sessionId: this.sessionId });
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client_disconnect");
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    useRealtimeStore.getState().setConnectionStatus("disconnected");
  }
}

// ---------------------------------------------------------------------------
// Ref-counted registry — survives React StrictMode mount→cleanup→remount
// ---------------------------------------------------------------------------

interface RegistryEntry {
  client: WebSocketClient;
  refCount: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

const registry = new Map<string, RegistryEntry>();

export function acquireWebSocketClient(options: {
  sessionId: string;
  userId: string;
  token?: string | null;
}): WebSocketClient | null {
  if (!isValidSessionId(options.sessionId)) {
    console.warn("[WebSocket] acquire refused — invalid sessionId", options.sessionId);
    return null;
  }

  const key = options.sessionId;
  let entry = registry.get(key);

  if (entry?.releaseTimer) {
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  }

  if (!entry) {
    const client = new WebSocketClient({
      sessionId: options.sessionId,
      userId: options.userId,
      token: options.token,
    });
    entry = { client, refCount: 0, releaseTimer: null };
    registry.set(key, entry);
    client.connect();
  }

  entry.refCount += 1;
  console.log("[WebSocket] acquire", { key, refCount: entry.refCount });
  return entry.client;
}

export function releaseWebSocketClient(sessionId: string): void {
  const entry = registry.get(sessionId);
  if (!entry) return;

  entry.refCount = Math.max(0, entry.refCount - 1);
  console.log("[WebSocket] release", { sessionId, refCount: entry.refCount });

  if (entry.refCount > 0) return;

  // Defer hard disconnect so StrictMode remount can re-acquire the same socket
  if (entry.releaseTimer) clearTimeout(entry.releaseTimer);
  entry.releaseTimer = setTimeout(() => {
    const current = registry.get(sessionId);
    if (!current || current.refCount > 0) return;
    console.log("[WebSocket] deferred disconnect after grace period", { sessionId });
    current.client.disconnect();
    registry.delete(sessionId);
  }, 150);
}
