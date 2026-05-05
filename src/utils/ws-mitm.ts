import { log } from "./log.js";

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
