import { AUDIO_DATA, AudioData } from "./data.js";
import { config } from "./config.js";

export function log(msg: string): void {
  console.log(`[Yuketang-JS] ${msg}`);
}

export function notify(title: string, text: string): void {
  // https://www.tampermonkey.net/documentation.php?locale=en#api:GM_notification
  if (typeof GM_notification === "function") {
    GM_notification({
      text: text,
      title: title,
      image: "https://www.yuketang.cn/static/images/favicon.ico",
      highlight: true,
      timeout: 3600 * 1000,
    });
    log(`🔈 Notification sent: ${title}`);
  } else {
    log("⚠️ Notification not available");
  }
}

type WebSocketCallback = (url: string, data: string) => void;

interface InterceptedConnection {
  url: string;
  protocols?: string | string[];
  instance: WebSocket;
  messages: unknown[];
}

export class WsMitm {
  private originalWebSocket: typeof WebSocket | null;
  private urlRegex: RegExp | null;
  public onReceiveCallback: WebSocketCallback | null;
  public onUploadCallback: WebSocketCallback | null;
  private interceptedConnections: Map<string, InterceptedConnection>;
  private isActive: boolean;

  constructor() {
    this.originalWebSocket = null;
    this.urlRegex = null;
    this.onReceiveCallback = null;
    this.onUploadCallback = null;
    this.interceptedConnections = new Map();
    this.isActive = false;
  }

  /**
   * @param {Function} callback - (url, data)
   */
  setOnReceive(callback: WebSocketCallback): void {
    if (typeof callback === "function") {
      this.onReceiveCallback = callback;
    }
  }

  /**
   * @param {Function} callback - (url, data)
   */
  setOnUpload(callback: WebSocketCallback): void {
    if (typeof callback === "function") {
      this.onUploadCallback = callback;
    }
  }

  startMitm(urlReg: string | RegExp): void {
    if (this.isActive) {
      return;
    }

    if (typeof urlReg === "string") {
      this.urlRegex = new RegExp(urlReg);
    } else if (urlReg instanceof RegExp) {
      this.urlRegex = urlReg;
    } else {
      throw new Error("Bad urlReg type");
    }

    const targetWindow =
      typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    this.originalWebSocket = targetWindow.WebSocket;
    log(
      "📍 WebSocket MITM using window is " +
        (typeof unsafeWindow !== "undefined" ? "unsafeWindow" : "window"),
    );

    const self = this;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    targetWindow.WebSocket = class ProxyWebSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        log("🚧 WebSocket connection attempted to: " + url);

        if (self.urlRegex!.test(url.toString())) {
          const wsId = `${url}_${Date.now()}_${Math.random()}`;

          self.interceptedConnections.set(wsId, {
            url: url.toString(),
            protocols,
            instance: this as unknown as WebSocket,
            messages: [],
          });

          const originalSend = this.send;
          this.send = function (
            data: string | ArrayBufferLike | Blob | ArrayBufferView,
          ): void {
            if (self.onUploadCallback) {
              self.onUploadCallback(url.toString(), data as string);
            }
            return originalSend.call(this, data);
          };

          const originalAddEventListener = this.addEventListener;
          this.addEventListener = function (
            eventType: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions,
          ): void {
            if (eventType === "message") {
              const wrappedListener = function (event: Event): void {
                if (self.onReceiveCallback) {
                  self.onReceiveCallback(
                    url.toString(),
                    (event as MessageEvent).data as string,
                  );
                }
                if (typeof listener === "function") {
                  listener(event);
                } else {
                  listener.handleEvent(event);
                }
              };
              return originalAddEventListener.call(
                this,
                eventType,
                wrappedListener as EventListenerOrEventListenerObject,
                options,
              );
            }
            return originalAddEventListener.call(
              this,
              eventType,
              listener,
              options,
            );
          };

          const originalDescriptor = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(this),
            "onmessage",
          );

          let userOnMessage:
            | ((this: WebSocket, ev: MessageEvent) => unknown)
            | null = null;

          Object.defineProperty(this, "onmessage", {
            set: function (
              callback: ((this: WebSocket, ev: MessageEvent) => unknown) | null,
            ) {
              userOnMessage = callback;
              const wrappedCallback = function (
                this: WebSocket,
                event: Event,
              ): unknown {
                if (self.onReceiveCallback) {
                  self.onReceiveCallback(
                    url.toString(),
                    (event as MessageEvent).data as string,
                  );
                }
                if (userOnMessage) {
                  return userOnMessage.call(this, event as MessageEvent);
                }
                return undefined;
              };
              if (originalDescriptor && originalDescriptor.set) {
                originalDescriptor.set.call(
                  this,
                  wrappedCallback as (
                    this: WebSocket,
                    ev: MessageEvent,
                  ) => unknown,
                );
              } else {
                // Fallback
                originalAddEventListener.call(
                  this,
                  "message",
                  wrappedCallback as EventListenerOrEventListenerObject,
                );
              }
            },
            get: function () {
              return userOnMessage;
            },
            configurable: true,
            enumerable: false,
          });
        }
      }
    } as typeof WebSocket;

    this.isActive = true;
    log("▶️ Started WebSocket MITM for URLs matching: " + this.urlRegex);
  }

  endMitm(): void {
    if (!this.isActive) {
      return;
    }

    const targetWindow =
      typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    if (this.originalWebSocket) {
      targetWindow.WebSocket = this.originalWebSocket;
    }

    this.interceptedConnections.clear();

    this.urlRegex = null;
    this.isActive = false;

    log("⏹️ Stopped WebSocket MITM");
  }

  getInterceptedConnections(): InterceptedConnection[] {
    return Array.from(this.interceptedConnections.values());
  }

  isActiveMethod(): boolean {
    return this.isActive;
  }
}

export const wsMitm = new WsMitm();

export class AudioController {
  private audioElement: HTMLAudioElement;
  private currentAudioData: AudioData;

  constructor() {
    this.audioElement = new Audio();
    this.currentAudioData = AUDIO_DATA[0];
    this._initializeAudio();
    this._restoreConfig();
  }

  /**
   * Restore audio configuration from storage
   * @private
   */
  private _restoreConfig(): void {
    const audioConfig = config.getAudioConfig();

    // Restore selected audio
    if (audioConfig.selected && audioConfig.selected.startsWith("preset:")) {
      const presetId = parseInt(audioConfig.selected.split(":")[1]);
      if (presetId >= 0 && presetId < AUDIO_DATA.length) {
        this.currentAudioData = AUDIO_DATA[presetId];
        log(`🎵 Preset audio restored: ${AUDIO_DATA[presetId].name}`);
      }
    }

    this._initializeAudio();
  }

  private _initializeAudio(): void {
    if (this.currentAudioData && this.currentAudioData.data) {
      this.audioElement.src = this.currentAudioData.data;
    }
  }

  private _isPlaying(): boolean {
    return !this.audioElement.paused;
  }

  /**
   * Plays the audio.
   * If the previous audio is still playing, this play request will be ignored.
   */
  play(): void {
    if (!this._isPlaying()) {
      this.audioElement.currentTime = 0;
      this.audioElement.play().catch((err: unknown) => {
        log(`❌ Audio play error: ${err}`);
      });
    }
  }

  stop(): void {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  /**
   * Switches to a different audio by name or index.
   * @param {string|number} nameOrIndex - Audio name or index
   */
  setAudio(nameOrIndex: string | number): boolean {
    let newIndex = -1;

    if (typeof nameOrIndex === "number") {
      newIndex = nameOrIndex;
    } else if (typeof nameOrIndex === "string") {
      newIndex = AUDIO_DATA.findIndex((audio) => audio.name === nameOrIndex);
    }

    if (newIndex < 0 || newIndex >= AUDIO_DATA.length) {
      console.error(`Audio] Invalid audio index or name: ${nameOrIndex}`);
      return false;
    }

    this.currentAudioData = AUDIO_DATA[newIndex];
    this._initializeAudio();

    // Save to config
    config.setSelectedAudio(`preset:${newIndex}`);

    return true;
  }
}

export const audioController = new AudioController();
