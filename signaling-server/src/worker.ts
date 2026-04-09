interface Env {
  SIGNALING_SERVER: DurableObjectNamespace;
}

interface RoleMessage {
  type: "ready";
  role: "caller" | "callee";
}

export class SignalingServer implements DurableObject {
  private sessions: WebSocket[];

  constructor(ctx: DurableObjectState, env: Env) {
    void ctx;
    void env;
    this.sessions = [];
  }

  async fetch(request: Request): Promise<Response> {
    void request;
    this.pruneDeadSessions();

    if (this.sessions.length >= 2) {
      return new Response("Room is full", { status: 429 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSession(webSocket: WebSocket): void {
    webSocket.accept();
    this.sessions.push(webSocket);

    if (this.sessions.length === 1) {
      this.safeSend(webSocket, JSON.stringify({ type: "waiting" }));
    }

    if (this.sessions.length === 2) {
      const callerMessage: RoleMessage = { type: "ready", role: "caller" };
      const calleeMessage: RoleMessage = { type: "ready", role: "callee" };
      this.safeSend(this.sessions[0], JSON.stringify(callerMessage));
      this.safeSend(this.sessions[1], JSON.stringify(calleeMessage));
    }

    webSocket.addEventListener("message", (event) => {
      const payload =
        typeof event.data === "string"
          ? event.data
          : "[Unsupported signaling payload]";
      this.broadcast(payload, webSocket);
    });

    const closeOrErrorHandler = (): void => {
      this.sessions = this.sessions.filter((socket) => socket !== webSocket);

      if (this.sessions.length > 0) {
        this.broadcast(JSON.stringify({ type: "peer-left" }));
      }
    };

    webSocket.addEventListener("close", closeOrErrorHandler);
    webSocket.addEventListener("error", closeOrErrorHandler);
  }

  private broadcast(message: string, sender?: WebSocket): void {
    for (const socket of [...this.sessions]) {
      if (socket === sender) {
        continue;
      }

      if (!this.safeSend(socket, message)) {
        this.sessions = this.sessions.filter((liveSocket) => liveSocket !== socket);
      }
    }
  }

  private safeSend(socket: WebSocket, message: string): boolean {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  private pruneDeadSessions(): void {
    this.sessions = this.sessions.filter(
      (socket) => socket.readyState === WebSocket.OPEN
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomId = decodeURIComponent(url.pathname.slice(1));

    if (!roomId || roomId.includes("/")) {
      return new Response("Invalid URL. Expected format: /<room-id>", {
        status: 400,
      });
    }

    const id = env.SIGNALING_SERVER.idFromName(roomId);
    const stub = env.SIGNALING_SERVER.get(id);

    return stub.fetch(request);
  },
};