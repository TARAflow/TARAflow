export default class CORSCommunicator {
  private readonly target: HTMLIFrameElement | null;
  private readonly listeners: Array<(event: MessageEvent) => void> = [];

  constructor(target: HTMLIFrameElement | null) {
    this.target = target;
  }

  send(message: object) {
    const stringified = JSON.stringify(message);
    if (this.target && this.target.contentWindow) {
      this.target.contentWindow.postMessage(stringified, "*");
    }
  }

  receive(callback: (event: MessageEvent) => void) {
    window.addEventListener("message", callback);
    this.listeners.push(callback);
  }

  /**
   * Remove every window "message" listener this communicator registered.
   * Without this, each disposed bridge stayed reachable from window — the
   * listener kept the controller, the detached draw.io iframe and its whole
   * Window alive (one more per DFD-tab visit) and still handled every message.
   */
  dispose() {
    for (const callback of this.listeners) {
      window.removeEventListener("message", callback);
    }
    this.listeners.length = 0;
  }

  public getTarget(): HTMLIFrameElement | null {
    return this.target;
  }
}
